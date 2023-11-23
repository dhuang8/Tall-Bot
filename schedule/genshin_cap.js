import sql from '../util/SQLite.js';
import {calcTimestampAfter} from '../util/hoyo.js';
import {sleep} from '../util/functions.js';
import { GenshinImpact, LanguageEnum, GenshinRegion } from 'hoyoapi'

export default class GenshinCap {
    constructor(client) {
        this.updateStmt = sql.prepare("UPDATE users SET genshin_capped=?, genshin_next_update=? WHERE user_id = ?;")
        this.errorStmt = sql.prepare("UPDATE users SET genshin_next_update=? WHERE user_id = ?;")
        this.client = client;
        this.run();
    }

    async run() {
        while (true) {
            await this.update();
            let rows = sql.prepare("SELECT genshin_next_update from users WHERE hsr_cookie IS NOT NULL AND genshin_uid IS NOT NULL ORDER BY genshin_next_update LIMIT 1").all();
            let sleepMs = rows[0].genshin_next_update*1000-Date.now()+1000;
            this.client.sendToLog(`next genshin update ${sleepMs/1000} seconds. <t:${rows[0].genshin_next_update}:R>`);
            await sleep(Math.max(sleepMs, 60*1000));
        }
    }

    async update() {
        let cur = Date.now()/1000;
        const users = sql.prepare("SELECT user_id, hsr_cookie, genshin_uid, genshin_capped from users WHERE hsr_cookie IS NOT NULL AND genshin_uid IS NOT NULL AND genshin_next_update < ? ORDER BY genshin_next_update")
            .all(cur);
        return Promise.all(users.map(async user => {
            const discordUid = user.user_id;
            const oldCapped = user.genshin_capped;
            try {
                const giClient = new GenshinImpact({
                    lang: LanguageEnum.ENGLISH,
                    region: GenshinRegion.USA,
                    cookie: user.hsr_cookie,
                    uid: user.genshin_uid
                })
                let staminaResponse = await giClient.record.dailyNote();
                this.client.sendToLog(discordUid, JSON.stringify(staminaResponse));
                const newCapped = staminaResponse.current_resin >= 160-1 ? 1 : 0;
                let nextUpdate = calcTimestampAfter(staminaResponse.resin_recovery_time);
                if (!oldCapped && newCapped) {
                    this.client.users.fetch(discordUid).then(user => {
                        user.send(`\`Your Resin is full.\``)
                    }).catch(e => {
                        this.client.sendToLog("Could not DM", `user: ${discordUid}`, e);
                    })
                }
                if (newCapped) nextUpdate = calcTimestampAfter(60*60*12)
                this.updateStmt.run(newCapped, nextUpdate, discordUid);
                this.client.sendToLog("Updated capped", `user: ${discordUid}`, `new genshin capped: ${newCapped}`, `next genshin update: ${nextUpdate}`);
            } catch (e) {
                this.client.sendToLog("Could not update genshin cap", `user: ${discordUid}`, e);
                this.errorStmt.run(calcTimestampAfter(60*60*12), discordUid);
            }
            return;
        }))
    }
}
