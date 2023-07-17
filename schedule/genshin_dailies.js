import {CronJob} from 'cron';
import sql from '../util/SQLite.js';
import config from '../config.json' assert { type: "json" };
import { GenshinImpact, LanguageEnum, GenshinRegion } from 'hoyoapi'

export class GenshinDaily {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 2 16 * * *', function() {
            const users = sql.prepare("SELECT user_id, hsr_cookie, genshin_uid from users WHERE hsr_cookie IS NOT NULL AND genshin_uid IS NOT NULL").all();            
            users.forEach(async user=>{
                const user_id = user.user_id;
                const cookie = user.hsr_cookie;
                const genshin_uid = user.genshin_uid;
                try {
                    const genshinClient = new GenshinImpact({
                        lang: LanguageEnum.ENGLISH,
                        region: GenshinRegion.USA,
                        cookie,
                        uid: genshin_uid
                    })
                    const claim = await genshinClient.daily.claim()
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
