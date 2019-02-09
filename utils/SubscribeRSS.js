"use strict";
const Discord = require('discord.js');
const CronJob = require('cron').CronJob;
const Parser = require('rss-parser');

class SubscribeRSS {
    constructor(title, channels, link) {
        try {
            this.parser = new Parser();
            this.time = new Date();
            let sub = this;
            new CronJob('0 0 * * * *', function() {
                (async ()=>{
                    await sub.__lookup(0);
                    sub.time = new Date();
                })().catch(e=>{
                    console.error(e);
                    sub.channel.send("`Error`").catch(err);
                })
            }, null, true, 'America/New_York');
        } catch(e) {
            console.error(e);
        }
    }

    async test() {
        //7 days
        return this.__lookup(1000*60*60*24*7);
    }

    preview() {
         (async ()=>{
            let feed = await this.parser.parseURL(this.link);
            let rich = new Discord.RichEmbed();
            rich.setTitle(feed.title);
            let mes = feed.items.filter((cur, index)=>{
                return index<10;
            }).map((cur, index)=>{
                return `**${index+1}**. [${cur.title}](${cur.link})`;
            }).join("\n");
            rich.setDescription(mes);
            return ["",rich];
        })().then(params=>{
            sub.channels.forEach(channel=>{
                channel.send.apply(channel, params).catch(e=>{
                    if (e.code == 50035) {
                        channel.send("`Message too large`").catch(err);
                    } else {
                        console.error(e);
                        channel.send("`Error`").catch(err);
                    }
                })
            });
        }).catch(e=>{
            console.error(e);
        })               
    }

    async __lookup(timeOffset) {
        try {
            let feed = await this.parser.parseURL(this.link);
            feed.items.filter((cur)=>{
                let date = new Date(cur.pubDate);
                return (this.time-timeOffset) < date;
            }).forEach(item => {
                this.channels.forEach(channel=>{
                    channel.send(`${this.title}\n${item.title}\n<${item.link}>`)
                })
            });
        } catch(e) {
            console.error(e);
            this.channels[0].send("`Error`").catch(err);
        }
    }

    toString() {
        return "lol";
    }
}
module.exports = SubscribeRSS;