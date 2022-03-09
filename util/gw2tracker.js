import {CronJob} from 'cron';
import sql from './SQLite.js';
import fetch from 'node-fetch';
import {MessageEmbed} from 'discord.js';

        
function getTimer (){
    let timers = [{
        name: "Drakkar",
        start: 65,
        end: 100
    },{
        name: "Dragonstorm",
        start: 60,
        end: 80
    },{
        name: "Echovald Forest",
        start: 30,
        end: 65
    },{
        name: "Seitung Province",
        start: 90,
        end: 120
    },{
        name: "New Kaineng City",
        start: 0,
        end: 30
    },{
        name: "Dragon's End prep",
        start: 0,
        end: 60
    },{
        name: "Dragon's End",
        start: 60,
        end: 120
    }/*,{
        name: "Dragonfall",
        start: 90,
        end: 180
    }*/]
    let time = (new Date()).valueOf()/1000/60 % 120;
    let embed = new MessageEmbed();
    
    let progresstext = timers.map(timer=>{
        if ((time+120) < timer.end) {
            timer.start -= 120;
            timer.end -= 120;
        } else if (timer.end < time) {
            timer.start += 120;
            timer.end += 120;
        }
        return timer;
    }).filter(timer=>{
        return timer.start < time;
    }).sort((a,b)=>{
        return a.end - b.end;
    }).map(timer=>{
        let line = `**${timer.name}** ending in ${Math.round(timer.end-time)} min`;
        return line;
    }).join("\n");
    embed.addField("**__In progress__**", progresstext)
    
    let upcomingtext = timers.map(timer=>{
        if (timer.start < time) {
            timer.start += 120;
            timer.end += 120;
        }
        return timer;
    }).sort((a,b)=>{
        return a.start - b.start;
    }).map(timer=>{
        let line = `**${timer.name}** starting in ${Math.round(timer.start-time)} min`
        return line;
    }).join("\n");
    embed.addField("**__Upcoming__**", upcomingtext);
    embed.setTitle(`Timer`)
    return embed;
}

class gw2tracker {
    constructor(client) {
        this.client = client;
        var job = new CronJob('00 00 00 * * *', function() {
            let users = sql.prepare(`SELECT user_id, gw2key FROM users WHERE gw2key IS NOT NULL;`).all();
            let stmt = sql.prepare(`UPDATE users SET gw2tracker=? WHERE user_id=?`);
            users.forEach(async (user)=>{
                try {
                    let achievements = await fetch(`https://api.guildwars2.com/v2/account/achievements?ids=6385,6409`,{
                        headers: {
                            Authorization: `Bearer ${user.gw2key}`
                        }
                    }).then(res => res.text());
                    stmt.run(achievements, user.user_id);
                } catch (e) {
                    console.error(e)
                }
            })
        }, null, true, "UTC");
        job.start();
        
        var job2 = new CronJob('00 */5 * * * *', function() {
            let channels = sql.prepare(`SELECT channel_id, gw2timer FROM channels WHERE gw2timer IS NOT NULL;`).all();
            channels.forEach(channel=>{
                client.channels.resolve(channel.channel_id).messages.edit(channel.gw2timer, {embeds: [getTimer()]})/5;
            })
        }, null, true, "UTC");
        job2.start();
    }
}

export default gw2tracker;