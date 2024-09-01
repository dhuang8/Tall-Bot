import { request, timeOnNext } from '../functions.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageCreateOptions } from 'discord.js';
import { HoyoClient, Resource, User, hoyoPost, getPosts, hoyoRequest, codes, crossIfTrue } from './HoyoClient.ts';

let hsrCharMap: {[key: number]: {name: string}} = {};
request("https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/en/characters.json").then(body => {
    hsrCharMap = JSON.parse(body);
    hsrCharMap[8001].name = hsrCharMap[8002].name = "Trailblazer (Physical)"
    hsrCharMap[8003].name = hsrCharMap[8004].name = "Trailblazer (Fire)"
    hsrCharMap[8005].name = hsrCharMap[8006].name = "Trailblazer (Imaginary)"
});

export class HsrClient extends HoyoClient {
    bc?: HsrBattleChronicle;
    eg?: HsrEndgame[];
    su?: HsrSimulatedUniverse;

    constructor(user_id: string) {
        super({
            user_id,
            root_url: 'https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/'
        })
    }

    async info() {
        const response = await hoyoRequest(this.root_url + `avatar/info?server=prod_official_usa&role_id=${this.uid}&need_wiki=false`, this.cookie);
        return response;
    }

    getUid(user: User): number {
        return user.hsr_uid;
    }

    async battleChronicle(): Promise<HsrBattleChronicle> {
        let cur = Math.floor(Date.now() / 1000);
        const response = await hoyoRequest(this.root_url + `note?server=prod_official_usa&role_id=${this.uid}`, this.cookie);
        this.bc = {
            trailblaze_power: {
                reserve: response.current_reserve_stamina,
                current: response.current_stamina,
                max: response.max_stamina,
                recovery_time: cur + parseInt(response.stamina_recover_time),
            },
            daily: {
                current: response.current_train_score,
                max: response.max_train_score,
                recovery_time: timeOnNext(24 * 60 * 60, 9 * 60 * 60)
            },
            weekly: {
                current: response.weekly_cocoon_limit - response.weekly_cocoon_cnt,
                max: response.weekly_cocoon_limit,
                recovery_time: timeOnNext(7 * 24 * 60 * 60, 9 * 60 * 60 + 4 * 24 * 60 * 60)
            },
            assignments: []
        };
        this.bc.assignments = response.expeditions.map((expedition: { status: string; remaining_time: string; }) => {
            return {
                finished: expedition.status === 'Finished',
                recovery_time: cur + parseInt(expedition.remaining_time ?? 0)
            };
        });
        return this.bc;
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-public-api.hoyolab.com/event/luna/os/sign?lang=en-us&act_id=e202303301540311`, this.cookie);
        return response;
    }

    async endgameContent() {
        const endgame: HsrEndgame[] = await Promise.all([this.memoryOfChaos(1), this.apocalypticShadow(1), this.pureFiction(1)]);
        this.eg = endgame.filter(a => a.recovery_time > Date.now() / 1000).sort((a, b) => a.recovery_time - b.recovery_time);
        return this.eg;
    }

    async memoryOfChaos(type: number = 1, need_all: boolean = false): Promise<HsrEndgame> {
        const response: {
            star_num: number;
            has_data: boolean;
            end_time: {
                day: number;
                hour: number;
                minute: number;
                month: number;
                year: number;
            };
            all_floor_detail: {
                is_fast: boolean;
                name: string;
                star_num: number;
                round_num: number;
                node_1: {
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[];
                };
                node_2: {
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[];
                };
            }[];
        } = await hoyoRequest(this.root_url + `challenge?schedule_type=${type}&server=prod_official_usa&role_id=${this.uid}&need_all=${need_all}`, this.cookie);
        const floors = response.all_floor_detail.filter(floor => !floor.is_fast).map(floor => {
            const teams = [floor.node_1, floor.node_2].map(node => {
                return {
                    chars: node.avatars.map(char => {
                        return {
                            level: char.level,
                            name: hsrCharMap[char.id].name,
                            eidolon: char.rank
                        };
                    })
                };
            });
            return {
                name: floor.name,
                cycles: floor.round_num,
                stars: floor.star_num,
                teams
            };
        });
        const end_time = response.end_time;
        let end_date = new Date(end_time.year, end_time.month - 1, end_time.day, end_time.hour + 5, end_time.minute);
        return {
            name: `Memory of Chaos`,
            current_stars: response.star_num,
            max_stars: 36,
            recovery_time: end_date.getTime() / 1000,
            floors: floors
        };
    }

    async pureFiction(type: number = 1, need_all: boolean = false): Promise<HsrEndgame> {
        const response: {
            star_num: number;
            has_data: boolean;
            groups: {
                end_time: {
                    day: number;
                    hour: number;
                    minute: number;
                    month: number;
                    year: number;
                };
                name_mi18n: string;
            }[];
            all_floor_detail: {
                is_fast: boolean;
                name: string;
                star_num: number;
                round_num: number;
                node_1: {
                    buff: {
                        name_mi18n: string;
                    };
                    score: number;
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[];
                };
                node_2: {
                    buff: {
                        name_mi18n: string;
                    };
                    score: number;
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[];
                };
            }[];
        } = await hoyoRequest(this.root_url + `challenge_story?schedule_type=${type}&server=prod_official_usa&role_id=${this.uid}&need_all=${need_all}`, this.cookie);
        const floors = response.all_floor_detail.filter(floor => !floor.is_fast).map(floor => {
            const teams = [floor.node_1, floor.node_2].map(node => {
                const chars = node.avatars.map(char => {
                    return {
                        level: char.level,
                        name: hsrCharMap[char.id].name,
                        eidolon: char.rank
                    };
                });
                return {
                    buff: node.buff.name_mi18n,
                    score: node.score,
                    chars
                };
            });
            return {
                name: floor.name,
                cycles: floor.round_num,
                stars: floor.star_num,
                teams
            };
        });
        const end_time = response.groups[type - 1].end_time;
        let end_date = new Date(end_time.year, end_time.month - 1, end_time.day, end_time.hour + 5, end_time.minute);
        return {
            name: `Pure Fiction`,
            current_stars: response.star_num,
            max_stars: 12,
            recovery_time: end_date.getTime() / 1000,
            floors: floors
        };
    }

    async apocalypticShadow(type: number = 1, need_all: boolean = false): Promise<HsrEndgame> {
        const response: {
            star_num: number;
            has_data: boolean;
            groups: {
                end_time: {
                    day: number;
                    hour: number;
                    minute: number;
                    month: number;
                    year: number;
                };
                name_mi18n: string;
            }[];
            all_floor_detail: {
                is_fast: boolean;
                name: string;
                star_num: number;
                round_num: number;
                node_1: {
                    buff: {
                        name_mi18n: string;
                    };
                    score: number;
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[];
                };
                node_2: {
                    buff: {
                        name_mi18n: string;
                    };
                    score: number;
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[];
                };
            }[];
        } = await hoyoRequest(this.root_url + `challenge_boss?schedule_type=${type}&server=prod_official_usa&role_id=${this.uid}&need_all=${need_all}`, this.cookie);
        const floors = response.all_floor_detail.filter(floor => !floor.is_fast).map(floor => {
            const teams = [floor.node_1, floor.node_2].map(node => {
                const chars = node.avatars.map(char => {
                    return {
                        level: char.level,
                        name: hsrCharMap[char.id].name,
                        eidolon: char.rank
                    };
                });
                return {
                    buff: node.buff.name_mi18n,
                    score: node.score,
                    chars
                };
            });
            return {
                name: floor.name,
                cycles: floor.round_num,
                stars: floor.star_num,
                teams
            };
        });
        const end_time = response.groups[type - 1].end_time;
        let end_date = new Date(end_time.year, end_time.month - 1, end_time.day, end_time.hour + 5, end_time.minute);
        return {
            name: `Apocalyptic Shadow`,
            current_stars: response.star_num,
            max_stars: 12,
            recovery_time: end_date.getTime() / 1000,
            floors: floors
        };
    }

    async simulatedUniverse() {
        const response = await hoyoRequest(this.root_url + `rogue?server=prod_official_usa&role_id=${this.uid}&schedule_type=3&need_all=false`, this.cookie);
        this.su = {
            current: response.current_record.basic.current_rogue_score,
            max: response.current_record.basic.max_rogue_score,
            recovery_time: timeOnNext(7 * 24 * 60 * 60, 9 * 60 * 60 + 4 * 24 * 60 * 60)
        };
        return this.su;
    }

    async buildUserEmbed(): Promise<MessageCreateOptions> {
        if (!this.user_id) {
            throw new Error("missing user");
        }
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.eg) prom.push(this.endgameContent());
        if (!this.su) prom.push(this.simulatedUniverse());
        await Promise.all(prom);

        if (!this.bc || !this.eg || !this.su) throw new Error('something is undefined');

        let descLines = [];
        descLines.push(`**TP**: ${this.bc.trailblaze_power.current}/${this.bc.trailblaze_power.max}, capped <t:${this.bc.trailblaze_power.recovery_time}:R>`);
        descLines.push(`**Reserve TP**: ${this.bc.trailblaze_power.reserve}/2400`);
        const embed = new EmbedBuilder()
            .setTitle(`Honkai: Star Rail — ${this.uid}`)
            .setDescription(descLines.join("\n"))
            .setTimestamp();

        let assignmentLines: string[] = this.bc.assignments.map((assignment, i) => {
            return assignment.finished ? `**Assignment ${i + 1}** complete` : `**Assignment ${i + 1}** <t:${assignment.recovery_time}:R>`;
        });
        if (assignmentLines.length > 0) embed.addFields({ name: "Assignments", value: assignmentLines.join("\n") });

        // embed.addFields({name: `Check-in reset <t:${timeOnNext(24*60*60, 16*60*60)}:R>`, value: crossIfTrue(dailyResponse?.is_sign, `Daily check-in`)});
        let dailyLines = [];
        dailyLines.push(crossIfTrue(
            this.bc.daily.current >= this.bc.daily.max,
            `**Daily Training**: ${this.bc.daily.current}/${this.bc.daily.max}`
        ));
        embed.addFields({ name: `Daily reset <t:${this.bc.daily.recovery_time}:R>`, value: dailyLines.join("\n") });

        let weeklyLines = [];
        weeklyLines.push(crossIfTrue(
            this.bc.weekly.current >= this.bc.weekly.max,
            `**Echoes of War**: ${this.bc.weekly.current}/${this.bc.weekly.max}`
        ));
        weeklyLines.push(crossIfTrue(
            this.su.current >= this.su.max,
            `**SU score**: ${this.su.current}/${this.su.max}`
        ));
        embed.addFields({ name: `Weekly reset <t:${this.bc.weekly.recovery_time}:R>`, value: weeklyLines.join("\n") });

        let egLines = this.eg.map(e => {
            return crossIfTrue(
                e.current_stars >= e.max_stars,
                `**${e.name}**: ${e.current_stars}/${e.max_stars} ends <t:${e.recovery_time}:R>`
            );
        });
        if (egLines.length > 0) embed.addFields({ name: `MoC/PF/AS`, value: egLines.join("\n") });

        const refreshButton = new ButtonBuilder()
            .setCustomId(`hsr|${this.user_id}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(refreshButton);
        return { embeds: [embed], components: [row] };
    }

    async getTimers(): Promise<Resource[]> {
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.eg) prom.push(this.endgameContent());
        if (!this.su) prom.push(this.simulatedUniverse());
        await Promise.all(prom);

        if (!this.bc || !this.eg || !this.su) throw new Error('something is undefined');
        let timers = [];
        timers.push({
            name: "HSR Trailblaze Power",
            current: this.bc.trailblaze_power.current,
            max: this.bc.trailblaze_power.max,
            done: false,
            recovery_time: this.bc.trailblaze_power.recovery_time
        })
        timers.push({
            name: "HSR Daily Training",
            current: this.bc.daily.current,
            max: this.bc.daily.max,
            done: this.bc.daily.current == this.bc.daily.max,
            recovery_time: this.bc.daily.recovery_time
        })
        timers.push({
            name: "HSR Echo of War",
            current: this.bc.weekly.current,
            max: this.bc.weekly.max,
            done: this.bc.weekly.current == this.bc.weekly.max,
            recovery_time: this.bc.weekly.recovery_time
        })
        timers.push({
            name: "HSR Synchronicity Points",
            current: this.su.current,
            max: this.su.max,
            done: this.su.current == this.su.max,
            recovery_time: this.su.recovery_time
        })
        for (let endgame of this.eg) {
            timers.push({
                name: `HSR ${endgame.name}`,
                current: endgame.current_stars,
                max: endgame.max_stars,
                done: endgame.current_stars == endgame.max_stars,
                recovery_time: endgame.recovery_time
            })
        }
        return timers;
    }

    async codes(): Promise<any> {
        return codes(8, this.cookie);
    }

    async banners(): Promise<any> {
        return codes(8, this.cookie);
    }

    async redeem(code: string): Promise<any> {
        const response = await hoyoRequest(`https://sg-hkrpg-api.hoyolab.com/common/apicdkey/api/webExchangeCdkeyHyl?cdkey=${code}&game_biz=hkrpg_global&lang=en&region=prod_official_usa&t=${Date.now()}&uid=${this.uid}`, this.cookie);
        return response;
    }

    static async news() {
        return getPosts(172534910, '');
    }
}

export interface HsrSimulatedUniverse {
    current: number;
    max: number;
    recovery_time: number;
}

export interface HsrEndgame {
    name: string;
    current_stars: number;
    max_stars: number;
    recovery_time: number;
    floors?: {
        name: string;
        cycles: number;
        stars: number;
        teams: {
            buff?: string;
            score?: number;
            chars: {
                level: number;
                name: string;
                eidolon: number;
            }[];
        }[];
    }[];
}

export interface HsrBattleChronicle {
    trailblaze_power: {
        reserve: number;
        current: number;
        max: number;
        recovery_time: number;
    };
    daily: {
        current: number;
        max: number;
        recovery_time: number;
    };
    weekly: {
        current: number;
        max: number;
        recovery_time: number;
    };
    assignments: {
        finished: boolean;
        recovery_time: number;
    }[];
}
