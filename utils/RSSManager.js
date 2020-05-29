"use strict";
const Discord = require('discord.js');
const CronJob = require('cron').CronJob;
const Parser = require('rss-parser');

class RSSManager {
    constructor(bot, sql, error_channel) {
        try {
            this.sql = sql;
            sql.prepare("CREATE TABLE IF NOT EXISTS feeds (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, url TEXT, UNIQUE(url));").run();
            sql.prepare("CREATE TABLE IF NOT EXISTS subscriptions (channel_id TEXT, feed_id INTEGER, FOREIGN KEY(feed_id) REFERENCES feeds(id), PRIMARY KEY (feed_id, channel_id)) WITHOUT ROWID;").run();
            this.bot = bot
            this.parser = new Parser();
            this.time = new Date();
            this.error_channel = error_channel;
            let sub = this;
            new CronJob('0 0 * * * *', function() {
                (async ()=>{
                    let feeds = sql.prepare("SELECT DISTINCT feed_id, feeds.title, feeds.url FROM subscriptions LEFT JOIN feeds ON feed_id=feeds.id").all()
                    let rss_prom = feeds.map(feed=>{
                        return {title:feed.title, prom: sub.parser.parseURL(feed.url), id:feed.feed_id}
                    })
                    for (let i=0;i<rss_prom.length;i++) {
                        let feed = rss_prom[i];
                        let channels = sql.prepare("SELECT channel_id FROM subscriptions WHERE feed_id=?").all(feed.id);
                        let rss = await feed.prom;
                        let desc = rss.items.filter(item=>{
                            let item_date = new Date(item.isoDate);
                            if (sub.time < item_date) {
                                return true;
                            }
                            return false;
                        }).map((item, index)=>{
                            return `**[${Discord.escapeMarkdown(item.title)}](${Discord.escapeMarkdown(item.link)})**`
                        });
                        if (desc.length>0) {
                            desc = desc.join("\n\n");

                            if (desc.length>2048) {
                                while (desc.length>2048) {
                                    desc = desc.replace(/\n\n.+$/,"")
                                }
                            }

                            let rich = new Discord.RichEmbed()
                                .setTitle(feed.title)
                                .setDescription(desc);
                            channels.forEach(channel=>{
                                sub.bot.channels.resolve(channel.channel_id).send(rich).catch(console.log);
                            })
                        }
                    }
                    sub.time = new Date();
                })().catch(e=>{
                    console.error(e);
                    sub.bot.channels.resolve(error_channel).send("`Error`").catch(console.log);
                })
            }, null, true, 'America/New_York');
        } catch(e) {
            console.error(e);
        }
    }

    async add(message, rss_url) {
        try {
            //check if already on list
            let stmt1 = this.sql.prepare("SELECT id, title FROM feeds WHERE title = ? COLLATE NOCASE").get(rss_url);
            if (stmt1) {
                let info = this.sql.prepare("INSERT OR IGNORE INTO subscriptions(feed_id, channel_id) VALUES (?, ?)").run(stmt1.id, message.channel.id)
                if (info.changes<1) {
                    return [`\`${stmt1.title} already on list\``]
                }
                return [`\`added ${stmt1.title} to list\``, this.subs(message)]
            };
            
            let a = /^.*steam(?:powered|community)\.com\/(?:app|news|games)\/?(?:\?appids=)?(\d+).*$/.exec(rss_url)
            if (a) {
                //https://steamcommunity.com/games/mysummercar/announcements/
                let valve = {
                    "504": "Dota2",
                    "730": "CSGO",
                    "440": "TF2",
                    "286160": "TabletopSimulator",
                    "516750": "mysummercar"
                };
                if (valve[a[1]]) a[1] = valve[a[1]]
                rss_url = `https://steamcommunity.com/games/${a[1]}/rss`
            }
            let sql = this.sql
            let stmt = sql.prepare("SELECT id, title FROM feeds WHERE url = ?")
            let row = stmt.get(rss_url);
            let feed_id;
            let title;
            if (row === undefined) {
                let feed = await this.parser.parseURL(rss_url);
                feed.title = feed.title.replace("RSS Feed","").trim();
                let info = sql.prepare("INSERT INTO feeds(title, url) VALUES (?,?)").run(feed.title, rss_url)
                feed_id = info.lastInsertRowid;
                title = feed.title
            } else {
                feed_id = row.id;
                title = row.title;
            }
            let info = sql.prepare("INSERT OR IGNORE INTO subscriptions(feed_id, channel_id) VALUES (?, ?)").run(feed_id, message.channel.id)
            if (info.changes<1) {
                return [`\`${title} already on list\``]
            }
            return [`\`added ${title} to list\``, this.subs(message)]
        } catch(e) {
            console.log(e)
            return ["`failed to add`"]
        }
    }

    subs(message) {
        let rows = this.__getSubs(message.channel.id);
        let desc_lines = rows.map((row, index)=>{
            return `${index+1}. ${row.title}`;
        });
        if (desc_lines.length < 1) return ["`No subscriptions`"];
        let rich = new Discord.RichEmbed()
            .setTitle("Subscriptions")
            .setDescription(desc_lines.join("\n"))
            .setFooter("Remove a subscription by using \".rss remove (number)\"")
        return rich
    }

    async list(message){
        let feeds = this.sql.prepare("SELECT feeds.title, feeds.url FROM subscriptions LEFT JOIN feeds ON feed_id=feeds.id WHERE channel_id = ?").all(message.channel.id);
        let rich = new Discord.RichEmbed()
            .setTitle("Recent Feeds");
        let rss_prom = feeds.map(feed=>{
            return {title:feed.title, prom: this.parser.parseURL(feed.url)}
        })
        let items = [];
        for (let feed_index in rss_prom) {
            let feed = rss_prom[feed_index];
            let rss = await feed.prom;
            rss = rss.items.slice(0,10).map(item=>{
                return {line: `${feed.title} — **[${item.title}](${item.link})**`, isoDate: item.isoDate}
            })
            items = items.concat(rss);
        }
        items.sort((a,b)=>{
            let d1 = new Date(a.isoDate);
            let d2 = new Date(b.isoDate);
            return d2-d1;
        });

        let desc = items.slice(0,10).map((item, index)=>{
            return `${item.line}`
        }).join("\n");
        rich.setDescription(desc);
        return [rich];
    }

    async test(message){
        let feeds = this.sql.prepare("SELECT feeds.title, feeds.url FROM subscriptions LEFT JOIN feeds ON feed_id=feeds.id WHERE channel_id = ?").all(message.channel.id);
        let rss_prom = feeds.map(feed=>{
            return {title:feed.title, prom: this.parser.parseURL(feed.url)}
        })
        let items = [];
        for (let feed_index in rss_prom) {
            let feed = rss_prom[feed_index];
            let rss = await feed.prom;
            rss = rss.items.slice(0,1).map(item=>{
                return {desc: `**[${item.title}](${item.link})**`, isoDate: item.isoDate, title: feed.title}
            })
            items = items.concat(rss);
        }
        items.sort((a,b)=>{
            let d1 = new Date(a.isoDate);
            let d2 = new Date(b.isoDate);
            return d2-d1;
        });

        if (items.length>0) {
            let rich = new Discord.RichEmbed()
                .setTitle(items[0].title)
                .setDescription(items[0].desc);
            return [rich];
        }
        return [`\`No feeds\``]
    }

    remove(message, arg){
        try {
            let isnum = /^\d+$/.test(arg)
            let num;
            if (!isnum) {
                //check if already on list
                let stmt1 = this.sql.prepare("SELECT id, title FROM feeds WHERE title = ? COLLATE NOCASE").get(arg);
                if (stmt1) {
                    num = stmt1.id
                } else {
                    return "`Subscription not found`"
                };
            } else {
                num = parseInt(arg)-1;
            }
            if (num<0) return "`Error`";
            let row = this.sql.prepare("SELECT feed_id, feeds.title FROM subscriptions LEFT JOIN feeds ON feed_id=feeds.id WHERE channel_id = ? LIMIT ?, 1").get(message.channel.id, num);
            if (row === undefined) return ["`Subscription not found`"]
            let info = this.sql.prepare("DELETE FROM subscriptions WHERE channel_id = ? AND feed_id = ?").run(message.channel.id, row.feed_id);
            if (info.changes<1) return ["`No changes`"];
            let rows = this.__getSubs(message.channel.id);
            
            let msg = `\`${row.title} removed\``
            let desc_lines = rows.map((row, index)=>{
                return `${index+1}. ${row.title}`;
            })
            if (desc_lines.length < 1) return [`\`${msg}\n\`No subscriptions left\``];
            let rich = new Discord.RichEmbed()
                .setTitle("Subscriptions")
                .setDescription(desc_lines.join("\n"))
                .setFooter("Remove a subscription by using \".rss remove (number)\"")
            return [msg, rich]
        } catch (e) {
            console.log(e)
            return ["`Error`"];
        }
    }

    __getSubs(channel_id) {
        return this.sql.prepare("SELECT id, channel_id, title, url FROM subscriptions LEFT JOIN feeds ON feed_id=feeds.id WHERE channel_id = ?").all(channel_id);
    }
}
module.exports = RSSManager;