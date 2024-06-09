import sql from './SQLite.js';
import crypto from "crypto";
import { request, timeOnNext } from './functions.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageCreateOptions } from 'discord.js';

const ROOT_URL = `https://bbs-api-os.hoyolab.com/game_record/`

export function hoyoRequest(url: string, cookie: string) {
    return request({
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
    }).then(r => r.data)
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
    genshin_uid?: string;
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

interface GenshinSpiralAbyss {
    max_floor: number,
    current: number,
    max: number,
    recovery_time: number
};

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
        this.uid = parseInt(user.genshin_uid);
        this.cookie = user.hsr_cookie;
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
        const response = await hoyoRequest(ROOT_URL + `genshin/api/spiralAbyss?server=os_usa&role_id=${this.uid}&schedule_type=1`, this.cookie);
        this.sa = {
            max_floor: response.max_floor,
            current: response.total_star,
            max: 36,
            recovery_time: parseInt(response.end_time)
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
            this.sa.current >= this.sa.max,
            `**Max floor**: ${this.sa.max_floor}`
        ));
        spiralLines.push(crossIfTrue(
            this.sa.current >= this.sa.max,
            `**Stars**: ${this.sa.current}/${this.sa.max}`
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
    recovery_time: number
};

interface HsrSimulatedUniverse {
    current: number,
    max: number,
    recovery_time: number
};

export class HsrClient {
    user_id: string;
    uid: number;
    cookie: string;
    bc?: HsrBattleChronicle;
    eg?: HsrEndgame[]
    su?: HsrSimulatedUniverse;

    constructor(user_id: string) {
        const user = sql.prepare<string, User>("SELECT hsr_cookie, hsr_uid from users WHERE user_id = ?").get(user_id);
        if (user == null) throw new Error("`Missing user`");
        if (user.hsr_uid == null) throw new Error("`Missing uid`");
        if (user.hsr_cookie == null) throw new Error("`Missing cookie`");
        this.user_id = user_id;
        this.uid = parseInt(user.hsr_uid);
        this.cookie = user.hsr_cookie;
    }

    async info() {
        const response = await hoyoRequest(ROOT_URL + `hkrpg/api/avatar/info?server=prod_official_usa&role_id=${this.uid}&need_wiki=false`, this.cookie);
        return response;
    }

    async battleChronicle(): Promise<HsrBattleChronicle> {
        let cur = Math.floor(Date.now()/1000);
        const response = await hoyoRequest(ROOT_URL + `hkrpg/api/note?server=prod_official_usa&role_id=${this.uid}`, this.cookie);
        console.log(response);
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

    async endgameContent() {
        const endgame: HsrEndgame[] = await Promise.all([this.memoryOfChaos(1), this.memoryOfChaos(2), this.pureFiction(1), this.pureFiction(2)]);
        this.eg = endgame.filter(a => a.recovery_time > Date.now()/1000).sort((a, b) => a.recovery_time - b.recovery_time);
        return this.eg;
    }

    async memoryOfChaos(type: number = 1): Promise<HsrEndgame> {
        const response = await hoyoRequest(ROOT_URL + `hkrpg/api/challenge?schedule_type=${type}&server=prod_official_usa&role_id=${this.uid}&need_all=false`, this.cookie);
        const end_time = response.end_time;
        let end_date = new Date(end_time.year, end_time.month-1, end_time.day, end_time.hour+5, end_time.minute);
        return {
            name: `Memory of Chaos ${type}`,
            current_stars: response.star_num,
            max_stars: 36,
            recovery_time: end_date.getTime()/1000
        }
    }

    async pureFiction(type: number = 1): Promise<HsrEndgame> {
        const response = await hoyoRequest(ROOT_URL + `hkrpg/api/challenge_story?schedule_type=${type}&server=prod_official_usa&role_id=${this.uid}&need_all=false`, this.cookie);
        const end_time = response.groups[type-1].end_time;
        let end_date = new Date(end_time.year, end_time.month-1, end_time.day, end_time.hour+5, end_time.minute);
        return {
            name: `Pure Fiction ${type}`,
            current_stars: response.star_num,
            max_stars: 12,
            recovery_time: end_date.getTime()/1000
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
                `**${e.name}**: ${e.current_stars}/${e.max_stars}`
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
        return codes(6, this.cookie);
    }
}

async function codes(id: number, cookie: string): Promise<any> {
    const response = await hoyoRequest(`https://bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material?game_id=${id}`, cookie);
    return response.modules;
}

export function crossIfTrue(test: boolean, string: string) {
    if (test) return `~~${string}~~`;
    return string
}

export function calcTimestampAfter(time: number) {
    return Math.floor(new Date(Date.now()+time*1000).getTime()/1000);
}
