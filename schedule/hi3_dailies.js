import {CronJob} from 'cron';
import sql from '../util/SQLite.js';
import config from '../config.json' with { type: "json" };
import { HonkaiImpact, LanguageEnum, HonkaiRegion } from 'hoyoapi'

export default class Hi3Daily {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 2 16 * * *', function() {
            const users = sql.prepare("SELECT user_id, hsr_cookie, hi3_uid from users WHERE hsr_cookie IS NOT NULL AND hi3_uid IS NOT NULL").all();            
            users.forEach(async user=>{
                const user_id = user.user_id;
                const cookie = user.hsr_cookie;
                const hi3_uid = user.hi3_uid;
                try {
                    const hiClient = new HonkaiImpact({
                        lang: LanguageEnum.ENGLISH,
                        region: HonkaiRegion.USA,
                        cookie,
                        uid: hi3_uid
                    })
                    const claim = await hiClient.daily.claim()
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
