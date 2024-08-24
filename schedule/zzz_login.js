import {CronJob} from 'cron';
import sql from '../util/SQLite.js';
import { ZzzClient } from '../util/hoyo/ZzzClient.ts';
import DiscordHelper from '../util/discord-helper.ts';

export default class ZzzLogin {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 2 16 * * *', function() {
            const users = sql.prepare("SELECT user_id, hsr_cookie, zzz_uid from users WHERE hsr_cookie IS NOT NULL AND zzz_uid IS NOT NULL").all();
            users.forEach(async user=> {
                try {
                    const zzz = new ZzzClient(user.user_id);
                    const response = await zzz.dailySignIn();
                    DiscordHelper.sendToLog(`good`, user.user_id, JSON.stringify(response));
                } catch (e) {
                    DiscordHelper.sendToLog(`error`, user.user_id, e.toString());
                }
            })
        }, null, true, "UTC");
        job.start();
    }
}
