import {CronJob} from 'cron';
import sql from '../util/SQLite.js';
import { Hi3Client } from '../util/hoyo.ts';
import DiscordHelper from '../util/discord-helper.ts';

export default class Hi3Daily {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 2 16 * * *', function() {
            const users = sql.prepare("SELECT user_id, hsr_cookie, hi3_uid from users WHERE hsr_cookie IS NOT NULL AND hi3_uid IS NOT NULL").all();            
            users.forEach(async user=>{
                try {
                    const hi3 = new Hi3Client(user.user_id);
                    const response = hi3.dailySignIn();
                    DiscordHelper.sendToLog(`good`, user.user_id, JSON.stringify(response));
                } catch (e) {
                    DiscordHelper.sendToLog(`error`, user.user_id, e.toString());
                }
            })
        }, null, true, "UTC");
        job.start();
    }
}
