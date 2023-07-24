import sql from '../util/SQLite.js';
import { HonkaiStarRail, LanguageEnum } from 'hoyoapi'


function calcTimestampAfter(time) {
    return parseInt(new Date(Date.now()+time*1000).getTime()/1000)
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export class HsrCap {
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
            let sleepMs = rows[0].hsr_next_update*1000-Date.now();
            this.client.sendToLog(`next hsr update ${sleepMs/1000} seconds`);
            this.client.sendToLog(`next hsr update <t:${rows[0].hsr_next_update}:R>`);
            await sleep(Math.max(sleepMs, 60*1000));
        }
    }

    async update() {
        let cur = Date.now()/1000;
        const users = sql.prepare("SELECT user_id, hsr_cookie, hsr_uid, hsr_capped from users WHERE hsr_cookie IS NOT NULL AND hsr_uid IS NOT NULL AND hsr_next_update < ? ORDER BY hsr_next_update")
            .all(cur);
        return Promise.all(users.map(async user => {
            const discordId = user.user_id;
            const cookie = user.hsr_cookie;
            const hsrUid = user.hsr_uid;
            const oldCapped = user.hsr_capped;
            try {
                const hsrClient = new HonkaiStarRail({
                    lang: LanguageEnum.ENGLISH,
                    region: 'prod_official_usa',
                    cookie,
                    uid: hsrUid
                })
                hsrClient.record.region = 'prod_official_usa'
                let staminaResponse = await hsrClient.record.note();
                this.client.sendToLog(discordId, JSON.stringify(staminaResponse));
                const newCapped = staminaResponse.current_stamina >= staminaResponse.max_stamina-1 ? 1 : 0;
                let nextUpdate = calcTimestampAfter(staminaResponse.stamina_recover_time);
                if (!oldCapped && newCapped) {
                    this.client.users.fetch(discordId).then(user => {
                        user.send(`\`Your Trailblazer Power is full.\``)
                    }).catch(e => {
                        this.client.sendToLog("Could not DM", `user: ${discordId}`, e);
                    })
                }
                if (newCapped) nextUpdate = calcTimestampAfter(60*60*12)
                this.updateStmt.run(newCapped, nextUpdate, discordId);
                this.client.sendToLog("Updated capped", `user: ${discordId}`, `new capped: ${newCapped}`, `next update: ${nextUpdate}`);
            } catch (e) {
                this.client.sendToLog("Could not update hsr cap", `user: ${discordId}`, e);
                this.errorStmt.run(calcTimestampAfter(60*60*12), discordId);
            }
            return;
        }))
    }
}
