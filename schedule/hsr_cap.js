import sql from '../util/SQLite.js';
import {calcTimestampAfter} from '../util/hoyo.js';
import {sleep} from '../util/functions.js';
import { HonkaiStarRail, LanguageEnum } from 'hoyoapi'

export default class HsrCap {
    constructor(client) {
        this.updateStmt = sql.prepare("UPDATE users SET hsr_capped=?, hsr_next_update=? WHERE user_id = ?;")
        this.errorStmt = sql.prepare("UPDATE users SET hsr_next_update=? WHERE user_id = ?;")
        this.client = client;
        this.run();
    }

    async run() {
        while (true) {
            await this.update();
            let rows = sql.prepare("SELECT hsr_next_update from users WHERE hsr_cookie IS NOT NULL AND hsr_uid IS NOT NULL ORDER BY hsr_next_update LIMIT 1").all();
            let sleepMs = rows[0].hsr_next_update*1000-Date.now()+1000;
            this.client.sendToLog(`next hsr update ${sleepMs/1000} seconds. <t:${rows[0].hsr_next_update}:R>`);
            await sleep(Math.max(sleepMs, 60*1000));
        }
    }

    async update() {
        let cur = Date.now()/1000;
        const users = sql.prepare("SELECT user_id, hsr_cookie, hsr_uid, hsr_capped from users WHERE hsr_cookie IS NOT NULL AND hsr_uid IS NOT NULL AND hsr_next_update < ? ORDER BY hsr_next_update")
            .all(cur);
        return Promise.all(users.map(async user => {
            const discordUid = user.user_id;
            const oldCapped = user.hsr_capped;
            try {
                const hsrClient = new HonkaiStarRail({
                    lang: LanguageEnum.ENGLISH,
                    region: 'prod_official_usa',
                    cookie: user.hsr_cookie,
                    uid: user.hsr_uid
                })
                hsrClient.record.region = 'prod_official_usa'
                let staminaResponse = await hsrClient.record.note();
                this.client.sendToLog(discordUid, JSON.stringify(staminaResponse));
                const newCapped = staminaResponse.current_stamina >= staminaResponse.max_stamina-1 ? 1 : 0;
                let nextUpdate = calcTimestampAfter(staminaResponse.stamina_recover_time);
                if (!oldCapped && newCapped) {
                    this.client.users.fetch(discordUid).then(user => {
                        user.send(`\`Your Trailblazer Power is full.\``)
                    }).catch(e => {
                        this.client.sendToLog("Could not DM", `user: ${discordUid}`, e);
                    })
                }
                if (newCapped) nextUpdate = calcTimestampAfter(60*60*12)
                this.updateStmt.run(newCapped, nextUpdate, discordUid);
                this.client.sendToLog("Updated capped", `user: ${discordUid}`, `new capped: ${newCapped}`, `next update: ${nextUpdate}`);
            } catch (e) {
                this.client.sendToLog("Could not update hsr cap", `user: ${discordUid}`, e);
                this.errorStmt.run(calcTimestampAfter(60*60*12), discordUid);
            }
            return;
        }))
    }
}
