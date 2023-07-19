import {CronJob} from 'cron';
import sql from '../util/SQLite.js';
import moment from 'moment-timezone';



class birthdayschedule {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 0 14 * * *', () => {
            let users = sql.prepare(`SELECT user_id FROM users WHERE birthday LIKE ?`).all(`%${moment().format("-MM-DD")}`);
            users.forEach(async user=>{
                //TODO fill and use birthday_channel
                (await client.channels.fetch("113049258172637184"))?.send(`Happy birthday <@${user.user_id}>`);
            })
        }, null, true, "UTC");
        job.start();
    }
}

export default birthdayschedule;