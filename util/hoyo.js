import { GenshinImpact, LanguageEnum, GenshinRegion, HonkaiStarRail } from 'hoyoapi'
import sql from '../util/SQLite.js';

export class GenshinClient {
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
                obtained: response.transformer.obtained
            }
        }
        if (response.resin_recovery_time !== "0") obj.resin.recovery_time = cur + parseInt(response.resin_recovery_time);
        if (response.home_coin_recovery_time !== "0") obj.realm_currency.recovery_time = cur + parseInt(response.home_coin_recovery_time);
        if (transformer_time > 0) {
            obj.transformer.recovery_time = cur + transformer_time;
            sql.prepare("UPDATE user_alarms SET next_time = ? WHERE user_id = ? AND alarm_id = ?").run(obj.transformer.recovery_time, this.user_id, this.id);
        }
        obj.expeditions = response.expeditions.map(expedition => {
            let expedition_obj = {status: expedition.status};
            if (expedition.status === 'Ongoing') expedition_obj.recovery_time = cur + parseInt(expedition.remained_time);
            return expedition_obj;
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

    async note() {
        return await this.client.record.note();
    }

    async challenge(type = "1") {
        return await this.client.record.request.setQueryParams({
            server: this.client.record.region,
            role_id: this.client.record.uid,
            schedule_type: type,
            need_all: 'false',
        }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge').response.data;
    }

    async challengeStory(type = "1") {
        return await this.client.record.request.setQueryParams({
            server: this.client.record.region,
            role_id: this.client.record.uid,
            schedule_type: type,
            need_all: 'false',
        }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge_story').response.data;
    }
}

export function crossIfTrue(test, string) {
    if (test) return `~~${string}~~`;
    return string
}

export function calcTimestampAfter(time) {
    return parseInt(new Date(Date.now()+time*1000).getTime()/1000)
}
