"use strict";
const Discord = require('discord.js');
const CronJob = require('cron').CronJob;
const Parser = require('rss-parser');
const fs = require('fs');
const rp = require('request-promise');

class RSSManager {
    constructor(bot) {
        try {
            this.bot = bot
            this.parser = new Parser();
            this.time = new Date();
            let sub = this;
            this.list = JSON.parse(fs.readFileSync("./data/RSS.json"));
            new CronJob('0 0 * * * *', function() {
                (async ()=>{
                    let combinedfeeds = await sub.__getList(null, sub.time);
                    combinedfeeds.forEach(feedobj=>{
                        /*
                        let rich = new Discord.RichEmbed();
                        rich.setTitle(feedobj.title);
                        rich.setURL(feedobj.feed.link);
                        rich.addField(feedobj.feed.title, `${feedobj.feed.contentSnippet.substring(0,200)}`);
                        */
                        feedobj.channels.forEach(channelid=>{
                            sub.bot.channels.get(channelid).send(`__**${feedobj.title}**__\n${feedobj.feed.title}\n<${feedobj.feed.link}>`);
                        })
                    })
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

    /*
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
    */

    async preview(channelid, oldTime) {
        let combinedlist = await this.__getList(channelid, oldTime);
        //console.log(combinedfeeds);

        let rich = new Discord.RichEmbed();
        let desc = combinedlist.slice(0,10).map((feedobj,i)=>{
            return `**${i+1}.** [${feedobj.title} - ${feedobj.feed.title}](${feedobj.feed.link})`
        }).join("\n");
        console.log(desc)
        rich.setTitle("Latest news");
        rich.setDescription(desc);
        return rich;
    }

    //returns array [{title: game_title, feed, channels},...]
    async __getList(channelid, oldTime) {
        let plist = [];
        this.list.filter((e)=>{
            if (channelid == null) return true;
            return e.channels.indexOf(channelid)>-1;
        }).forEach((cur)=>{
            plist.push({
                title: cur.title,
                channels: cur.channels,
                prom: this.parser.parseURL(cur.link)
            })
        })
        let combinedfeeds=[];

        for (let i=0;i<plist.length;i++){
            let rssobj = plist[i];
            let feeds = (await rssobj.prom).items;
            feeds.forEach(feed=>{
                let date = new Date(feed.isoDate);
                if (oldTime < date) {
                    combinedfeeds.push({
                        title: rssobj.title,
                        channels: rssobj.channels,
                        feed: feed
                    })
                }
            })
        }

        combinedfeeds.sort((a,b)=>{
            let d1 = new Date(a.feed.isoDate);
            let d2 = new Date(b.feed.isoDate);
            return d2-d1;
        })

        return combinedfeeds;
    }

    async __lookup(timeOffset) {
        try {
            let feed = await this.parser.parseURL(this.link);
            feed.items.filter((cur)=>{
                let date = new Date(cur.isoDate);
                return (this.time-timeOffset) < date;
            }).forEach(item => {
                this.channels.forEach(channel=>{
                    channel.send(`__**${this.title}**__\n${item.title}\n<${item.link}>`)
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
module.exports = RSSManager;