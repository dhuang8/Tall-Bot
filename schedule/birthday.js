import {CronJob} from 'cron';
import sql from '../util/SQLite.js';
import moment from 'moment-timezone';
import fetch from 'node-fetch';
import {MessageEmbed} from 'discord.js';



class birthdayschedule {
    constructor(client) {
        this.client = client;
        var job = new CronJob('0 0 0 * * *', function() {
            let users = sql.prepare(`SELECT user_id FROM users WHERE birthday LIKE ?`).all(`%${moment().format("-MM-DD")}`);
            users.forEach(user=>{
                //temp
                client.channels.resolve("536325719425286147").send(`Happy birthday <@${user.user_id}>`);
            })
        }, null, true, "America/Los_Angeles");
        job.start();
    }
}

export default birthdayschedule;