import {CronJob} from 'cron';
import sql from '../util/SQLite.js';
import { GenshinClient } from '../util/hoyo.ts';
import DiscordHelper from '../util/discord-helper.ts';

export default class GenshinLogin {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 2 16 * * *', function() {
            const users = sql.prepare("SELECT user_id, hsr_cookie, genshin_uid from users WHERE hsr_cookie IS NOT NULL AND genshin_uid IS NOT NULL").all();
            users.forEach(async user=>{
                try {
                    const genshin = new GenshinClient(user.user_id);
                    const response = genshin.dailySignIn();
                    DiscordHelper.sendToLog(`good`, user.user_id, JSON.stringify(response));
                } catch (e) {
                    DiscordHelper.sendToLog(`error`, user.user_id, e.toString());
                }
            })
        }, null, true, "UTC");
        job.start();
    }
}
