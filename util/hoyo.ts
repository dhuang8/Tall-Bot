import { GenshinImpact, LanguageEnum, GenshinRegion, HonkaiStarRail } from 'hoyoapi'
import sql from './SQLite.js';

// async function generateInfo(genshin, userId){
//     const client = new GenshinImpact({
//         lang: LanguageEnum.ENGLISH,
//         region: GenshinRegion.USA,
//         cookie: genshin.cookie,
//         uid: genshin.uid
//     })

//     let dailyResponse = client.daily.info()
//     let staminaResponse = client.record.dailyNote();
//     let spiralResponse = client.record.spiralAbyss();
//     dailyResponse = await dailyResponse;
//     staminaResponse = await staminaResponse;
//     spiralResponse = await spiralResponse;

//     let descLines = [];
//     descLines.push(`**Resin**: ${staminaResponse.current_resin}/${staminaResponse.max_resin}, capped <t:${calcTimestampAfter(staminaResponse.resin_recovery_time)}:R>`)
//     descLines.push(`**Realm Currency**: ${staminaResponse.current_home_coin}/${staminaResponse.max_home_coin}, capped <t:${calcTimestampAfter(staminaResponse.home_coin_recovery_time)}:R>`)
    
//     let tTime = staminaResponse.transformer.recovery_time;
//     let milliAfter = tTime.Day*24*60*60 + tTime.Hour*60*60 + tTime.Minute*60 + tTime.Second;
//     milliAfter = parseInt(new Date().getTime()/1000 + milliAfter);
//     descLines.push(crossIfTrue(
//         false,
//         `**Transformer** ready <t:${milliAfter}:R>`
//     ));

//     const embed = new EmbedBuilder()
//         .setTitle('Genshin Impact — Battle Chronicle')
//         .setDescription(descLines.join("\n"))
//         .setTimestamp();
    
//     let expeditionLines = [];
//     staminaResponse.expeditions.forEach((expedition, i) => {
//         if (expedition.status === "Finished") {
//             expeditionLines.push(`**Expedition ${i+1}** finished`)
//         } else {
//             expeditionLines.push(`**Expedition ${i+1}** <t:${calcTimestampAfter(expedition.remained_time)}:R>`)
//         }
//     })
//     if (expeditionLines.length > 0) embed.addFields({name: "Expeditions", value: expeditionLines.join("\n")});
//     else embed.addFields({name: "Expeditions", value: "None"});
    
//     embed.addFields({name: `Web check-in reset <t:${timeOnNext(24*60*60, 16*60*60)}:R>`, value: crossIfTrue(dailyResponse?.is_sign, `Check-in`)});

//     let dailyLines = [];
//     dailyLines.push(crossIfTrue(
//         staminaResponse.finished_task_num == staminaResponse.total_task_num,
//         `**Daily Commissions**: ${staminaResponse.finished_task_num}/${staminaResponse.total_task_num}`
//     ))
//     dailyLines.push(crossIfTrue(
//         staminaResponse.is_extra_task_reward_received,
//         `Daily Commission Reward`
//     ))
//     embed.addFields({name: `Daily reset <t:${timeOnNext(24*60*60, 9*60*60)}:R>`, value: dailyLines.join("\n")});

//     let weeklyLines = [];
//     weeklyLines.push(crossIfTrue(
//         staminaResponse.remain_resin_discount_num == 0,
//         `**Trounce**: ${staminaResponse.resin_discount_num_limit-staminaResponse.remain_resin_discount_num}/${staminaResponse.resin_discount_num_limit}`
//     ));
//     embed.addFields({name: `Weekly reset <t:${timeOnNext(7*24*60*60, 9*60*60+4*24*60*60)}:R>`, value: weeklyLines.join("\n")});

//     let spiralLines = [];
//     spiralLines.push(crossIfTrue(
//         spiralResponse.max_floor == "12-3",
//         `**Max floor**: ${spiralResponse.max_floor}`
//     ));
//     spiralLines.push(crossIfTrue(
//         spiralResponse.total_star == 36,
//         `**Stars**: ${spiralResponse.total_star}/36`
//     ));
//     embed.addFields({name: `Spiral Abyss reset <t:${new Date(parseInt(spiralResponse.end_time)).getTime()}:R>`, value: spiralLines.join("\n")});

//     const refreshButton = new ButtonBuilder()
//         .setCustomId(`genshin|${userId}`)
//         .setLabel('Refresh')
//         .setStyle(ButtonStyle.Primary);

//     const row = new ActionRowBuilder()
//         .addComponents(refreshButton);
//     return {embeds: [embed], components: [row]};
// }

type User = {
    genshin_uid: string;
};

export class GenshinClient {
    user_id:string;

    constructor(user_id) {
        this.user_id = user_id;
        const user = sql.prepare("SELECT hsr_cookie, genshin_uid from users WHERE user_id = ?").get(user_id);
        if (user == null) throw new Error("`Missing uid and cookie`");
        const uid = user.genshin_uid;
        const cookie = user.hsr_cookie;
        if (uid == null || cookie == null) throw new Error("`Missing uid and cookie`");
        this.client = new GenshinImpact({
            lang: LanguageEnum.ENGLISH,
            region: GenshinRegion.USA,
            cookie,
            uid
        })
        this.uid = uid;
    }

    async battleChronicle() {
        let cur = Math.floor(Date.now()/1000);
        const response = await this.client.record.dailyNote();
        let transformer_time_obj = response.transformer.recovery_time;
        let transformer_time = ((transformer_time_obj.Day*24 + transformer_time_obj.Hour)*60 + transformer_time_obj.Minute)*60 + transformer_time_obj.Second
        const obj = {
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
                commission_reward: response.is_extra_task_reward_received
            },
            weekly: {
                half_cost_count: response.resin_discount_num_limit-response.remain_resin_discount_num,
                half_cost_max: response.resin_discount_num_limit
            },
            transformer: {
                obtained: response.transformer.obtained,
                recovery_time: cur + transformer_time
            }
        }
        obj.expeditions = response.expeditions.map(expedition => {
            return {
                recovery_time: cur + parseInt(expedition.remained_time)
            }
        });
        return obj;
    }

    async spiralAbyss() {
        const response = await this.client.record.spiralAbyss();
        return {
            max_floor: response.max_floor,
            current: response.total_star,
            max: 36,
            recovery_time: parseInt(response.end_time)
        }
    }
}

export class HsrClient {
    constructor(user_id) {
        this.user_id = user_id;
        const user = sql.prepare("SELECT hsr_cookie, hsr_uid from users WHERE user_id = ?").get(user_id);
        if (user == null) throw new Error("`Missing uid and cookie`");
        const uid = user.hsr_uid;
        const cookie = user.hsr_cookie;
        if (uid == null || cookie == null) throw new Error("`Missing uid and cookie`");
        this.client = new HonkaiStarRail({
            lang: LanguageEnum.ENGLISH,
            region: 'prod_official_usa',
            cookie,
            uid
        })
        this.client.record.region = 'prod_official_usa'
        this.uid = uid;
    }

    async info() {
        let cur = Math.floor(Date.now()/1000);
        const response = await this.client.daily.info();
        return response;
    }

    async battleChronicle() {
        let cur = Math.floor(Date.now()/1000);
        const response = await this.client.record.note();
        return {
            trailblaze_power: {
                reserve: response.current_reserve_stamina,
                current: response.current_stamina,
                max: response.max_stamina,
                recovery_time: cur + parseInt(response.stamina_recover_time),
            },
            daily: {
                current: response.current_train_score,
                max: response.max_train_score
            },
            weekly: {
                current: response.weekly_cocoon_limit-response.weekly_cocoon_cnt,
                max: response.weekly_cocoon_limit
            }
        }
    }

    async challenge(type = "1") {
        let cur = Math.floor(Date.now()/1000);
        const response = (await this.client.record.request.setQueryParams({
            server: this.client.record.region,
            role_id: this.client.record.uid,
            schedule_type: type,
            need_all: 'false',
        }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge')).response.data;
        let end_date = new Date(response.end_time.year, response.end_time.month-1, response.end_time.day, response.end_time.hour+5, response.end_time.minute);
        return {
            current_stars: response.star_num,
            max_stars: 36,
            recovery_time: end_date.getTime()/1000
        }
    }

    async challengeStory(type = "1") {
        const response = (await this.client.record.request.setQueryParams({
            server: this.client.record.region,
            role_id: this.client.record.uid,
            schedule_type: type,
            need_all: 'false',
        }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge_story')).response.data;
        console.log(response.groups[0]);
        const end_time = response.groups[0].end_time;
        let end_date = new Date(end_time.year, end_time.month-1, end_time.day, end_time.hour+5, end_time.minute);
        return {
            current_stars: response.star_num,
            max_stars: 12,
            recovery_time: end_date.getTime()/1000
        }
    }
}

export function crossIfTrue(test, string) {
    if (test) return `~~${string}~~`;
    return string
}

export function calcTimestampAfter(time) {
    return parseInt(new Date(Date.now()+time*1000).getTime()/1000)
}
