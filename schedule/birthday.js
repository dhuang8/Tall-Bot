import {CronJob} from 'cron';
import sql from '../util/SQLite.js';

export default class birthdayschedule {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 0 14 * * *', () => {
            console.log('checking birthdays');
            let users = sql.prepare(`SELECT user_id, birthday_channel FROM users WHERE birthday LIKE ?`).all(`%${new Date().toISOString().substring(4,10)}`);
            users.forEach(async user=>{
                //TODO fill and use birthday_channel
                (await client.channels.fetch(user.birthday_channel))?.send(`Happy birthday <@${user.user_id}>`);
            })
        }, null, true, "UTC");
        job.start();
    }
}