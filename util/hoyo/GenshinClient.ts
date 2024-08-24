import { request, timeOnNext } from '../functions.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageCreateOptions } from 'discord.js';
import { HoyoClient, Resource, User, getPosts, hoyoPost } from './HoyoClient.ts';
import { hoyoRequest } from './HoyoClient.ts';
import { crossIfTrue } from "./HoyoClient.ts";
import { codes } from './HoyoClient.ts';

let genshinCharMap: { [key: number]: string; } = [];

request("https://api.uigf.org/dict/genshin/en.json").then(res => {
    let chars: {[key: string]: number} = res;
    Object.entries(chars).forEach(entry => {
        genshinCharMap[entry[1]] = entry[0];
    })
});

export class GenshinClient extends HoyoClient {
    bc?: GenshinBattleChronicle;
    sa?: GenshinSpiralAbyss;

    constructor(user_id: string) {
        super({
            user_id,
            root_url: 'https://bbs-api-os.hoyolab.com/game_record/genshin/api/'
        })
    }

    getUid(user: User): number {
        return user.genshin_uid;
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=en-us&act_id=e202102251931481`, this.cookie);
        return response;
    }

    async battleChronicle(): Promise<GenshinBattleChronicle> {
        let cur = Math.floor(Date.now() / 1000);
        const response = await hoyoRequest(this.root_url + `dailyNote?server=os_usa&role_id=${this.uid}`, this.cookie);
        let transformer_time_obj = response.transformer.recovery_time;
        let transformer_time = ((transformer_time_obj.Day * 24 + transformer_time_obj.Hour) * 60 + transformer_time_obj.Minute) * 60 + transformer_time_obj.Second;
        this.bc = {
            resin: {
                current: response.current_resin,
                max: response.max_resin,
                recovery_time: cur + parseInt(response.resin_recovery_time),
            },
            realm_currency: {
                current: response.current_home_coin,
                max: response.max_home_coin,
                recovery_time: cur + parseInt(response.home_coin_recovery_time)
            },
            daily: {
                commission_count: response.finished_task_num,
                commission_max: response.total_task_num,
                commission_reward: response.is_extra_task_reward_received,
                recovery_time: timeOnNext(24 * 60 * 60, 9 * 60 * 60)
            },
            weekly: {
                half_cost_count: response.resin_discount_num_limit - response.remain_resin_discount_num,
                half_cost_max: response.resin_discount_num_limit,
                recovery_time: timeOnNext(7 * 24 * 60 * 60, 9 * 60 * 60 + 4 * 24 * 60 * 60)
            },
            transformer: {
                obtained: response.transformer.obtained,
                ready: transformer_time <= 0,
                recovery_time: cur + transformer_time
            },
            expeditions: []
        };
        this.bc.expeditions = response.expeditions.map((expedition: { status: string; remained_time: string; }) => {
            return {
                finished: expedition.status == 'Finished',
                recovery_time: cur + parseInt(expedition.remained_time)
            };
        });
        return this.bc;
    }

    async spiralAbyss(): Promise<GenshinSpiralAbyss> {
        const response: {
            total_star: number;
            end_time: string;
            floors: {
                index: number;
                max_star: number;
                star: number;
                levels: {
                    index: number;
                    star: number;
                    max_star: number;
                    battles: {
                        index: number;
                        avatars: {
                            level: number;
                            id: number;
                        }[];
                    }[];
                }[];
            }[];
        } = await hoyoRequest(this.root_url + `spiralAbyss?server=os_usa&role_id=${this.uid}&schedule_type=1`, this.cookie);
        const floors = response.floors.map(floor => {
            const chambers = floor.levels.map(chamber => {
                const sides = chamber.battles.map(side => {
                    const team = side.avatars.map(char => {
                        return {
                            level: char.level,
                            name: genshinCharMap[char.id]
                        };
                    });
                    return {
                        num: side.index,
                        team
                    };
                });
                return {
                    num: chamber.index,
                    stars: chamber.star,
                    max_stars: chamber.max_star,
                    sides
                };
            });
            return {
                num: floor.index,
                max_stars: floor.max_star,
                stars: floor.star,
                chambers
            };
        });
        this.sa = {
            stars: response.total_star,
            max_stars: 36,
            recovery_time: parseInt(response.end_time),
            floors
        };
        return this.sa;
    }

    async buildUserEmbed(): Promise<MessageCreateOptions> {
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.sa) prom.push(this.spiralAbyss());
        await Promise.all(prom);

        if (!this.bc || !this.sa) throw new Error('bc or sa is undefined');

        let descLines = [];
        descLines.push(`**Resin**: ${this.bc.resin.current}/${this.bc.resin.max}, capped <t:${this.bc.resin.recovery_time}:R>`);
        descLines.push(`**Realm Currency**: ${this.bc.realm_currency.current}/${this.bc.realm_currency.max}, capped <t:${this.bc.realm_currency.recovery_time}:R>`);
        if (this.bc.transformer.obtained) {
            descLines.push(crossIfTrue(
                !this.bc.transformer.ready,
                `**Transformer** ready <t:${this.bc.transformer.recovery_time}:R>`
            ));
        }

        const embed = new EmbedBuilder()
            .setTitle(`Genshin Impact — ${this.uid}`)
            .setDescription(descLines.join("\n"))
            .setTimestamp();

        let expeditionLines: string[] = this.bc.expeditions.map((expedition, i) => {
            return expedition.finished ? `**Expedition ${i + 1}** complete` : `**Expedition ${i + 1}** <t:${expedition.recovery_time}:R>`;
        });
        if (expeditionLines.length > 0) embed.addFields({ name: "Expeditions", value: expeditionLines.join("\n") });

        // embed.addFields({name: `Web check-in reset <t:${timeOnNext(24*60*60, 16*60*60)}:R>`, value: crossIfTrue(dailyResponse?.is_sign, `Check-in`)});
        let dailyLines = [];
        dailyLines.push(crossIfTrue(
            this.bc.daily.commission_count >= this.bc.daily.commission_max,
            `**Daily Commissions**: ${this.bc.daily.commission_count}/${this.bc.daily.commission_max}`
        ));
        dailyLines.push(crossIfTrue(
            this.bc.daily.commission_reward,
            `Daily Commission Reward`
        ));
        embed.addFields({ name: `Daily reset <t:${this.bc.daily.recovery_time}:R>`, value: dailyLines.join("\n") });

        let weeklyLines = [];
        weeklyLines.push(crossIfTrue(
            this.bc.weekly.half_cost_count >= this.bc.weekly.half_cost_max,
            `**Trounce**: ${this.bc.weekly.half_cost_count}/${this.bc.weekly.half_cost_max}`
        ));
        embed.addFields({ name: `Weekly reset <t:${this.bc.weekly.recovery_time}:R>`, value: weeklyLines.join("\n") });

        let spiralLines = [];
        spiralLines.push(crossIfTrue(
            this.sa.stars >= this.sa.max_stars,
            `**Stars**: ${this.sa.stars}/${this.sa.max_stars}`
        ));
        embed.addFields({ name: `Spiral Abyss reset <t:${this.sa.recovery_time}:R>`, value: spiralLines.join("\n") });

        const refreshButton = new ButtonBuilder()
            .setCustomId(`genshin|${this.user_id}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(refreshButton);
        return { embeds: [embed], components: [row] };
    }

    async getTimers(): Promise<Resource[]> {
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.sa) prom.push(this.spiralAbyss());
        await Promise.all(prom);

        if (!this.bc || !this.sa) throw new Error('bc or sa is undefined');
        let timers = [];
        timers.push({
            name: "Genshin Resin",
            current: this.bc.resin.current,
            max: this.bc.resin.max,
            done: false,
            recovery_time: this.bc.resin.recovery_time
        })
        timers.push({
            name: "Genshin Realm Currency",
            current: this.bc.realm_currency.current,
            max: this.bc.realm_currency.max,
            done: false,
            recovery_time: this.bc.realm_currency.recovery_time
        })
        timers.push({
            name: "Genshin Realm Transformer",
            current: this.bc.transformer.ready ? 1 : 0,
            max: 1,
            done: false,
            recovery_time: this.bc.transformer.recovery_time
        })
        timers.push({
            name: "Genshin Commissions",
            current: this.bc.daily.commission_reward ? 1 : 0,
            max: 1,
            done: this.bc.daily.commission_reward,
            recovery_time: this.bc.daily.recovery_time
        })
        timers.push({
            name: "Genshin Trounce Domains",
            current: this.bc.weekly.half_cost_count,
            max: this.bc.weekly.half_cost_max,
            done: this.bc.weekly.half_cost_count == this.bc.weekly.half_cost_max,
            recovery_time: this.bc.weekly.recovery_time
        })
        timers.push({
            name: "Genshin Spiral Abyss",
            current: this.sa.stars,
            max: this.sa.max_stars,
            done: this.sa.stars == this.sa.max_stars,
            recovery_time: this.sa.recovery_time
        })
        return timers;
    }

    async codes(): Promise<any> {
        //response.modules[0].exchange_group.bonuses[0].exchange_code
        return codes(2, this.cookie);
    }

    static async news(): Promise<any> {
        return getPosts(1015537, '');
    }
}
export interface GenshinSpiralAbyss {
    stars: number;
    max_stars: number;
    recovery_time: number;
    floors: {
        num: number;
        max_stars: number;
        stars: number;
        chambers: {
            num: number;
            max_stars: number;
            stars: number;
            sides: {
                num: number;
                team: {
                    level: number;
                    name: string;
                }[];
            }[];
        }[];
    }[];
}
export interface GenshinBattleChronicle {
    resin: {
        current: number;
        max: number;
        recovery_time: number;
    };
    realm_currency: {
        current: number;
        max: number;
        recovery_time: number;
    };
    daily: {
        commission_count: number;
        commission_max: number;
        commission_reward: boolean;
        recovery_time: number;
    };
    weekly: {
        half_cost_count: number;
        half_cost_max: number;
        recovery_time: number;
    };
    transformer: {
        obtained: boolean;
        ready: boolean;
        recovery_time: number;
    };
    expeditions: {
        finished: boolean;
        recovery_time: number;
    }[];
}
