import {CronJob} from 'cron';
import sql from './SQLite.js';
import fetch from 'node-fetch';
import {MessageEmbed} from 'discord.js';

        
function getTimer (){
    let timers = [{
        name: "Drakkar",
        start: 65,
        end: 100,
        wp: "[&BDkMAAA=]"
    },{
        name: "Dragonstorm",
        start: 60,
        end: 80,
        wp: "[&BAkMAAA=]"
    },{
        name: "Echovald Forest",
        start: 30,
        end: 65,
        wp: "[&BMwMAAA=]"
    },{
        name: "Seitung Province",
        start: 90,
        end: 120,
        wp: "[&BGUNAAA=]"
    },{
        name: "New Kaineng City",
        start: 0,
        end: 30,
        wp: "[&BBkNAAA=]"
    },{
        name: "Dragon's End prep",
        start: 0,
        end: 60,
        wp: "[&BKIMAAA=]"
    },{
        name: "Dragon's End",
        start: 60,
        end: 120,
        wp: "[&BKIMAAA=]"
    },{
        name: "Auric Basin",
        start: 60,
        end: 80,
        wp: "[&BAIIAAA=]"
    },{
        name: "Tangled Depths",
        start: 30,
        end: 50,
        wp: "[&BPUHAAA=]"
    },{
        name: "Dragon Stand",
        start: 90,
        end: 155,
        wp: "[&BJMLAAA=]"
    },{
        name: "Verdant Brink",
        start: 10,
        end: 30,
        wp: "[&BAgIAAA=]"
    }]
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
        let line = `\`${timer.wp}\` **${timer.name}** ending in ${Math.round(timer.end-time)} min`;
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
        let line = `\`${timer.wp}\` **${timer.name}** starting in ${Math.round(timer.start-time)} min`
        return line;
    }).join("\n");
    embed.addField("**__Upcoming__**", upcomingtext);
    embed.setTitle(`Timer`)
    return embed;
}

function getWowTimer() {
    const wow_timers = [
        {
            name: "Community Feast",
            start: new Date('2022-12-14T18:00:00'),
            duration: 15*60*1000,
            every: 3.5*60*60*1000
        },
        {
            name: "Dragonbane Keep",
            start: new Date('2022-12-14T19:00:00'),
            duration: 30*60*1000,
            every: 2*60*60*1000
        }
    ]

    let now = Date.now();
    let in_progress_timers = [];
    let upcoming_timers = [];
    let timers = wow_timers.map(timer => {
        let end = ((timer.start.getTime() + timer.duration - now) % timer.every + timer.every) % timer.every;
        let start = end - timer.duration;
        return {start,end,name:timer.name};
    }).sort((a,b)=>{
        return a.start - b.start;
    }).forEach(timer=>{
        if (timer.start <= 0) in_progress_timers.push(timer);
        else upcoming_timers.push(timer);
    });
    
    let fields = [];
    if (in_progress_timers.length > 0) {
        let progresstext = in_progress_timers.map(timer=>{
            let line = `**${timer.name}** active for ${Math.abs(Math.round(timer.start / 60/1000))} min`;
            return line;
        }).join("\n");
        fields.push({name: "**__In progress__**", value: progresstext});
    }
    
    if (upcoming_timers.length > 0) {
        let upcomingtext = upcoming_timers.map(timer=>{
            let line = `**${timer.name}** starting in ${Math.round(timer.start / 60/1000)} min`
            return line;
        }).join("\n");
        fields.push({name: "**__Upcoming__**", value:upcomingtext});
    }
    return fields;
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
        
        var job2 = new CronJob('00 * * * * *', function() {
            let channels = sql.prepare(`SELECT channel_id, gw2timer FROM channels WHERE gw2timer IS NOT NULL;`).all();
            let embed = getTimer();
            embed.addFields(getWowTimer());
            channels.forEach(channel=>{
                try {
                    client.channels.resolve(channel.channel_id)?.messages.resolve(channel.gw2timer)?.edit({embeds: [embed]});
                } catch (e) {
                    console.log(e)
                    //ignore for now
                }
            })
        }, null, true, "UTC");
        job2.start();
    }
}

export default gw2tracker;