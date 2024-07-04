import sql from './SQLite.js';
import crypto from "crypto";
import { request, timeOnNext } from './functions.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageCreateOptions } from 'discord.js';
import config from '../config.json' with { type: "json" };

const ROOT_URL = `https://bbs-api-os.hoyolab.com/game_record/`;

let hsrCharRequest = request("https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/en/characters.json");
let hsrCharMap = JSON.parse(await hsrCharRequest);
hsrCharMap[8001].name = hsrCharMap[8002].name = "Trailblazer (Physical)"
hsrCharMap[8003].name = hsrCharMap[8004].name = "Trailblazer (Fire)"
hsrCharMap[8005].name = hsrCharMap[8006].name = "Trailblazer (Imaginary)"

let genshinCharMap: {[key: number]: string} = [];
request("https://api.uigf.org/dict/genshin/en.json").then(res => {
    let chars: {[key: string]: number} = res;
    Object.entries(chars).forEach(entry => {
        genshinCharMap[entry[1]] = entry[0];
    })
});

async function hoyoRequest(url: string, cookie: string) {
    const r = await request({
        url,
        headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Accept-Encoding": "gzip, deflate, br",
            "sec-ch-ua": '"Chromium";v="112", "Microsoft Edge";v="112", "Not:A-Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.1722.46",
            "x-rpc-app_version": "1.5.0",
            "x-rpc-client_type": "5",
            "x-rpc-language": "en-us",
            "ds": generateDS(),
            cookie
        }
    })
    if (r.data != null) return r.data;
    else throw new Error(`${r.retcode} ${r.message}`);
}

async function hoyoPost(url: string, cookie: string) {
    const r = await request({
        url,
        headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Accept-Encoding": "gzip, deflate, br",
            "sec-ch-ua": '"Chromium";v="112", "Microsoft Edge";v="112", "Not:A-Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.1722.46",
            "x-rpc-app_version": "1.5.0",
            "x-rpc-client_type": "5",
            "x-rpc-language": "en-us",
            cookie
        },
        method: 'POST'
    })
    if (r.data != null) return r.data;
    else throw new Error(`${r.retcode} ${r.message}`);
}

function generateDS() {
    const salt = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
    const date = new Date();
    const time = Math.floor(date.getTime() / 1e3).toString();
    let random = "";
    const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        const randomChar = characters.charAt(randomIndex);
        random += randomChar;
    }
    const hash = (0, crypto.createHash)("md5").update("salt=".concat(salt, "&t=").concat(time, "&r=").concat(random)).digest("hex");
    return "".concat(time, ",").concat(random, ",").concat(hash);
}

interface User {
    hsr_cookie?: string;
    genshin_uid?: number;
    hsr_uid?: number;
    hi3_uid?: number;
    zzz_uid?: number;
};

interface GenshinBattleChronicle {
    resin: {
        current: number,
        max: number,
        recovery_time: number,
    },
    realm_currency: {
        current: number,
        max: number,
        recovery_time: number
    },
    daily: {
        commission_count: number,
        commission_max: number,
        commission_reward: boolean,
        recovery_time: number
    },
    weekly: {
        half_cost_count: number,
        half_cost_max: number,
        recovery_time: number
    },
    transformer: {
        obtained: boolean,
        ready: boolean,
        recovery_time: number
    },
    expeditions: {
        finished: boolean,
        recovery_time: number
    }[]
};

interface ZzzBattleChronicle {
    battery_charge: {
        current: number,
        max: number,
        recovery_time: number,
    }
};

interface GenshinSpiralAbyss {
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
                }[]
            }[];
        }[];
    }[]
};

export class Hi3Client {
    user_id: string;
    uid: number;
    cookie: string;

    constructor(user_id: string) {
        const user = sql.prepare<string, User>("SELECT hsr_cookie, hi3_uid from users WHERE user_id = ?").get(user_id);
        if (user == null) throw new Error("`Missing user`");
        if (user.hi3_uid == null) throw new Error("`Missing uid`");
        if (user.hsr_cookie == null) throw new Error("`Missing cookie`");
        this.user_id = user_id;
        this.uid = user.hi3_uid;
        this.cookie = user.hsr_cookie;
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-public-api.hoyolab.com/event/mani/sign?lang=en-us&act_id=e202110291205111`, this.cookie);
        return response;
    }
}

export class ZzzClient {
    user_id: string;
    uid: number;
    cookie: string;
    bc?: ZzzBattleChronicle;
    signIn?: {checked: boolean};

    constructor(user_id: string) {
        const user = sql.prepare<string, User>("SELECT hsr_cookie, zzz_uid from users WHERE user_id = ?").get(user_id);
        if (user == null) throw new Error("`Missing user`");
        if (user.zzz_uid == null) throw new Error("`Missing uid`");
        if (user.hsr_cookie == null) throw new Error("`Missing cookie`");
        this.user_id = user_id;
        this.uid = user.zzz_uid;
        this.cookie = user.hsr_cookie;
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/extra_award?act_id=e202406031448091&lang=en-us`, this.cookie);
        return response;
    }

    async dailyInfo() {
        const response = await hoyoRequest(`https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/info?lang=en-us&act_id=e202406031448091`, this.cookie);
        this.signIn = {checked: response.is_sign};
        return this.signIn;
    }

    async battleChronicle(): Promise<ZzzBattleChronicle> {
        this.bc = {
            battery_charge: {
                current: 0,
                max: 240,
                recovery_time: 0,
            }
        }
        return this.bc;
        let cur = Math.floor(Date.now()/1000);
        const response = await hoyoRequest(ROOT_URL + `zzz/api/dailyNote?server=os_usa&role_id=${this.uid}`, this.cookie);
        this.bc = {
            battery_charge: {
                current: response.current_resin,
                max: response.max_resin,
                recovery_time: cur + parseInt(response.resin_recovery_time),
            }
        }
        // return this.bc;
    }

    async buildUserEmbed(): Promise<MessageCreateOptions> {
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.signIn) prom.push(this.dailyInfo());
        await Promise.all(prom);

        if (!this.bc) throw new Error('bc is undefined');
        if (!this.signIn) throw new Error('signIn is undefined');
    
        let descLines = [];
        descLines.push(`**Battery Power**: ${this.bc.battery_charge.current}/${this.bc.battery_charge.max}, capped <t:${this.bc.battery_charge.recovery_time}:R>`);
    
        const embed = new EmbedBuilder()
            .setTitle('Zenless Zone Zero — Battle Chronicle')
            .setDescription(descLines.join("\n"))
            .setTimestamp();
        
        // let expeditionLines: string[] = this.bc.expeditions.map((expedition, i) => {
        //     return expedition.finished ? `**Expedition ${i+1}** complete` : `**Expedition ${i+1}** <t:${expedition.recovery_time}:R>`;
        // })
        // if (expeditionLines.length > 0) embed.addFields({name: "Expeditions", value: expeditionLines.join("\n")});
        
        embed.addFields({name: `Web check-in reset <t:${timeOnNext(24*60*60, 16*60*60)}:R>`, value: crossIfTrue(this.signIn.checked, `Check-in`)});
    
        // let dailyLines = [];
        // dailyLines.push(crossIfTrue(
        //     this.bc.daily.commission_count >= this.bc.daily.commission_max,
        //     `**Daily Commissions**: ${this.bc.daily.commission_count}/${this.bc.daily.commission_max}`
        // ))
        // dailyLines.push(crossIfTrue(
        //     this.bc.daily.commission_reward,
        //     `Daily Commission Reward`
        // ))
        // embed.addFields({name: `Daily reset <t:${this.bc.daily.recovery_time}:R>`, value: dailyLines.join("\n")});
    
        // let weeklyLines = [];
        // weeklyLines.push(crossIfTrue(
        //     this.bc.weekly.half_cost_count >= this.bc.weekly.half_cost_max,
        //     `**Trounce**: ${this.bc.weekly.half_cost_count}/${this.bc.weekly.half_cost_max}`
        // ));
        // embed.addFields({name: `Weekly reset <t:${this.bc.weekly.recovery_time}:R>`, value: weeklyLines.join("\n")});
    
        // let spiralLines = [];
        // spiralLines.push(crossIfTrue(
        //     this.sa.stars >= this.sa.max_stars,
        //     `**Stars**: ${this.sa.stars}/${this.sa.max_stars}`
        // ));
        // embed.addFields({name: `Spiral Abyss reset <t:${this.sa.recovery_time}:R>`, value: spiralLines.join("\n")});
    
        const refreshButton = new ButtonBuilder()
            .setCustomId(`zzz|${this.user_id}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary);
    
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(refreshButton);
        return {embeds: [embed], components: [row]};
    }
}

export class GenshinClient {
    user_id: string;
    uid: number;
    cookie: string;
    bc?: GenshinBattleChronicle;
    sa?: GenshinSpiralAbyss;

    constructor(user_id: string) {
        const user = sql.prepare<string, User>("SELECT hsr_cookie, genshin_uid from users WHERE user_id = ?").get(user_id);
        if (user == null) throw new Error("`Missing user`");
        if (user.genshin_uid == null) throw new Error("`Missing uid`");
        if (user.hsr_cookie == null) throw new Error("`Missing cookie`");
        this.user_id = user_id;
        this.uid = user.genshin_uid;
        this.cookie = user.hsr_cookie;
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-hk4e-api.hoyolab.com/event/sol/sign?lang=en-us&act_id=e202102251931481`, this.cookie);
        return response;
    }

    async battleChronicle(): Promise<GenshinBattleChronicle> {
        let cur = Math.floor(Date.now()/1000);
        const response = await hoyoRequest(ROOT_URL + `genshin/api/dailyNote?server=os_usa&role_id=${this.uid}`, this.cookie);
        let transformer_time_obj = response.transformer.recovery_time;
        let transformer_time = ((transformer_time_obj.Day*24 + transformer_time_obj.Hour)*60 + transformer_time_obj.Minute)*60 + transformer_time_obj.Second
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
                recovery_time: timeOnNext(24*60*60, 9*60*60)
            },
            weekly: {
                half_cost_count: response.resin_discount_num_limit-response.remain_resin_discount_num,
                half_cost_max: response.resin_discount_num_limit,
                recovery_time: timeOnNext(7*24*60*60, 9*60*60+4*24*60*60)
            },
            transformer: {
                obtained: response.transformer.obtained,
                ready: transformer_time <= 0,
                recovery_time: cur + transformer_time
            },
            expeditions: []
        }
        this.bc.expeditions = response.expeditions.map((expedition: { status: string, remained_time: string; }) => {
            return {
                finished: expedition.status == 'Finished',
                recovery_time: cur + parseInt(expedition.remained_time)
            }
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
        } = await hoyoRequest(ROOT_URL + `genshin/api/spiralAbyss?server=os_usa&role_id=${this.uid}&schedule_type=2`, this.cookie);
        const floors = response.floors.map(floor => {
            const chambers = floor.levels.map(chamber => {
                const sides = chamber.battles.map(side => {
                    const team = side.avatars.map(char => {
                        return {
                            level: char.level,
                            name: genshinCharMap[char.id]
                        }
                    })
                    return {
                        num: side.index,
                        team
                    }
                })
                return {
                    num: chamber.index,
                    stars: chamber.star,
                    max_stars: chamber.max_star,
                    sides
                }
            })
            return {
                num: floor.index,
                max_stars: floor.max_star,
                stars: floor.star,
                chambers
            }
        })
        this.sa = {
            stars: response.total_star,
            max_stars: 36,
            recovery_time: parseInt(response.end_time),
            floors
        }
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
            .setTitle('Genshin Impact — Battle Chronicle')
            .setDescription(descLines.join("\n"))
            .setTimestamp();
        
        let expeditionLines: string[] = this.bc.expeditions.map((expedition, i) => {
            return expedition.finished ? `**Expedition ${i+1}** complete` : `**Expedition ${i+1}** <t:${expedition.recovery_time}:R>`;
        })
        if (expeditionLines.length > 0) embed.addFields({name: "Expeditions", value: expeditionLines.join("\n")});
        
        // embed.addFields({name: `Web check-in reset <t:${timeOnNext(24*60*60, 16*60*60)}:R>`, value: crossIfTrue(dailyResponse?.is_sign, `Check-in`)});
    
        let dailyLines = [];
        dailyLines.push(crossIfTrue(
            this.bc.daily.commission_count >= this.bc.daily.commission_max,
            `**Daily Commissions**: ${this.bc.daily.commission_count}/${this.bc.daily.commission_max}`
        ))
        dailyLines.push(crossIfTrue(
            this.bc.daily.commission_reward,
            `Daily Commission Reward`
        ))
        embed.addFields({name: `Daily reset <t:${this.bc.daily.recovery_time}:R>`, value: dailyLines.join("\n")});
    
        let weeklyLines = [];
        weeklyLines.push(crossIfTrue(
            this.bc.weekly.half_cost_count >= this.bc.weekly.half_cost_max,
            `**Trounce**: ${this.bc.weekly.half_cost_count}/${this.bc.weekly.half_cost_max}`
        ));
        embed.addFields({name: `Weekly reset <t:${this.bc.weekly.recovery_time}:R>`, value: weeklyLines.join("\n")});
    
        let spiralLines = [];
        spiralLines.push(crossIfTrue(
            this.sa.stars >= this.sa.max_stars,
            `**Stars**: ${this.sa.stars}/${this.sa.max_stars}`
        ));
        embed.addFields({name: `Spiral Abyss reset <t:${this.sa.recovery_time}:R>`, value: spiralLines.join("\n")});
    
        const refreshButton = new ButtonBuilder()
            .setCustomId(`genshin|${this.user_id}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary);
    
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(refreshButton);
        return {embeds: [embed], components: [row]};
    }

    async codes(): Promise<any> {
        return codes(2, this.cookie);
    }
}

interface HsrBattleChronicle {
    trailblaze_power: {
        reserve: number,
        current: number,
        max: number,
        recovery_time: number,
    },
    daily: {
        current: number,
        max: number,
        recovery_time: number
    },
    weekly: {
        current: number,
        max: number,
        recovery_time: number
    },
    assignments: {
        finished: boolean,
        recovery_time: number
    }[]
};

interface HsrEndgame {
    name: string,
    current_stars: number,
    max_stars: number,
    recovery_time: number,
    floors?: {
        name: string,
        cycles: number,
        stars: number,
        teams: {
            buff?: string;
            score?: number;
            chars: {
                level: number;
                name: string;
                eidolon: number;
            }[]
        }[]
    }[]
};

interface HsrSimulatedUniverse {
    current: number,
    max: number,
    recovery_time: number
};

const hsrStmt = sql.prepare<string, User>("SELECT hsr_cookie, hsr_uid from users WHERE user_id = ?")

export class HsrClient {
    user_id?: string;
    uid?: number;
    cookie: string;
    bc?: HsrBattleChronicle;
    eg?: HsrEndgame[]
    su?: HsrSimulatedUniverse;

    constructor(user_id: string | {uid: number}) {
        if (typeof user_id == 'string') {
            const user = hsrStmt.get(user_id);
            if (user == null) throw new Error("`Missing user`");
            if (user.hsr_uid == null) throw new Error("`Missing uid`");
            if (user.hsr_cookie == null) throw new Error("`Missing cookie`");
            this.user_id = user_id;
            this.uid = user.hsr_uid;
            this.cookie = user.hsr_cookie;
        } else {
            const user = hsrStmt.get(config.user_id);
            if (user == null) throw new Error("`Missing user`");
            if (user.hsr_cookie == null) throw new Error("`Missing cookie`");
            this.cookie = user.hsr_cookie;
            this.uid = user_id.uid;
        }
    }

    async info() {
        const response = await hoyoRequest(ROOT_URL + `hkrpg/api/avatar/info?server=prod_official_usa&role_id=${this.uid}&need_wiki=false`, this.cookie);
        return response;
    }

    async battleChronicle(): Promise<HsrBattleChronicle> {
        let cur = Math.floor(Date.now()/1000);
        const response = await hoyoRequest(ROOT_URL + `hkrpg/api/note?server=prod_official_usa&role_id=${this.uid}`, this.cookie);
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
                recovery_time: timeOnNext(24*60*60, 9*60*60)
            },
            weekly: {
                current: response.weekly_cocoon_limit-response.weekly_cocoon_cnt,
                max: response.weekly_cocoon_limit,
                recovery_time: timeOnNext(7*24*60*60, 9*60*60+4*24*60*60)
            },
            assignments: []
        }
        this.bc.assignments = response.expeditions.map((expedition: { status: string, remaining_time: string; }) => {
            return {
                finished: expedition.status === 'Finished',
                recovery_time: cur + parseInt(expedition.remaining_time ?? 0)
            }
        });
        return this.bc;
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-public-api.hoyolab.com/event/luna/os/sign?lang=en-us&act_id=e202303301540311`, this.cookie);
        return response;
    }

    async endgameContent() {
        const endgame: HsrEndgame[] = await Promise.all([this.memoryOfChaos(1), this.apocalypticShadow(1), this.pureFiction(1)]);
        this.eg = endgame.filter(a => a.recovery_time > Date.now()/1000).sort((a, b) => a.recovery_time - b.recovery_time);
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
            }
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
                    }[]
                },
                node_2: {
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[]
                }
            }[]
        } = await hoyoRequest(ROOT_URL + `hkrpg/api/challenge?schedule_type=${type}&server=prod_official_usa&role_id=${this.uid}&need_all=${need_all}`, this.cookie);
        const floors = response.all_floor_detail.filter(floor => !floor.is_fast).map(floor => {
            const teams = [floor.node_1, floor.node_2].map(node => {
                return {
                    chars: node.avatars.map(char => {
                        return {
                            level: char.level,
                            name: hsrCharMap[char.id].name,
                            eidolon: char.rank
                        }
                    })
                }
            });
            return {
                name: floor.name,
                cycles: floor.round_num,
                stars: floor.star_num,
                teams
            }
        })
        const end_time = response.end_time;
        let end_date = new Date(end_time.year, end_time.month-1, end_time.day, end_time.hour+5, end_time.minute);
        return {
            name: `Memory of Chaos ${type}`,
            current_stars: response.star_num,
            max_stars: 36,
            recovery_time: end_date.getTime()/1000,
            floors: floors
        }
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
                    }[]
                },
                node_2: {
                    buff: {
                        name_mi18n: string;
                    };
                    score: number;
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[]
                }
            }[]
        } = await hoyoRequest(ROOT_URL + `hkrpg/api/challenge_story?schedule_type=${type}&server=prod_official_usa&role_id=${this.uid}&need_all=${need_all}`, this.cookie);
        const floors = response.all_floor_detail.filter(floor => !floor.is_fast).map(floor => {
            const teams = [floor.node_1, floor.node_2].map(node => {
                const chars = node.avatars.map(char => {
                    return {
                        level: char.level,
                        name: hsrCharMap[char.id].name,
                        eidolon: char.rank
                    }
                })
                return {
                    buff: node.buff.name_mi18n,
                    score: node.score,
                    chars
                }
            });
            return {
                name: floor.name,
                cycles: floor.round_num,
                stars: floor.star_num,
                teams
            }
        })
        const end_time = response.groups[type-1].end_time;
        let end_date = new Date(end_time.year, end_time.month-1, end_time.day, end_time.hour+5, end_time.minute);
        return {
            name: `Pure Fiction ${type}`,
            current_stars: response.star_num,
            max_stars: 12,
            recovery_time: end_date.getTime()/1000,
            floors: floors
        }
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
                    }[]
                },
                node_2: {
                    buff: {
                        name_mi18n: string;
                    };
                    score: number;
                    avatars: {
                        level: number;
                        id: number;
                        rank: number;
                    }[]
                }
            }[]
        } = await hoyoRequest(ROOT_URL + `hkrpg/api/challenge_boss?schedule_type=${type}&server=prod_official_usa&role_id=${this.uid}&need_all=${need_all}`, this.cookie);
        const floors = response.all_floor_detail.filter(floor => !floor.is_fast).map(floor => {
            const teams = [floor.node_1, floor.node_2].map(node => {
                const chars = node.avatars.map(char => {
                    return {
                        level: char.level,
                        name: hsrCharMap[char.id].name,
                        eidolon: char.rank
                    }
                })
                return {
                    buff: node.buff.name_mi18n,
                    score: node.score,
                    chars
                }
            });
            return {
                name: floor.name,
                cycles: floor.round_num,
                stars: floor.star_num,
                teams
            }
        })
        const end_time = response.groups[type-1].end_time;
        let end_date = new Date(end_time.year, end_time.month-1, end_time.day, end_time.hour+5, end_time.minute);
        return {
            name: `Apocalyptic Shadow`,
            current_stars: response.star_num,
            max_stars: 12,
            recovery_time: end_date.getTime()/1000,
            floors: floors
        }
    }

    async simulatedUniverse() {
        const response = await hoyoRequest(ROOT_URL + `hkrpg/api/rogue?server=prod_official_usa&role_id=${this.uid}&schedule_type=3&need_all=false`, this.cookie);
        this.su = {
            current: response.current_record.basic.current_rogue_score,
            max: response.current_record.basic.max_rogue_score,
            recovery_time: timeOnNext(7*24*60*60, 9*60*60+4*24*60*60)
        }
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
        descLines.push(`**TP**: ${this.bc.trailblaze_power.current}/${this.bc.trailblaze_power.max}, capped <t:${this.bc.trailblaze_power.recovery_time}:R>`)
        descLines.push(`**Reserve TP**: ${this.bc.trailblaze_power.reserve}/2400`)
        const embed = new EmbedBuilder()
            .setTitle('Honkai: Star Rail — Battle Chronicle')
            .setDescription(descLines.join("\n"))
            .setTimestamp();

        let assignmentLines: string[] = this.bc.assignments.map((assignment, i) => {
            return assignment.finished ? `**Assignment ${i+1}** complete` : `**Assignment ${i+1}** <t:${assignment.recovery_time}:R>`;
        })
        if (assignmentLines.length > 0) embed.addFields({name: "Assignments", value: assignmentLines.join("\n")});
        
        // embed.addFields({name: `Check-in reset <t:${timeOnNext(24*60*60, 16*60*60)}:R>`, value: crossIfTrue(dailyResponse?.is_sign, `Daily check-in`)});
    
        let dailyLines = [];
        dailyLines.push(crossIfTrue(
            this.bc.daily.current >= this.bc.daily.max,
            `**Daily Training**: ${this.bc.daily.current}/${this.bc.daily.max}`
        ))
        embed.addFields({name: `Daily reset <t:${this.bc.daily.recovery_time}:R>`, value: dailyLines.join("\n")});
    
        let weeklyLines = [];
        weeklyLines.push(crossIfTrue(
            this.bc.weekly.current >= this.bc.weekly.max,
            `**Echoes of War**: ${this.bc.weekly.current}/${this.bc.weekly.max}`
        ));
        weeklyLines.push(crossIfTrue(
            this.su.current >= this.su.max,
            `**SU score**: ${this.su.current}/${this.su.max}`
        ));
        embed.addFields({name: `Weekly reset <t:${this.bc.weekly.recovery_time}:R>`, value: weeklyLines.join("\n")});

        let egLines = this.eg.map(e => {
            return crossIfTrue(
                e.current_stars >= e.max_stars,
                `**${e.name}**: ${e.current_stars}/${e.max_stars} ends <t:${e.recovery_time}:R>`
            )
        })
        if (egLines.length > 0) embed.addFields({name: `MoC/PF`, value: egLines.join("\n")});
    
        const refreshButton = new ButtonBuilder()
            .setCustomId(`hsr|${this.user_id}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary);
    
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(refreshButton);
        return {embeds: [embed], components: [row]};
    }

    async codes(): Promise<any> {
        return codes(8, this.cookie);
    }

    async banners(): Promise<any> {
        return codes(8, this.cookie);
    }
}

async function codes(id: number, cookie: string): Promise<any> {
    const response = await hoyoRequest(`https://bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material?game_id=${id}`, cookie);
    return response.modules;
}

async function banners(id: number, cookie: string): Promise<any> {
    const response = await hoyoRequest(`https://bbs-api-os.hoyolab.com/community/painter/wapi/banner/list?gids=${id}`, cookie);
    return response;
}

export function crossIfTrue(test: boolean, string: string) {
    if (test) return `~~${string}~~`;
    return string
}

export function calcTimestampAfter(time: number) {
    return Math.floor(new Date(Date.now()+time*1000).getTime()/1000);
}
