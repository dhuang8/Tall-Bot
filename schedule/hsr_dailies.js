import {CronJob} from 'cron';
import sql from '../util/SQLite.js';
import config from '../config.json' with { type: "json" };
import { HonkaiStarRail, LanguageEnum } from 'hoyoapi'

export default class HsrDaily {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 2 16 * * *', function() {
            const users = sql.prepare("SELECT user_id, hsr_cookie, hsr_uid from users WHERE hsr_cookie IS NOT NULL AND hsr_uid IS NOT NULL").all();            
            users.forEach(async user=>{
                const user_id = user.user_id;
                const cookie = user.hsr_cookie;
                const hsr_uid = user.hsr_uid;
                try {
                    const hsrClient = new HonkaiStarRail({
                        lang: LanguageEnum.ENGLISH,
                        region: 'prod_official_usa',
                        cookie,
                        uid: hsr_uid
                    })
                    const claim = await hsrClient.daily.claim()
                    let channel = await client.channels.fetch(config.channel_id);
                    if (claim?.status === "OK" || claim?.code === -5003) {
                        channel.send(`good\n${user_id}\n${JSON.stringify(claim)}`);
                    } else {
                        channel.send(`bad\n${user_id}\n${JSON.stringify(claim)}`);
                    }
                } catch (e) {
                    let channel = await client.channels.fetch(config.channel_id);
                    channel.send(`error\n${user_id}\n${e}`);
                }
            })
        }, null, true, "UTC");
        job.start();
    }
}
