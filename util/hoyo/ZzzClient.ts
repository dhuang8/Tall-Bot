import sql from '../SQLite.js';
import { request, timeOnNext } from '../functions.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageCreateOptions } from 'discord.js';
import { HoyoClient, Resource, User, hoyoPost } from './HoyoClient.ts';
import { getPosts } from './HoyoClient.ts';
import { hoyoRequest } from './HoyoClient.ts';
import { crossIfTrue } from "./HoyoClient.ts";


let zzzCharMap: { [key: number]: string; } = {};
let zzzBangbooMap: { [key: number]: string; } = {};

request("https://api.hakush.in/zzz/data/character.json").then(body => {
    let data: {[key: string]: {EN: string}} = body
    Object.entries(data).forEach(entry => {
        zzzCharMap[parseInt(entry[0])] = entry[1].EN
    })
})

request("https://api.hakush.in/zzz/data/bangboo.json").then(body => {
    let data: {[key: string]: {EN: string}} = body
    Object.entries(data).forEach(entry => {
        zzzBangbooMap[parseInt(entry[0])] = entry[1].EN
    })
})

export class ZzzClient extends HoyoClient {
    bc?: ZzzBattleChronicle;
    hz?: ZzzHollowZero;
    cn?: ZzzCriticalNode;
    signIn?: { checked: boolean; };

    constructor(user_id: string) {
        super({
            user_id,
            root_url: "https://sg-act-nap-api.hoyolab.com/event/game_record_zzz/api/zzz/"
        })
    }

    getUid(user: User): number {
        return user.zzz_uid;
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign?act_id=e202406031448091&lang=en-us`, this.cookie);
        return response;
    }

    async dailyInfo() {
        const response = await hoyoRequest(`https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/info?lang=en-us&act_id=e202406031448091`, this.cookie);
        this.signIn = { checked: response.is_sign };
        return this.signIn;
    }

    async battleChronicle(): Promise<ZzzBattleChronicle> {
        let cur = Math.floor(Date.now() / 1000);
        const response: {
            energy: {
                progress: {
                    max: number;
                    current: number;
                };
                restore: number;
            };
            vitality: {
                max: number;
                current: number;
            };
            vhs_sale: "SaleStateDone" | "SaleStateNo" | "SaleStateDoing";
            card_sign: "CardSignNo" | "CardSignDone";
        } = await hoyoRequest(this.root_url + `note?server=prod_gf_us&role_id=${this.uid}`, this.cookie);
        this.bc = {
            battery_charge: {
                current: response.energy.progress.current,
                max: response.energy.progress.max,
                recovery_time: cur + response.energy.restore,
            },
            daily: {
                engagement: {
                    current: response.vitality.current,
                    max: response.vitality.max,
                },
                scratch_card: {
                    current: response.card_sign == "CardSignDone" ? 1 : 0,
                    max: 1
                },
                video_store: {
                    current: response.vhs_sale === "SaleStateDone" ? 1 : 0,
                    max: 1
                },
                recovery_time: timeOnNext(24 * 60 * 60, 9 * 60 * 60)
            }
        };
        return this.bc;
    }

    async hollowZero(): Promise<ZzzHollowZero> {
        let cur = Math.floor(Date.now() / 1000);
        const response: {
            abyss_duty: {
                cur_duty: number;
                max_duty: number;
            };
            abyss_point: {
                cur_point: number;
                max_point: number;
            };
            refresh_time: number;
        } = await hoyoRequest(this.root_url + `abyss_abstract?server=prod_gf_us&role_id=${this.uid}`, this.cookie);
        this.hz = {
            commission: {
                cur: response.abyss_duty.cur_duty,
                max: response.abyss_duty.max_duty
            },
            investigation: {
                cur: response.abyss_point.cur_point,
                max: response.abyss_point.max_point
            },
            recovery_time: cur + response.refresh_time
        };
        return this.hz;
    }

    async criticalNode(type: number = 1): Promise<ZzzCriticalNode> {
        const response: {
            hadal_end_time: {
                year: number,
                month: number,
                day: number,
                hour: number,
                minute: number,
                second: number
            }
            all_floor_detail: {
                zone_name: string;
                layer_index: number;
                rating: string;
                node_1: {
                    avatars: {
                        id: number;
                        level: number;
                        rank: number;
                    }[];
                    buddy: {
                        id: number;
                        level: number;
                        rarity: string;
                    };
                };
                node_2: {
                    avatars: {
                        id: number;
                        level: number;
                        rank: number;
                    }[];
                    buddy: {
                        id: number;
                        level: number;
                        rarity: string;
                    };
                };
            }[];
        } = await hoyoRequest(this.root_url + `challenge?server=prod_gf_us&role_id=${this.uid}&schedule_type=${type}`, this.cookie);
        const floors = response.all_floor_detail.map(floor => {
            const teams = [floor.node_1, floor.node_2].map(node => {
                return {
                    chars: node.avatars.map(char => {
                        return {
                            level: char.level,
                            name: zzzCharMap[char.id],
                            cinema: char.rank
                        };
                    }),
                    bangboo: {
                        name: zzzBangbooMap[node.buddy.id],
                        level: node.buddy.level
                    }
                };
            });
            return {
                name: floor.zone_name,
                rating: floor.rating,
                teams
            };
        });
        let s_rank_count = floors.reduce((count, floor) => {
            return floor.rating === "S" ? count + 1 : count;
        }, 0);
        let end_time = response.hadal_end_time;
        let end_date = new Date(end_time.year, end_time.month - 1, end_time.day, end_time.hour + 5, end_time.minute, end_time.second+1);
        this.cn = {
            // 13 hours
            recovery_time: end_date.valueOf() / 1000,
            s_ranks: {
                cur: s_rank_count,
                max: 7
            },
            floors
        };
        return this.cn;
    }

    async buildUserEmbed(): Promise<MessageCreateOptions> {
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.cn) prom.push(this.criticalNode());
        if (!this.signIn) prom.push(this.dailyInfo());
        if (!this.hz) prom.push(this.hollowZero());
        await Promise.all(prom);

        if (!this.bc) throw new Error('bc is undefined');
        if (!this.signIn) throw new Error('signIn is undefined');
        if (!this.cn) throw new Error('cn is undefined');
        if (!this.hz) throw new Error('hz is undefined');

        let descLines = [];
        descLines.push(`**Battery Power**: ${this.bc.battery_charge.current}/${this.bc.battery_charge.max}, capped <t:${this.bc.battery_charge.recovery_time}:R>`);

        const embed = new EmbedBuilder()
            .setTitle(`Zenless Zone Zero — ${this.uid}`)
            .setDescription(descLines.join("\n"))
            .setTimestamp();

        embed.addFields({ name: `Web check-in reset <t:${timeOnNext(24 * 60 * 60, 16 * 60 * 60)}:R>`, value: crossIfTrue(this.signIn.checked, `Check-in`) });

        let dailyLines = [];
        dailyLines.push(crossIfTrue(
            this.bc.daily.scratch_card.current >= this.bc.daily.scratch_card.max,
            `Scratch Card Mania`
        ));
        dailyLines.push(crossIfTrue(
            this.bc.daily.video_store.current >= this.bc.daily.video_store.max,
            `Video Store Open`
        ));
        dailyLines.push(crossIfTrue(
            this.bc.daily.engagement.current >= this.bc.daily.engagement.max,
            `**Engagement**: ${this.bc.daily.engagement.current}/${this.bc.daily.engagement.max}`
        ));
        embed.addFields({ name: `Daily reset <t:${this.bc.daily.recovery_time}:R>`, value: dailyLines.join("\n") });

        let weeklyLines = [];
        weeklyLines.push(crossIfTrue(
            this.hz.investigation.cur >= this.hz.investigation.max,
            `**Investigation Points**: ${this.hz.investigation.cur}/${this.hz.investigation.max}`
        ));
        weeklyLines.push(crossIfTrue(
            this.hz.commission.cur >= this.hz.commission.max,
            `**Bounty Commissions**: ${this.hz.commission.cur}/${this.hz.commission.max}`
        ));
        embed.addFields({ name: `Hollow Zero reset <t:${this.hz.recovery_time}:R>`, value: weeklyLines.join("\n") });

        let endgameLines = [];
        endgameLines.push(crossIfTrue(
            this.cn.s_ranks.cur >= this.cn.s_ranks.max,
            `**S-Ranks**: ${this.cn.s_ranks.cur}/${this.cn.s_ranks.max}`
        ));
        embed.addFields({ name: `Critical Node reset <t:${this.cn.recovery_time}:R>`, value: endgameLines.join("\n") });

        const refreshButton = new ButtonBuilder()
            .setCustomId(`zzz|${this.user_id}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(refreshButton);
        return { embeds: [embed], components: [row] };
    }

    async getTimers(): Promise<Resource[]> {
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.cn) prom.push(this.criticalNode());
        if (!this.signIn) prom.push(this.dailyInfo());
        if (!this.hz) prom.push(this.hollowZero());
        await Promise.all(prom);

        if (!this.bc) throw new Error('bc is undefined');
        if (!this.signIn) throw new Error('signIn is undefined');
        if (!this.cn) throw new Error('cn is undefined');
        if (!this.hz) throw new Error('hz is undefined');

        let timers = [];
        timers.push({
            name: "ZZZ Battery Power",
            current: this.bc.battery_charge.current,
            max: this.bc.battery_charge.max,
            done: false,
            recovery_time: this.bc.battery_charge.recovery_time
        })
        timers.push({
            name: "ZZZ Scratch Card",
            current: this.bc.daily.scratch_card.current,
            max: this.bc.daily.scratch_card.max,
            done: this.bc.daily.scratch_card.current == this.bc.daily.scratch_card.max,
            recovery_time: this.bc.daily.recovery_time
        })
        timers.push({
            name: "ZZZ Video Store",
            current: this.bc.daily.video_store.current,
            max: this.bc.daily.video_store.max,
            done: this.bc.daily.video_store.current == this.bc.daily.video_store.max,
            recovery_time: this.bc.daily.recovery_time
        })
        timers.push({
            name: "ZZZ Engagement",
            current: this.bc.daily.engagement.current,
            max: this.bc.daily.engagement.max,
            done: this.bc.daily.engagement.current == this.bc.daily.engagement.max,
            recovery_time: this.bc.daily.recovery_time
        })
        timers.push({
            name: "ZZZ Hollow Zero",
            current: this.hz.commission.cur,
            max: this.hz.commission.max,
            done: this.hz.commission.cur == this.hz.commission.max,
            recovery_time: this.hz.recovery_time
        })
        timers.push({
            name: "ZZZ Critical Node",
            current: this.cn.s_ranks.cur,
            max: this.cn.s_ranks.max,
            done: this.cn.s_ranks.cur == this.cn.s_ranks.max,
            recovery_time: this.cn.recovery_time
        })
        return timers;
    }

    static async news() {
        return getPosts(219270333, '');
    }
}
export interface ZzzHollowZero {
    commission: {
        cur: number;
        max: number;
    };
    investigation: {
        cur: number;
        max: number;
    };
    recovery_time: number;
}
export interface ZzzBattleChronicle {
    battery_charge: {
        current: number;
        max: number;
        recovery_time: number;
    };
    daily: {
        engagement: {
            current: number;
            max: number;
        },
        scratch_card: {
            current: number;
            max: number;
        },
        video_store: {
            current: number;
            max: number;
        };
        recovery_time: number;
    };
}
export interface ZzzCriticalNode {
    s_ranks: {
        cur: number;
        max: number;
    };
    recovery_time: number;
    floors: {
        name: string;
        rating: string;
        teams: {
            chars: {
                level: number;
                name: string;
                cinema: number;
            }[];
            bangboo: {
                name: string;
                level: number;
            };
        }[];
    }[];
}
async function banners(id: number, cookie: string): Promise<any> {
    const response = await hoyoRequest(`https://bbs-api-os.hoyolab.com/community/painter/wapi/banner/list?gids=${id}`, cookie);
    return response;
}
