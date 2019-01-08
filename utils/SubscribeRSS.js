"use strict";
const Discord = require('discord.js');
const CronJob = require('cron').CronJob;
let Parser = require('rss-parser');

class SubscribeRSS {
    constructor(channel, link) {
        this.parser = new Parser();
        //this.time = new Date(1546318780909);
        this.time = new Date();
        this.channel = channel;
        this.link = link;
        let sub = this;
        new CronJob('0 0 * * * *', function() {
            (async ()=>{
                let feed = await sub.parser.parseURL(sub.link);
                feed.items.filter((cur)=>{
                    let date = new Date(cur.pubDate);
                    return sub.time < date;
                }).forEach(item => {
                    sub.channel.send(`${feed.title}\n${item.title}\n${item.link}`)
                });
                sub.time = new Date();
            })().catch(e=>{
                console.error(e);
                sub.channel.send("`Error`").catch(err);
            })
        }, null, true, 'America/New_York');
    }

    test() {
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
            this.channel.send.apply(this.channel, params).catch(e=>{
                if (e.code == 50035) {
                    this.channel.send("`Message too large`").catch(err);
                } else {
                    console.error(e);
                    this.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            console.error(e);
            this.channel.send("`Error`").catch(err);
        })               
    }

    toString() {
        return "lol";
    }
}
module.exports = SubscribeRSS;