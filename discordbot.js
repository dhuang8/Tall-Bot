"use strict";
const Discord = require('discord.js');
const request = require('request');
const fs = require('fs');
const moment = require('moment-timezone');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');
const execFile = require('child_process').execFile;
const CronJob = require('cron').CronJob;
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');
const RSSManager = require('./utils/RSSManager');
const translate = require('@vitalets/google-translate-api');
const Database = require("better-sqlite3");
const { CanvasRenderService } = require('chartjs-node-canvas');
const annotation = require('chartjs-plugin-annotation');
const rp = require('request-promise');
const unescape = require('unescape');

moment.tz.setDefault("America/New_York");

const bot = new Discord.Client({
//    apiRequestMethod: "burst"
});

let config = {
    adminID: null,
    botChannelID: null,
    errorChannelID: null,
    secretChannelID: null,
    weatherChannelID: null,
    guildID: null,
    api: {
        youtube:null,
        darksky:null,
        battlerite:null,
        hearthstone:null
    },
    token: null
};

const sql = new Database('sqlitedb/discord.sqlite'/*, { verbose: console.log }*/);
sql.prepare("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, points INTEGER, poeleague TEXT) WITHOUT ROWID;").run();
sql.prepare("CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel_id TEXT, message_text TEXT, message_id TEXT, time DATETIME, original_time DATETIME, url TEXT, triggered BOOLEAN DEFAULT(FALSE), FOREIGN KEY(user_id) REFERENCES users(user_id));").run();

let globalvars = {bot, config, sql}
module.exports = globalvars
const Command = require('./utils/Command');

/*
let lastPresenceMsg = "";
bot.on('presenceUpdate', function (oldUser, newUser) {
    try {
        //if (oldUser.presence.equals(newUser.presence)) return;
        let msg = "";
        //if (oldUser.status !== newUser.status) msg+=oldUser.status + "ↁE + newUser.status;
        let oldgame = (oldUser.presence.game ? oldUser.presence.game.name : oldUser.presence.game)
        let newgame = (newUser.presence.game ? newUser.presence.game.name : newUser.presence.game)
        let oldavatar = (oldUser.user.avatarURL ? oldUser.user.avatarURL : null)
        let newavatar = (newUser.user.avatarURL ? newUser.user.avatarURL : null)
        if (oldUser.presence.status !== "offline" && oldUser.presence.status !== "online" && newUser.presence.status == "online") msg += " returned from " + oldUser.presence.status;
        else if (oldUser.presence.status == "online" && newUser.presence.status !== "online") msg += " went " + newUser.presence.status;
        else if (oldUser.presence.status == "offline" && newUser.presence.status !== "offline") msg += " went " + newUser.presence.status;
        else if (oldUser.presence.status !== newUser.presence.status) msg += " went from " + oldUser.presence.status + " to " + newUser.presence.status;
        if (oldgame !== newgame) {
            if (oldgame === null) msg += " started playing " + newgame;
            else if (newgame === null) msg += " stopped playing " + oldgame;
            else {
                msg += " switched from playing " + oldgame + " to " + newgame;
            }
        }
        if (oldUser.nickname !== newUser.nickname) msg += " changed his username from " + oldUser.nickname + " to " + newUser.nickname;
        if (oldavatar !== newavatar) {
            msg += " changed his avatar from " + oldavatar + " to " + newavatar;
        }
        if (msg === "") {
            msg += " did something but I have no idea";
        }

        msg = moment().format('h:mma') + " " + newUser.user.username + " (" + newUser.id + ")" + msg;

        if (lastPresenceMsg !== msg) bot.channels.get(config.botChannelID).send(`\`${msg}\``).catch(err);
        lastPresenceMsg = msg;
    } catch (e) {
        console.error(e);
        //err(e)
    }
});
*/

bot.on('guildCreate', (guild) => {
    try {
        let msg = `${moment().format('h:mma')} ${guild.name} (${guild.id}) guild joined.`;
        bot.channels.get(config.botChannelID).send(`\`${msg}\``).catch(err);
    } catch (e) {
        err(e)
    }
})

bot.on('guildDelete', (guild) => {
    try {
        let msg = `${moment().format('h:mma')} ${guild.name} (${guild.id}) guild left.`;
        bot.channels.get(config.botChannelID).send(`\`${msg}\``).catch(err);
    } catch (e) {
        err(e)
    }
})


//start richembeds with a random color
let save = Discord.RichEmbed;
//let save = Discord.MessageEmbed;
Discord.RichEmbed = function (data) {
    let rich = new save(data);
    return rich.setColor("RANDOM"); //parseInt(Math.random() * 16777216));
}

function richQuote(message) {
    try {
        let rich = new Discord.RichEmbed();
        let username = (message.member && message.member.nickname) ? message.member.nickname: message.author.username;
        rich.setAuthor(username, message.author.displayAvatarURL, message.url)
        rich.setDescription(message.content);
        rich.setTimestamp(message.createdAt)
        return rich;
    } catch (e) {
        throw e;
    }
}

function err(error, loadingMessage, content) {
    if (config.errorChannelID) {
        bot.channels.get(config.errorChannelID).send(`${error.stack}`, {
            code: true,
            split: true,
            reply: config.adminID || null
        }).catch(function (e) {
            console.error(error.stack);
            console.error(e.stack);
            console.error("maybe missing bot channel");
        })
        if (loadingMessage != null) loadingMessage.edit(content).catch(err)
    } else {
        console.error(error);
    }
}
    
function requestpromise (link) {
    return new Promise((resolve, reject) => {
        request(link, function (error, response, body) {
            try {
                if (error) reject(error);
                else if (response.statusCode < 200 || response.statusCode >= 300) {
                    try {
                        let data = JSON.parse(body);
                        reject(new Error(body));
                    } catch (e) {
                        reject(new Error(`${response.statusCode} ${body}`))
                    }
                }
                //if (response.statusCode < 200 || response.statusCode >= 300) reject(response)
                resolve(body);
            }
            catch (e){
                console.error(error,response,body);
                reject(e);
            }
        })
    })
}

function requestpromiseheader (link) {
    return new Promise((resolve, reject) => {
        request(link, function (error, response, body) {
            if (error) reject(error);
            if (response.statusCode < 200 || response.statusCode >= 303) {
                try {
                    body = JSON.parse(body);
                    reject(body.text);
                } catch (e) {
                    reject(`${response.statusCode} ${body}`)
                }
            }
            //if (response.statusCode < 200 || response.statusCode >= 300) reject(response)
            resolve(response);
        })
    })
}

function htmldecode(a) {
    a = replaceAll(a, "&#39;", "'")
    a = replaceAll(a, "&amp;", "&")
    a = replaceAll(a, "&gt;", ">")
    a = replaceAll(a, "&lt;", "<")
    a = replaceAll(a, "&quote;", '"')
    a = replaceAll(a, "&apos;", "'")
    return a;
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


var CustomCommand = function (regex, callback) {
    this.regex = regex;
    this.callback = callback;
    this.important = false;
    this.time = moment().add(2, "hours");
}

CustomCommand.prototype.onMessage = function (message) {
    if (moment().isAfter(this.time)) {
        return false;
    }
    var a;
    if (a = this.regex.exec(message.content)) {
        return this.callback(message);
    }
    return false;
}

//data_array is in the format [[title1,return_data1],[title2,return_data2]]
function createCustomNumCommand (message, data_array) {
    let mes = "```";
    mes += data_array.map((cur, index)=>{
        return `${index+1}. ${cur[0]}`;
    }).join("\n");
    mes += "```";
    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
        var num = parseInt(message.content) - 1;
        if (num < data_array.length && num > -1) {
            if (typeof data_array[num][1] == "function"){
                data_array[num][1](message);
            } else {
                message.channel.send.apply(message.channel, data_array[num][1]).catch(err);
            }
            return true;
        }
        return false;
    })
    return mes;
}

//data_array is in the format [[title1,return_data1],[title2,return_data2]]
function createCustomNumCommand2 (message, data_array) {
    let mes = data_array.map((cur, index)=>{
        return `**${index+1}**. ${cur[0]}`;
    }).join("\n");

    if (mes.length>2048) {
        while (mes.length>2048-4) {
            mes = mes.replace(/\n.+$/,"")
        }
        mes = mes + "\n...";
    }
    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
        var num = parseInt(message.content) - 1;
        if (num < data_array.length && num > -1) {
            if (typeof data_array[num][1] == "function"){
                data_array[num][1](message);
            } else {
                message.channel.send.apply(message.channel, data_array[num][1]).catch(err);
            }
            return true;
        }
        return false;
    })
    return mes;
}

//data_array is in the format [[title1,return_data1],[title2,return_data2]]
function createCustomNumCommand3 (message, data_array) {
    let mes = data_array.map((cur, index)=>{
        return `**${index+1}**. ${cur[0]}`;
    }).join("\n");

    if (mes.length>2048) {
        while (mes.length>2048-4) {
            mes = mes.replace(/\n.+$/,"")
        }
        mes = mes + "\n...";
    }

    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
        var num = parseInt(message.content) - 1;
        if (num < data_array.length && num > -1) {
            if (typeof data_array[num][1] == "function"){
                (async()=>{
                    return await data_array[num][1](message);
                })().then(params=>{
                    if (Array.isArray(params)) {
                        message.channel.send.apply(message.channel, params).catch(e=>{
                            if (e.code == 50035) {
                                message.channel.send("`Message too large`").catch(err);
                            } else {
                                err(e);
                                message.channel.send("`Error`").catch(err);
                            }
                        });
                    } else {
                        message.channel.send(params).catch(e=>{
                            if (e.code == 50035) {
                                message.channel.send("`Message too large`").catch(err);
                            } else {
                                err(e);
                                message.channel.send("`Error`").catch(err);
                            }
                        });
                    }
                }).catch(e=>{
                    if (e.code == 50035) {
                        message.channel.send("`Message too large`").catch(err);
                    } else {
                        err(e);
                        message.channel.send("`Error`").catch(err);
                    }
                });
            } else {
                message.channel.send.apply(message.channel, data_array[num][1]).catch(err);
            }
            return true;
        }
        return false;
    })
    return mes;
}

function wordWrap(str,length){
    let regex = new RegExp(`(?=(.{1,${length}}(?: |$)))\\1`,"g");
    return str.replace(regex,"$1\n");
}

function convertTZ(s) {
    s = s.toLowerCase();
    let timezone = {
        "est": "America/New_York",
        "edt": "America/New_York",
        "cst": "America/Chicago",
        "cdt": "America/Chicago",
        "pst": "America/Los_Angeles",
        "pdt": "America/Los_Angeles",
        "nzdt": "Pacific/Auckland",
        "nzst": "Pacific/Auckland",
        "jst": "Asia/Tokyo",
        "utc": "Etc/UTC"
    }
    return timezone[s];
}

let rss;
fs.readFile("./config.json", "utf8", (err,data) => {
    if (err && err.code === "ENOENT") {
        fs.writeFile("./config.json", JSON.stringify(config, null, 4), (e) => {
            console.error(e);
        })
        console.error("paste discord token in config.json and restart");
    } else {
        config = JSON.parse(data);
        globalvars.config = config;
        bot.on('ready', () => {
            console.log("ready2")
            bot.user.setActivity('.help for list of commands',{type: "Watching"})
            bot.channels.get(config.errorChannelID).send(`\`${process.platform} ready2\``).catch(bot.err)
        });
        bot.once("ready", ()=>{
            console.log("ready")
            bot.channels.get(config.errorChannelID).send(`\`${process.platform} ready\``).catch(bot.err)
            let rows = sql.prepare("SELECT * FROM reminders WHERE triggered=false").all();
            rows.forEach(row=>{
                setReminder(row.id, row.user_id, row.channel_id, row.message_text, row.message_id, row.time, row.original_time, row.url);
            })
            fs.readFile("./data/RSS.json", "utf8", (err,data) => {
                if (err && err.code === "ENOENT") {
                    console.error("No RSS json file");
                } else {
                    try {
                        (async()=>{
                            rss = new RSSManager(bot, sql, config.errorChannelID);
                            //let rich = await rss.preview("536582876683304970",1000*60*60*24*7);
                            //bot.channels.get("536325719425286147").send(rich);
                        })().catch(e=>{
                            console.error(e);
                        })
                        /*
                        let rssarray = JSON.parse(data);
                        rssarray.forEach(rssobj =>{
                            try {
                                let channelarray = rssobj.channels.map(channelid=>{
                                    return bot.channels.get(channelid)
                                })
                                let sub = new SubscribeRSS(rssobj.title, channelarray, rssobj.link);
                                sub.test();
                            } catch (e) {
                                console.error(e)
                            }
                        })
                        */
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
            })                
        })
        bot.login(config.token).catch(console.error);
        if (config.weatherChannelID) {
            new CronJob('0 0 8 * * *', function() {
                (async ()=>{
                    return await weather("nyc");
                })().then(params=>{
                    bot.channels.get(config.weatherChannelID).send.apply(bot.channels.get(config.weatherChannelID), params).catch(e=>{
                        if (e.code == 50035) {
                            message.channel.send("`Message too large`").catch(err);
                        } else {
                            err(e);
                            message.channel.send("`Error`").catch(err);
                        }
                    });
                }).catch(e=>{
                    err(e);
                    message.channel.send("`Error`").catch(err);
                })
            }, null, true, 'America/New_York');
            
        }
    }
})
//},1000*10)
//    let config = JSON.parse(fs.readFileSync("./config.json"));
/*
const adminID = config.adminID;
const botChannelID = config.botChannelID;
const errorChannelID = config.errorChannelID;
const secretChannelID = config.secretChannelID;
const apikey = config.api;
const token = config.token;
const botlink = config.botlink;*/

let commands = [];    
let extraCommand = [];

commands.push(new Command({
    name: "test if bot",
    hidden: true,
    prefix: "",
    log: false,
    points: 0,
    func: (message, args)=>{
        return message.author.bot;
    }
}))

commands.push(new Command({
    name: "log outside messages and pings",
    hidden: true,
    hardAsserts: ()=>{return config.adminID && config.guildID},
    log: false,
    points: 0,
    func: (message, args)=>{
        if (!message.channel.members || !message.channel.members.get(config.adminID) || message.mentions.members.get(bot.user.id)) {
            (async()=>{
                try {
                    let msgguild = message.guild?message.guild.id:"whispers";
                    let msgchannel = message.channel.id;
                    let guildcat = bot.guilds.get(config.guildID).channels.find(chan=>chan.name==msgguild && chan.type=="category");
                    if (!guildcat) {
                        guildcat = await bot.guilds.get(config.guildID).createChannel(msgguild,"category");
                    }
                    let guildchan = bot.guilds.get(config.guildID).channels.find(chan=>chan.name==msgchannel && chan.type=="text");
                    if (!guildchan) {
                        guildchan = await bot.guilds.get(config.guildID).createChannel(msgchannel,"text");
                        guildchan.setParent(guildcat);
                    }
                    let msg= "`" + message.author.tag + ":` " + message.cleanContent
                    message.attachments.forEach(attach => {
                        msg += "\n" + attach.proxyURL;
                    })
                    if (message.mentions.users.get(bot.user.id)) {
                        msg += bot.users.get(config.adminID)
                    }
                    guildchan.send(msg);
                    
                    //in case something goes wrong
                    /*
                    let msg = `\`${moment().format('h:mma')} ${message.author.username} (${message.author.id}):\` 
${message.cleanContent}
\`${message.channel.type} channel ${(message.channel.name ? `${message.channel.name} (${message.channel.id})` : message.channel.id)}${((message.channel.guild && message.channel.guild.name) ? ` in guild ${message.channel.guild.name}(${message.channel.guild.id})` : "")}\``;
                    bot.channels.get(config.secretChannelID).send(msg).catch(err);
                    */
                } catch (e) {
                    err(e);
                } finally {
                }
            })().catch(e=>{
                console.error(e);
                err(e);
            })
        }
        return false;
    }
}))

commands.push(new Command({
    name: "send bot messages",
    hidden: true,
    hardAsserts: ()=>{return config.adminID && config.guildID},
    log: false,
    points: 0,
    func: (message, args)=>{
        if (message.channel.guild && message.channel.guild.id == config.guildID && message.author.id == config.adminID) {
            (async()=>{
                try {
                    bot.channels.get(message.channel.name).send(message.content);
                } catch (e) {
                    err(e);
                } finally {
                }
            })().catch(e=>{
                console.error(e);
                err(e);
            })
            return true;
        }
    }
}))
commands.push(new Command({
    name: "remove messages in bot and error channels",
    hidden: true,
    prefix: "",
    log: false,
    points: 0,
    hardAsserts: ()=>{return config.botChannelID && config.errorChannelID},
    func: (message, args)=>{
        if (message.channel.id === config.botChannelID || message.channel.id === config.errorChannelID) {
            message.delete().catch(err);
            return true;
        }
    }
}))
commands.push(new Command({
    name: "extra custom commands",
    hidden: true,
    prefix: "",
    log: false,
    points: 0,
    func: (message, args)=>{
        if (extraCommand[message.channel.id] != null) {
            return extraCommand[message.channel.id].onMessage(message);
        }
    }
}))
commands.push(new Command({
    name: "ping",
    regex: /^ping$/,
    prefix: "",
    testString: "ping",
    hidden: true,
    shortDesc: "pong",
    longDesc: "pong",
    points:0,
    func: (message, args)=>{
        message.channel.send("pong").catch(err);
        return true;
    }
}))
commands.push(new Command({
    name: "^",
    regex: /^\^$/,
    shortDesc: "responds with ^",
    prefix: "",
    testString: "^",
    hidden: true,
    log: true,
    points: 1,
    func: (message, args)=>{
        message.channel.send("^").catch(err);
        return true;
    }
}))
commands.push(new Command({
    name: "k",
    regex: /^k$/i,
    testString: "k",
    shortDesc: "responds with some long message",
    longDesc: "responds with \"You fucking do that every damn time I try to talk to you about anything even if it's not important you just say K and to be honest it makes me feel rejected and unheard like nothing would be better that that bullshit who the fuck just says k after you tell them something important I just don't understand how you think that's ok and I swear to god you're probably just gonna say k to this but when you do you'll know that you're slowly killing me inside\"",
    prefix: "",
    hidden: true,
    log: true,
    points: 1,
    func: (message, args)=>{
        let msg = `You fucking do that every damn time I try to talk to you about anything even if it's not important you just say K and to be honest it makes me feel rejected and unheard like nothing would be better that that bullshit who the fuck just says k after you tell them something important I just don't understand how you think that's ok and I swear to god you're probably just gonna say k to this but when you do you'll know that you're slowly killing me inside`;
        message.channel.send(msg).catch(err);
        return true;
    }
}))
commands.push(new Command({
    name: "time",
    regex: /^time$/i,
    testString: "time",
    prefix: ".",
    requirePrefix: false,
    shortDesc: "responds with the time at several time zones",
    longDesc: "responds with the time in UTC, CST, EST, PST, NZST, and JST",
    log: true,
    points: 1,
    func: (message, args)=>{
        let fullZones = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC"];
        //msg += fullName;
        let inputTime = moment();
        let msg = inputTime.valueOf() + "\n";
        msg += fullZones.map((v) => {
            return inputTime.tz(v).format('ddd, MMM Do YYYY, h:mma z')
        }).join("\n");
        msg = "`" + msg + "`";
        message.channel.send(msg).catch(err);
        return true;
    }
}))
commands.push(new Command({
    name: "sv",
    regex: /^sv (.*)$/,
    testString: ".sv deus ex machina",
    shortDesc: "returns shadowverse card info",
    longDesc: `.sv (search term)
returns shadowverse card info`,
    prefix: ".",
    requirePrefix: true,
    log: true,
    points: 1,
    func: (message, args)=>{
        (async ()=>{
            let lm = message.channel.send("`Loading...`");
            let body = await requestpromise({
                url: "https://shadowverse-portal.com/cards?card_name=" + encodeURIComponent(args[1]),
                headers: {
                    "Accept-Language": "en-us"
                }
            })
            let $ = cheerio.load(body);
            let list = [];
            let responseMessage = [];
            $(".el-card-detail").each(function (i, e) {
                let pic = $(this).find(".el-card-detail-image").first().attr("data-src").replace(/(\?.+)/g, "");
                let name = $(this).find(".el-card-detail-name").first().text().trim();
                let link = "https://shadowverse-portal.com" + $(this).attr("href");
                let tribe = $(this).find(".el-card-detail-tribe-name").first().text().trim();
                let desc = "";
                let rich = new Discord.RichEmbed();
                rich.setImage(pic)
                rich.setTitle(htmldecode(name))
                rich.setURL(link)
                if (tribe !== "-") desc += tribe + "\n";
                $(this).find(".el-card-detail-status").each(function (i, e) {
                    if ($(this).find(".el-card-detail-status-header").text().trim() == "") {
                        desc += htmldecode($(this).find(".el-card-detail-skill-description").html().trim().replace(/<br>/g, "\n"));
                    } else {
                        let fieldtitle = $(this).find(".el-label-card-state").text().trim();
                        let atk = $(this).find(".is-atk").text().trim();
                        let def = $(this).find(".is-life").text().trim();
                        let desc = htmldecode($(this).find(".el-card-detail-skill-description").html().trim().replace(/<br>/g, "\n"));
                        rich.addField(htmldecode(fieldtitle), `${atk}/${def}\n${desc}`)
                    }
                })
                rich.setDescription(htmldecode(desc));
                list.push([name, rich]);
            })
            if (list.length < 1) {
                responseMessage = ["`No results`"];
            } else if (list.length == 1) {
                responseMessage = ["", {
                    embed: list[0][1]
                }];
            } else {
                let msg = "```" + list.map((v, i) => {
                    return `${i + 1}. ${v[0]}`
                }).join("\n") + "```";
                extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                    var num = parseInt(message.content) - 1;
                    if (num < list.length && num > -1) {
                        message.channel.send("", {
                            embed: list[num][1]
                        }).catch(err);
                        return true;
                    }
                    return false;
                })
                responseMessage = [msg];
            }
            let loadingMess = await lm;
            loadingMess.edit.apply(loadingMess,responseMessage).catch(err);
        })().catch(e=>{
            console.error(e);
            err(e);
        })
    }
}))

let timeouts=[];

function createReminder(user_id, channel_id, message_text, message_id, time, original_time, url) {
    try {
        let info = sql.prepare("INSERT INTO reminders(user_id, channel_id, message_text, message_id, time, original_time, url) VALUES (?,?,?,?,?,?,?)").run(user_id, channel_id, message_text, message_id, time.valueOf(), original_time, url);
        if (info.changes<1) throw new Error("Could not create reminder");
        let now = moment();
        let rich = Discord.RichEmbed();
        rich.setTitle(message_text);
        rich.setDescription(`Setting reminder to ${time.format("MMM D YYYY h:mm:ss a z")}`);
        setReminder(info.lastInsertRowid, user_id, channel_id, message_text, message_id, time.valueOf(), original_time, url)
        return rich;
    } catch (e) {
        err (e)
    }
}

function setReminder(id, user_id, channel_id, message_text, message_id, time, original_time, url) {
    try {
        let now = moment();
        let wait = (time - now.valueOf());
        //handle long timeouts;
        if (wait > 2147483647) return;
        let user = bot.users.get(user_id)
        if (!user) throw new Error("Could find user");
        let channel = bot.channels.get(channel_id)
        if (!channel) throw new Error("Could find channel");

        timeouts[id] = bot.setTimeout(function () {
            let info = sql.prepare("UPDATE reminders SET triggered=TRUE where id=?").run(id);
            if (info.changes<1) throw new Error("Could not modify reminder");
            let rich = new Discord.RichEmbed();
            let member = channel.members?channel.members.get(user):null
            let username;
            if (member && member.nickname) {
                username = member.nickname;
            } else {
                username = user.username;
            }
            rich.setAuthor(username, user.displayAvatarURL );
            rich.setDescription(message_text);
            rich.setTimestamp(original_time);
            bot.channels.get(channel_id).send(`reminder: ${message_text}\n${url}`, {
                reply: user,
                embed: rich
            });
        }, wait)
    } catch (e) {
        err (e)
    }
}

function cancelReminder(id) {
    let info = sql.prepare("UPDATE reminders SET triggered=TRUE where id=?").run(id);
    if (timeouts[id]) bot.clearTimeout(timeouts[id]);
    timeouts[id] = null;
    if (info.changes<1) return false;
    return true
}

commands.push(new Command({
    name: "reminder",
    regex: /^remind(?:me|er) (.+)$/i,
    prefix: ".",
    requirePrefix: true,
    testString: '.reminder this is a test message 5 seconds',
    shortDesc: "sends a message to yourself at a later time",
    longDesc: {title:`.reminder (message_with_timestring) or .reminder (action) (arg) or .reminder (message) (num) (unit_of_time)`,
        description: `returns nothing`,
        fields: [{
            name: `message_with_timestring`,
            value: `Must contain a timestring somewhere in the message. A timestring is a parsable string in some form of M/DD/YYYY h:mm am/pm est or YYYY-MM-DD h:mm am/pm est. All parts are optional but at least 1 part must exist. If it doesn't work, try moving the time string to the beginning or end or including more parts.`
        }, {
            name: `action`,
            value: `.reminder list - returns list of pending reminders
.reminder cancel - cancel the latest reminder"
.reminder cancel (num) - cancel a reminder using the number from ".reminder list"`
        }, {
            name: `num unit_of_time`,
            value: `set a reminder to (num) (unit_of_time) in the future. Unit of time includes: sec, min, hour, day, week, month, year. Can be 1 letter shorthand (4s) or full word (4 seconds). Must be at the end.`
        }, {
            name: `Examples`,
            value: `.reminder cancel 1 - cancels the first reminder from ".reminder list"
.reminder wake up in 7 hours - sets a reminder to go off in 7 hours
.reminder Tom's birthday on 12/31 - sets a reminder to go off at Dec 31 12:00am est of this year
.reminder Earth will melt in 2070 - sets a reminder to go off Jan 1 2070 12:00am est
.reminder 2020-08-31 12:00am jst Japan builds an anime super weapon - sets a reminder to go off Oct 31 2020 12:00am JST`
        }]
    },
    log: true,
    points: 1,
    func: (message, args)=>{
        (async()=>{
            function listReminders() {
                let rows = sql.prepare("SELECT * FROM reminders WHERE user_id=? AND triggered=false").all(message.author.id);
                if (rows.length<1) {
                    let rich = new Discord.RichEmbed()
                        .setTitle("No reminders left")
                    return rich;
                } 
                let lines = rows.map((reminder,index)=>{
                    return `**${index+1}.** ${reminder.message_text}`
                })
                let rich = new Discord.RichEmbed()
                    .setTitle("Reminders")
                    .setDescription(lines.join("\n"))
                    .setFooter(`Cancel a reminder with ".reminder cancel (number)"`)
                return rich;
            }
            if (/^list$/i.test(args[1])) {
                return listReminders();
            } else if (/^cancel$/i.test(args[1])) {
                let row = sql.prepare("SELECT row_number() OVER (ORDER BY original_time) fake_id, id FROM reminders WHERE user_id=? AND triggered=false ORDER BY original_time DESC LIMIT 1").get(message.author.id);
                if (row && cancelReminder(row.id)) {
                    return [`\`Canceled reminder ${row.fake_id}\``, listReminders()]
                }
                return `\`Failed to cancel reminder\``;
            }
            let a = /cancel (\d+)$/i.exec(args[1]);
            if (a) {
                let fake_id = parseInt(a[1])
                let row = sql.prepare("SELECT id, fake_id FROM (SELECT row_number() OVER (ORDER BY original_time) fake_id, id FROM reminders WHERE user_id=? AND triggered=false) WHERE fake_id=?").get(message.author.id,fake_id);
                if (row && cancelReminder(row.id)) {
                    return [`\`Canceled reminder ${row.fake_id}\``, listReminders()]
                }
                return `\`Failed to cancel reminder\``;
            }
            let time;
            a = /(?:(?:.*) |^)(a|\d+) ?((?:sec(?:ond)?|min(?:ute)?|hour|day|week|month|year)s?|[smhdwy])$/i.exec(args[1]);
            if (a) {
                if (a[1]==="a") {
                    a[1] === 1;
                } else {
                    a[1] = parseInt(a[1]);
                }
                if (a[2] === "sec") a[2]="s"
                else if (a[2] === "min") a[2]="m"
                time = moment().tz("America/New_York").add(a[1],a[2]);
            } else {
                let a = /(.+) (est|cst|pst|edt|pdt|cdt|nzdt|jst|utc)(?:$| .+)/i.exec(args[1]);
                let timezone_name="America/New_York"
                if (a) {
                    timezone_name = convertTZ(a[2])
                    time = moment.tz(a[1], ["YYYY-MM-DD h:mm a", "M/DD/YYYY h:mm a", "M/DD h:mm a", "M-DD h:mm a", "M-DD h a", "M/DD h a", "h:mm a", "M/DD", "M-DD", "YYYY-MM-DD", "M/DD/YYYY"], timezone_name);
                } else {
                    time = moment.tz(args[1], ["YYYY-MM-DD h:mm a", "M/DD/YYYY h:mm a", "M/DD h:mm a", "M-DD h:mm a", "M-DD h a", "M/DD h a", "h:mm a", "M/DD", "M-DD", "YYYY-MM-DD", "M/DD/YYYY"], timezone_name);
                }
            }
            let now = moment.tz();
            if (!time.isValid()) return "`Could not parse time`"
            if (now.isAfter(time)) return `\`Parsed time (${time.format("MMM D YYYY h:mm:ssa z")}) has passed\``;
            return createReminder(message.author.id, message.channel.id, args[1], message.id, time, message.createdTimestamp, message.url);
        })().then(params=>{
            if (!Array.isArray(params)) params = [params];
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;

        /*
        let reminder = args[1];
        let timestring = args[2];
        //.remindme ("message") (num) (sec/min/hour/etc)
        let b = /^(\d+) (\w+)$/i.exec(timestring);
        if (b) {
            let num = parseInt(b[1])
            let time = moment().add(num, b[2])
            if (!time.isValid()) return true;
            createReminder(time);
            return true;
        }
        //.remindme ("message") (12:00am utc)
        b = /(\d{1,2}(?::\d{2})? ?[ap]m) (est|cst|pst|edt|pdt|cdt|nzdt|jst|utc)/i.exec(timestring);
        if (b) {
            let shortZones = ["est", "cst", "pst", "nzdt", "jst", "utc"];
            let fullZones = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC"];
            let fullName = fullZones[shortZones.indexOf(b[2])];
            let inputTime = moment.tz(b[1], "h:mma", fullName).subtract(1, 'days');
            if (!inputTime.isValid()) return;
            if (inputTime.diff(moment()) < 0) {
                inputTime.add(1, 'days');
            }
            if (inputTime.diff(moment()) < 0) {
                inputTime.add(1, 'days');
            }
            let time = inputTime;
            let rich = createReminder(message.author.id, message.channel.id, reminder, time);
            message.reply("", {
                embed: rich
            });
        } else {
            let time = moment.utc(new Date(timestring));
            if (!time.isValid()) return false;
            createReminder(time);
        }
        return true;
        */
    }
}))
commands.push(new Command({
    name: "cancelremindme",
    regex: /^cancelremindme (\d+)$/i,
    requirePrefix: true,
    prefix: ".",
    shortDesc: "cancels a remindme reminder",
    longDesc: `.cancelremindme (id)
cancels a remindme reminder with id`,
    log: true,
    points: 1,
    func: (message, args)=>{
        let id = parseInt(args[1]);
        if (timeouts[id] != null) {
            message.reply("clearing timeout");
            bot.clearTimeout(timeouts[id]);
        }
        return true;
    }
}))

//https://db.ygoprodeck.com/api-guide/

commands.push(new Command({
    name: "ygo",
    regex: /^ygo (.+)$/i,
    testString: ".ygo paladin",
    requirePrefix: true,
    prefix: ".",
    shortDesc: "returns yu-gi-oh card data",
    longDesc: `.ygo (card_name or random)
returns yu-gi-oh card data`,
    log: true,
    points: 1,
    func: (message, args)=>{
        (async ()=>{
            let response;
            if (args[1] === "random") {
                response = await rp(`https://db.ygoprodeck.com/api/v4/randomcard.php`).catch(e=>{return {error: "`No cards found`"}})
            } else {
                response = await rp(`https://db.ygoprodeck.com/api/v4/cardinfo.php?fname=${encodeURIComponent(args[1])}`).catch(e=>{return {error: "`No cards found`"}})
            }
            if (response.error) return response.error;
            response = JSON.parse(response);

            function cardRich(card) {
                let rich = new Discord.RichEmbed()
                    .setTitle(card.name)
                    .setImage(card.image_url)
                    .setURL(`http://yugioh.wikia.com/wiki/${encodeURIComponent(card.name)}`)
                let desc_lines = []
                if (card.attribute) desc_lines.push(`${card.attribute}`);
                if (card.level) desc_lines.push(`Level: ${card.level}:star:`);
                if (card.scale) desc_lines.push(`Scale: ${card.scale}`);
                if (card.linkmarkers) {
                    let ascii_arrows = {
                        "Top": ":arrow_up:",
                        "Bottom": ":arrow_down:",
                        "Left": ":arrow_left:",
                        "Right": ":arrow_right:",
                        "Top-Left": ":arrow_upper_left:",
                        "Top-Right": ":arrow_upper_right:",
                        "Bottom-Left": ":arrow_lower_left:",
                        "Bottom-Right": ":arrow_lower_right:"
                    };
                    let links = card.linkmarkers.split(",").map(dir=>{
                        return ascii_arrows[dir];
                    }).join(" ")
                    
                    desc_lines.push(`LINK: ${links}`);
                }
                let race_type = []
                if (card.race) race_type.push(card.race)
                if (card.type) race_type.push(card.type)
                if (race_type.length > 0) desc_lines.push(`**[${race_type.join(" / ")}]**`)
                if (card.desc) desc_lines.push(card.desc);
                let atk_def = []
                if (card.atk) atk_def.push(`ATK/ ${card.atk}`);
                if (card.def) atk_def.push(`DEF/ ${card.def}`);
                if (card.linkval && card.linkval>0) atk_def.push(`LINK-${card.linkval}`);
                if (atk_def.length>0) desc_lines.push(`**${atk_def.join("  ")}**`)
                if (card.tcgplayer_price) desc_lines.push(`Price: $${card.tcgplayer_price}`);                
                rich.setDescription(desc_lines.join("\n"))
                return rich;
            }

            let card_list = response[0].map(card=>{
                return [card.name, ()=>{return cardRich(card)}]
            })

            if (card_list.length==1) {
                return card_list[0][1]();
            } else if (card_list.length>1){
                return ["", new Discord.RichEmbed({
                    title:"Multiple cards found",
                    description: createCustomNumCommand3(message,card_list)
                })];
            } else {
                return ["No cards found."];
            }
        })().then(params=>{
            if (Array.isArray(params)) {
                message.channel.send.apply(message.channel, params).catch(e=>{
                    if (e.code == 50035) {
                        message.channel.send("`Message too large`").catch(err);
                    } else {
                        err(e);
                        message.channel.send("`Error`").catch(err);
                    }
                });
            } else {
                message.channel.send(params).catch(e=>{
                    if (e.code == 50035) {
                        message.channel.send("`Message too large`").catch(err);
                    } else {
                        err(e);
                        message.channel.send("`Error`").catch(err);
                    }
                });
            }
        }).catch(e=>{
            message.channel.send("`Error`").catch(err);
            err(e);
        })
        return true;
    }
}))
commands.push(new Command({
    name: "hs",
    regex: /^hs (.+)$/i,
    requirePrefix: true,
    prefix: ".",
    testString: ".hs open the waygate",
    shortDesc: "returns hearthstone card data",
    longDesc: `.hs (card name)
returns hearthstone card data`,
    hardAsserts: ()=>{return config.api.hearthstone;},
    log: true,
    points: 1,
    func: (message, args)=>{
        (async ()=>{
                let body = await requestpromise({
                url: `https://omgvamp-hearthstone-v1.p.mashape.com/cards/search/${encodeURIComponent(args[1])}`,
                headers: {
                    "X-Mashape-Key": config.api.hearthstone
                }
            })
            let results = JSON.parse(body);
            function cardRich(card) {
                let rich = new Discord.RichEmbed();
                rich.setTitle(card.name);
                rich.setImage(card.img)
                let desc = "";
                if (card.playerClass) desc += "**Class: **" + card.playerClass + "\n";
                if (card.cardSet) desc += "**Set: **" + card.cardSet + "\n";
                if (card.artist) desc += "**Artist: **" + card.artist + "\n";
                if (card.collectible) desc += "**Collectible**" + "\n";
                else desc += "**Uncollectible**" + "\n";
                if (card.cost) desc += `${card.cost} mana\n`;
                if (card.attack && card.health) desc += `${card.attack}/${card.health}\n`;
                if (card.text) {
                    let $ = cheerio.load(card.text.replace(/\[x\]/gi, "").replace(/\\n/gi, " ").replace(/<br\s*[\/]?>/gi, "\n").replace(/<\/?b>/gi, "**"))
                    desc += `${$("body").text()}\n`;
                }
                /*
                if (card.type == "Hero") {
                    let cardtext = card.text;
                    cardtext = replaceAll(cardtext, "\\*", "\\*");
                    cardtext = replaceAll(cardtext, "\\\\n", "\n");
                    cardtext = replaceAll(cardtext, "<i>", "*");
                    cardtext = replaceAll(cardtext, "</i>", "*");
                    cardtext = replaceAll(cardtext, "<b>", "**");
                    cardtext = replaceAll(cardtext, "</b>", "**");
                    desc += "\n" + cardtext + "\n";
                }
                */
                if (card.flavor) {
                    let flavor = card.flavor;
                    flavor = replaceAll(flavor, "\\*", "\\*");
                    flavor = replaceAll(flavor, "\\\\n", "\n");
                    flavor = replaceAll(flavor, "<i>", "*");
                    flavor = replaceAll(flavor, "</i>", "*");
                    flavor = replaceAll(flavor, "<b>", "**");
                    flavor = replaceAll(flavor, "</b>", "**");
                    desc += "\n" + flavor;
                }
                rich.setDescription(desc);
                return rich;
            }
            if (results.length < 1) {
                message.channel.send("`No results`");
            } else if (results.length == 1) {
                let rich = cardRich(results[0]);
                message.channel.send("", { embed: rich });
            } else {
                let msg = "```" + results.map((v, i) => {
                    let title = v.name;
                    if (v.type == "Hero") title += " (Hero)"
                    return `${i + 1}. ${title}`
                }).join("\n") + "```";
                extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                    var num = parseInt(message.content) - 1;
                    if (num < results.length && num > -1) {
                        let rich = cardRich(results[num]);
                        message.channel.send("", { embed: rich });
                        return true;
                    }
                    return false;
                })
                message.channel.send(msg).catch(err);
            }
        })().catch(e=>{
            message.channel.send("`Error`").catch(err);
            err(e);
        })
        return true;
    }
}))

let art = null;        
fs.readFile("./data/artifact.json", 'utf8', function (e, data) {
    if (e) {
        console.error("Artifact card data not found");
    } else {
        art = JSON.parse(data);
    }
})

commands.push(new Command({
    name: "art",
    regex: /^art (.+)$/i,
    prefix: ".",
    testString: ".art meepo",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return art;},
    shortDesc: "return artifact cards",
    longDesc: `.art (search_term or random)
return artifact cards`,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            function simplifyname(s){
                s = replaceAll(s," ","");
                s = replaceAll(s,"-","");
                s = s.toLowerCase()
                return s;
            }
            let perfectmatch = [];
            let goodmatch = [];
            if (args[1].toLowerCase() === "random") {
                let keys = Object.keys(art)
                let rand = Math.floor(keys.length * Math.random())
                let card = art[keys[rand]]
                perfectmatch.push([card.card_name, async()=>await createMessage(card)])
            } else {
                Object.keys(art).forEach((key)=>{
                    let card = art[key]
                    let cardsimplename = simplifyname(card.card_name);
                    let searchsimple = simplifyname(args[1]);
                    if (cardsimplename === searchsimple) perfectmatch.push([card.card_name, async()=>await createMessage(card)]);
                    else if (cardsimplename.indexOf(searchsimple) > -1) goodmatch.push([card.card_name,async()=>await createMessage(card)]);
                })
            }

            async function parselist(list) {
                if (list.length == 1) {
                    return await list[0][1]();
                } else if (list.length > 1) {
                    let rich = new Discord.RichEmbed({
                        title: "Multiple cards found",
                        description: createCustomNumCommand3(message,list)
                    })
                    return ["",{embed:rich}]
                } else {
                    return false;
                }
            }

            async function createMessage(card) {
                let rich = new Discord.RichEmbed();
                let price;
                let link;
                try {
                    let pricebody = await requestpromise("https://steamcommunity.com/market/priceoverview/?appid=583950&currency=1&market_hash_name=1" + card.card_id)
                    let pricedata = JSON.parse(pricebody);
                    if (pricedata.success) {
                        price = pricedata.lowest_price;
                        link = "https://steamcommunity.com/market/listings/583950/1" + card.card_id
                    }
                } catch (e) {

                }
                rich.setTitle(card.card_name)
                if (card.card_text) {
                    rich.addField(card.card_type, card.card_text)
                } else {
                    rich.setDescription("**"+card.card_type+"**");
                }
                if (card.rarity) rich.addField("Rarity", card.rarity)
                if (card.set) rich.addField("Set", card.set)
                if (card.references.length>0) {
                    let reflist = card.references.map((ref)=>{
                        return art[ref.card_id].card_name;
                    }).join("\n");
                    rich.addField("Includes", reflist)
                }
                if (price) rich.addField("Price", price)
                if (link) rich.setURL(link)
                rich.setImage(card.image)
                return ["",{embed:rich}]
            }

            return await parselist(perfectmatch) || await parselist(goodmatch) || ["`No cards found`"]
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "mtg",
    regex: /^mtg (.+)$/i,
    prefix: ".",
    testString: ".mtg saheeli",
    hidden: false,
    requirePrefix: true,
    shortDesc: "returns Magic the Gathering card",
    longDesc: {title:`.mtg __search_term or random__`,
        description: `returns Magic the Gathering card`,
        fields: [{
            name: `search_term`,
            value: `The card name. For split, double-faced and flip cards, just the name of one side of the card. Basically each ‘sub-card’ has its own record.`
        },{
            name: `random`,
            value: `returns a random card`
        },{
            name: `Examples`,
            value: `.mtg saheeli
.mtg random`
        }]
    },
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            function cardRich(card) {
                let rich = new Discord.RichEmbed()
                    .setTitle(card.name)
                    .setImage(card.imageUrl)
                if (card.multiverseid) {
                    rich.setURL(`https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${card.multiverseid}`)
                }
                let desc_lines = [];
                if (card.manaCost) desc_lines.push(`Mana Cost: ${replaceIcons(card.manaCost)}`)
                if (card.type) desc_lines.push(`**${replaceIcons(card.type)}**`)
                if (card.text) desc_lines.push(replaceIcons(card.text))
                let stats = ""
                if (card.power) stats += card.power;
                if (card.toughness) stats += "/" + card.toughness;
                if (stats !== "") desc_lines.push(stats);
                if (card.flavor) desc_lines.push(`\n*_${card.flavor}_*`);
                
                //looks ugly
                    /*
                let legal = "\n" + card.legalities.map(format=>{
                    return `${format.format}: ${format.legality}`
                }).join("\n");
                if (card.legalities) desc_lines.push(legal)
                    */

                rich.setDescription(desc_lines.join("\n"))
                return rich;
            }

            function replaceIcons(text) {
                let icons = {
                    "{E}": `<:mtg_e:584109084861530132>`,
                    "{W}": `<:mtg_w:584108894595448970>`,
                    "{U}": `<:mtg_u:584108894922735629>`,
                    "{T}": `<:mtg_t:584108894591254535>`,
                    "{R}": `<:mtg_r:584108894524276746>`,
                    "{G}": `<:mtg_g:584108863607930881>`,
                    "{B}": `<:mtg_b:584108877440876544>`,
                    "{C}": `<:mtg_b:584131157206237184>`,
                    "{X}": `:regional_indicator_x:`,
                    "{1}": `:one:`,
                    "{2}": `:two:`,
                    "{3}": `:three:`,
                    "{4}": `:four:`,
                    "{5}": `:five:`,
                    "{6}": `:six:`,
                    "{7}": `:seven:`,
                    "{8}": `:eight:`,
                    "{9}": `:nine:`,
                }
                Object.keys(icons).forEach(icon=>{
                    let literal = icon.replace(/\{/g,`\\{`).replace(/\}/g,`\\}`)
                    text = text.replace(new RegExp(literal, 'g'), icons[icon])
                })
                return text
            }

            //https://docs.magicthegathering.io/#api_v1cards_list
            let response;
            if (args[1].toLowerCase() === "random") {
                response = await rp(`https://api.magicthegathering.io/v1/cards?random=true&pageSize=100`)
                response = JSON.parse(response);
                response.cards = [response.cards.find(card=>{
                    return card.multiverseid !== undefined;
                })]
            } else {
                response = await rp(`https://api.magicthegathering.io/v1/cards?name=${encodeURIComponent(args[1])}&orderBy=name`)
                response = JSON.parse(response);
            }
            let card_list = {}

            response.cards.forEach((card)=>{
                card.checkid = card.multiverseid || 0;
                if (!card_list[card.name]) card_list[card.name] = card;
                else if (card_list[card.name].checkid < card.checkid) card_list[card.name] = card
            })

            card_list = Object.values(card_list).map(card=>{
                return [card.name, ()=>{return [cardRich(card)]}]
            })

            if (card_list.length < 1) {
                return ["`No results`"];
            } else if (card_list.length == 1) {
                return card_list[0][1]();
            } else {
                let rich = new Discord.RichEmbed({
                    title: "Multiple cards found",
                    description: createCustomNumCommand3(message,card_list)
                })
                return [rich];
            }
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))


let gundam = null;        
fs.readFile("./data/gundam.json", 'utf8', function (e, data) {
    if (e) {
        console.error("gundam data not found");
    } else {
        gundam = JSON.parse(data);
    }
})

commands.push(new Command({
    name: "gundam",
    regex: /^gundam (.+)$/i,
    prefix: ".",
    testString: ".gundam rx",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return gundam;},
    shortDesc: "you get gundam stuff back",
    longDesc: `.gundam (search)`,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            function simplifyname(s){
                s = replaceAll(s," ","");
                s = replaceAll(s,"-","");
                s = s.toLowerCase()
                return s;
            }
            let perfectmatch = [];
            let goodmatch = [];
            Object.keys(gundam).forEach((key)=>{
                let thisgundam = gundam[key]
                let simplename = simplifyname(thisgundam.Model);
                let searchsimple = simplifyname(args[1]);
                if (simplename === searchsimple) perfectmatch.push([thisgundam.Model, createMessage(thisgundam)]);
                else if (simplename.indexOf(searchsimple) > -1) goodmatch.push([thisgundam.Model,createMessage(thisgundam)]);
            })

            function parselist(list) {
                if (list.length == 1) {
                    return list[0][1];
                } else if (list.length > 1) {
                    let rich = new Discord.RichEmbed({
                        title: "Multiple gundams found",
                        description: createCustomNumCommand3(message,list)
                    })
                    return ["",{embed:rich}]
                } else {
                    return false;
                }
            }

            function createMessage(thisgundam) {
                let rich = new Discord.RichEmbed();
                rich.setTitle(thisgundam.Model)
                rich.addField("MG", thisgundam.MG)
                rich.addField("Series", thisgundam.Series)
                rich.addField("Price", thisgundam.Price)
                rich.addField("Release Date", thisgundam["Release Date"])
                rich.addField("Notes", thisgundam.Notes)
                rich.setImage(thisgundam.image)
                return ["",{embed:rich}]
            }

            return parselist(perfectmatch) || parselist(goodmatch) || ["`Gundam not found`"]
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

let t7 = null;        
fs.readFile("./data/t7.json", 'utf8', function (e, data) {
    if (e) {
        console.error("Tekken 7 data not found");
    } else {
        t7 = JSON.parse(data);
    }
})

commands.push(new Command({
    name: "t7",
    regex: /^(?:t7|tek) (\S+) ([^\n\r]+?)$/i,
    prefix: ".",
    requirePrefix: true,
    hardAsserts: ()=>{return t7;},
    testString: ".t7 ak block=1",
    log: true,
    points: 1,
    shortDesc: "returns info on Tekken 7 moves",
    longDesc: {title:`.t7 __character_name__ __condition__`,
        description: `returns information on a Tekken 7 character's move string`,
        fields: [{
            name: `character_name`,
            value: `full or part of a character's name`
        },{
            name: `**condition**`,
            value: `**__commandstring__ or __movename__** - returns moves which contain the commandstring or movename. same as command:commandstring or name:movename
**__fieldname__>__searchstring__** - fieldname begins with searchstring
**__fieldname__<__searchstring__** - the field end with searchstring
**__fieldname__:__searchstring__** - the value of fieldname begins with searchstring
**__fieldname__=__searchstring__** - value of fieldname is exactly the searchstring
**__fieldname__>__num__** - the value of fieldname is greater than num
**__fieldname__<__num__** - the value of fieldname is less than num
**__fieldname__=__num__** - the value of fieldname is equal to num
**i__num__** - same as startup=__num__
multiple conditions can be linked together using condition1&condition2&condition3...`
        },{
            name: "Examples",
            value: `**.t7 aku 11** - returns information on Akuma's 1,1
**.t7 aku com:11** - returns strings that contains 1,1
**.t7 aku hadoken** - returns moves where the name contains "hadoken"
**.t7 aku hit level>m** - returns moves that begin with a mid
**.t7 aku hit level<m** - returns moves that end with a mid
**.t7 aku name=gohadoken** - returns moves where the name is exactly gohadoken
**.t7 aku i13** - returns moves that have a startup of 13
**.t7 aku startup<12** - returns moves that have a startup < 12
**.t7 aku notes:special cancel** - returns moves that say special cancel in the notes
**.t7 aku block<10 & startup<15 & hitlevel>m** - returns moves that are < 10 on block, startup > 15, and begin with a mid`
        }]
    },
    func: (message, args)=>{
        (async ()=>{

            function simplifyMove(s) {
                s = s.toLowerCase();
                s = replaceAll(s, " ", "");
                s = replaceAll(s, "\\/", "");
                s = replaceAll(s, ",", "");
                s = replaceAll(s, "(\\D)\\+(\\d)", "$1$2");
                s = replaceAll(s, "(\\D)\\+(\\D)", "$1$2");
                if (s.indexOf("run")==0) s = "fff" + s.slice(3);
                if (s.indexOf("running")==0) s = "fff" + s.slice(6);
                if (s.indexOf("wr")==0) s = "fff" + s.slice(2);
                if (s.indexOf("cd")==0) s = "fnddf" + s.slice(2);
                if (s.indexOf("rds")==0) s = "bt" + s.slice(3);
                if (s.indexOf("qcf")==0) s = "ddff" + s.slice(3);
                if (s.indexOf("qcb")==0) s = "ddbb" + s.slice(3);
                if (s.indexOf("hcf")==0) s = "bdbddff" + s.slice(3);
                if (s.indexOf("hcb")==0) s = "fdfddbb" + s.slice(3);
                return s;
            }
            function simplifyfield(s) {
                s = s.toLowerCase();
                s = s.trim();
                s = replaceAll(s, " ", "");
                return s;
            }

            //find character
            let charfound = [];
            let charfoundmid = [];
            let nameinput = args[1].toLowerCase();
            if (nameinput=="dj") nameinput="devil"
            else if (nameinput=="djin") nameinput="devil"
            else if (nameinput=="dvj") nameinput="devil"
            else if (nameinput=="panda") nameinput="kuma"
            else if (nameinput=="ak") nameinput="armor"
            Object.keys(t7).forEach((v, i)=>{
                let charindex = v.indexOf(nameinput);
                if (charindex===0) charfound.push(v);
                else if(charindex>0) charfoundmid.push(v);
            })

            function parseCharList(charfound) {
                if (charfound.length ==1) return getMove(charfound[0], args[2]);
                else if (charfound.length>1) {
                    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                        var num = parseInt(message.content) - 1;
                        if (num < charfound.length && num > -1) {
                            message.channel.send.apply(message.channel, getMove(charfound[num], args[2])).catch(err);
                            return true;
                        }
                        return false;
                    })
                    let msg = charfound.map((e, i)=>{
                        return `**${i+1}**. ${t7[e].name}`
                    }).join("\n");
                    let rich = new Discord.RichEmbed();
                    rich.setDescription(msg);
                    rich.setTitle("Choose your fighter")
                    return ["",rich];
                }
                return false;
            }

            function getMove(char, move) {
                let poslist = [];
                char = t7[char];
                let simplifiedinput = simplifyMove(move);
                if (char.moves[simplifiedinput]) {
                    poslist = char.moves[simplifiedinput];
                } else {
                    function getMoveList(conditions) {
                        let movelist = []
                        //for each {moveshorthand:[array of moves]}
                        Object.entries(char.moves).forEach((entry)=>{
                            //for each move {command, name, etc}
                            entry[1].forEach((moveobj) => {
                                //check if move satisfies all conditions
                                let match = conditions.every((cur)=>{
                                    //condition has to return true for at least 1 field:value
                                    return Object.entries(moveobj).some((field)=>{
                                        //field[0] is the field name and field[1] is the field value
                                        if (field[0]!=="gfycat") {
                                            return cur(field[0], field[1]);
                                        }
                                        return false;
                                    })

                                })

                                if (match) {
                                    movelist.push(moveobj)
                                };
                                
                            })
                        })
                        return movelist;
                    }

                    //returns a function that returns true if given field matches current field and satisfies value comparison
                    function parseConditionArgs(userfield, comparison, uservalue) {

                        //compares the field value to the given value
                        function comparefunc(value,comparison,valuestring,isnumfield) {
                            if (isnumfield) {
                                if (comparison=="<") {
                                    return value < valuestring;
                                } else if (comparison==">"){
                                    return value > valuestring;
                                } else if (comparison=="=" || comparison==":"){
                                    return value == valuestring;
                                } else if (comparison=="<="){
                                    return value <= valuestring;
                                } else if (comparison==">="){
                                    return value >= valuestring;
                                }
                                return false;
                            }
                            
                            if (comparison=="<" || comparison=="<="){
                                return value.endsWith(valuestring);
                            } else if (comparison=="="){
                                return value == valuestring;
                            } else if (comparison==">" || comparison==">="){
                                return value.startsWith(valuestring);
                            } else if (comparison==":"){
                                return value.indexOf(valuestring) > -1;
                            }
                        }

                        function checkregex(thisvalue,comparison,uservalue) {
                            if (comparison=="="){
                                let reg = new RegExp("^"+thisvalue+"$");
                                if (reg.test(uservalue)) return true;
                                return false
                            }
                            return false;
                        }

                        return (thisfield, thisvalue) => {
                            thisfield = simplifyfield(thisfield);
                            userfield = simplifyfield(userfield);
                            //special case of comparing a command value to the regexp value of the move
                            
                            if (thisfield == "regexp" && "command".indexOf(userfield) > -1) {
                                uservalue = simplifyMove(uservalue);
                                let check = checkregex(thisvalue,comparison,uservalue);
                                return check;
                            }
                            
                            
                            if (thisfield.indexOf(userfield) !== 0) return false; 
                            let numfields = ["damage","startupframe","blockframe","hitframe","counterhitframe","post-techframes","speed"];
                            let isnumfield = false;
                            let tmpthisvalue;
                            let tmpuservalue;
                            if (numfields.indexOf(thisfield) > -1 && !isNaN(uservalue)) {
                                isnumfield = true;
                                tmpthisvalue = parseInt(thisvalue);
                                tmpuservalue = parseInt(uservalue);
                            } else {
                                if (thisfield.indexOf("command")== 0) {
                                    tmpthisvalue = simplifyMove(thisvalue);
                                    tmpuservalue = simplifyMove(uservalue);
                                } else {
                                    tmpthisvalue = simplifyfield(thisvalue);
                                    tmpuservalue = simplifyfield(uservalue);
                                }
                            }
                            if (comparefunc(tmpthisvalue,comparison,tmpuservalue,isnumfield)) {
                                return true;
                            }
                            return false;
                        }
                    }

                    let conditions = [(arg1, arg2)=>{
                        return parseConditionArgs("command","=",move)(arg1, arg2);
                    }]
                    poslist = getMoveList(conditions);

                    if (poslist.length < 1) {
                        let conditionstring = move.split("&");
                        

                        conditions = conditionstring.map((cur)=>{
                            let b;
                            if (b = /^(.+?)([<>]=|[:=<>])(.+)$/.exec(cur)) {
                                return parseConditionArgs(b[1],b[2],b[3]);
                            } else if (b = /^i(\d+)$/i.exec(cur)) {
                                return parseConditionArgs("startupframe",":",b[1]);
                            } else {
                                return (arg1, arg2)=>{
                                    return parseConditionArgs("command",":",cur)(arg1, arg2) || parseConditionArgs("name",":",cur)(arg1, arg2) || parseConditionArgs("notes",":",cur)(arg1, arg2);
                                    //return parseConditionArgs("command",":",cur)(arg1, arg2) || parseConditionArgs("name",":",cur)(arg1, arg2);
                                }
                            }
                        })
                        poslist = getMoveList(conditions);
                    }
                }

                if (poslist.length === 1) {
                    return [createMoveMessage(char, poslist[0])];
                } else if (poslist.length > 1) {
                    let data_array = poslist.map((v, i) => {
                        return [v.Command, [createMoveMessage(char, v)]]
                    })
                    let rich = new Discord.RichEmbed({
                        title: "Multiple moves found",
                        description: createCustomNumCommand3(message,data_array)
                    })
                    return ["", {embed: rich}]
                    /*
                    let msg = "```" + poslist.map((v, i) => {
                        return `${i + 1}. ${v.Command}`
                    }).join("\n") + "```";
                    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message2) => {
                        var num = parseInt(message2.content) - 1;
                        if (num < poslist.length && num > -1) {
                            let move = poslist[num];
                            message.channel.send(createMoveMessage(char, poslist[num])).catch(err);
                            return true;
                        }
                        return false;
                    })
                    return [msg];
                    */
                } else {
                    return [`\`Move not found\`\n<${char.link}>`];
                }
            }

            function createMoveMessage(char, move) {
                let gfycatlink = move.gfycat || "";
                let mes = `__**${char.name}**__\n`
                mes += Object.keys(move).filter((v) => {
                    return v!="gfycat" && v!="regexp";
                }).map((key)=>{
                    return `**${key}**: ${move[key]}`
                }).join("\n");
                mes += "\n" + gfycatlink;
                return mes;
            }

            let msg = parseCharList(charfound) || parseCharList(charfoundmid) || ["`Character not found`"]
            return msg;
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))


let sc6 = null;        
fs.readFile("./data/sc6.json", 'utf8', function (e, data) {
    if (e) {
        console.error("Soulcalibur 6 data not found");
    } else {
        sc6 = JSON.parse(data);
    }
})

commands.push(new Command({
    name: "sc6",
    regex: /^sc(?:6|(?:vi)) (\S+) ([^\n\r]+?)$/i,
    prefix: ".",
    testString: ".sc6 ivy ivy",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return sc6;},
    log: true,
    points: 1,
    shortDesc: "returns info on Soulcalibur 6 moves",
    longDesc: {title:`.sc6 __character_name__ __condition__`,
        description: `returns information about a Soulcalibur 6 character's attack string`,
        fields: [{
            name: `character_name`,
            value: `full or part of a character's name`
        },{
            name: `**condition**`,
            value: `**__commandstring__ or __movename__** - returns moves which contain the commandstring or movename. same as command:commandstring or attack:movename
**__fieldname__>__searchstring__** - the field begins with searchstring
**__fieldname__<__searchstring__** - the field ends with fieldvalue
**__fieldname__=__searchstring__** - the field contains searchstring
**__fieldname__>__num__** - the value of fieldname is greater than num
**__fieldname__<__num__** - the value of fieldname is less than num
**__fieldname__=__num__** - the value of fieldname is equal to num
**i__num__** - same as imp=__num__
multiple conditions can be linked together using condition1&condition2&condition3...`
        },{
            name: "Examples",
            value: `**.sc6 tal aaba** - returns information on Talim's AABA
**.sc6 ivy ivy** - returns Ivy moves where the name contains "ivy"
**.sc6 nigh imp<15** - returns Nightmare moves that are faster than 15 frames
**.sc6 nigh hit level<m&hit level>h** - returns Nightmare moves that begin with a mid and end with a low`
        }]
    },
    func: (message, args) =>{
        (async()=>{
            function simplifyMove(s) {
                s = s.toLowerCase();
                s = s.trim();
                s = replaceAll(s, " ", "");
                //s = replaceAll(s, "\\/", "");
                s = replaceAll(s, ",", "");
                //s = replaceAll(s, "(\\d)\\+(\\D)", "$1$2");
                return s;
            }
            function simplifyfield(s) {
                s = s.toLowerCase();
                s = s.trim();
                s = replaceAll(s, " ", "");
                s = replaceAll(s, "-", "");
                return s;
            }

            //find character
            
            let charfound = [];
            let charfoundmid = [];
            Object.keys(sc6).forEach((v, i)=>{
                let thisname = simplifyfield(v);
                let nameinput = simplifyfield(args[1]);
                let charindex = thisname.indexOf(nameinput);
                if (charindex===0) charfound.push(v);
                else if(charindex>0) charfoundmid.push(v);
            })
            

            function parseCharList(charfound) {
                if (charfound.length ==1) return getMove(charfound[0], args[2]);
                else if (charfound.length>1) {
                    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                        var num = parseInt(message.content) - 1;
                        if (num < charfound.length && num > -1) {
                            message.channel.send(getMove(charfound[num], args[2]));
                            return true;
                        }
                        return false;
                    })
                    let rich = new Discord.RichEmbed({
                        title: "Character not found",
                        description: charfound.map((e, i)=>{
                            return `${i+1}. ${sc6[e].name}`
                        }).join("\n")
                    })
                    return ["", {embed:rich}];
                }
                return false;
            }

            function getMove(char, move) {
                let poslist = [];
                char = sc6[char];
                let simplifiedinput = move.toUpperCase();
                if (char.moves[move]) {
                    poslist = char.moves[move];
                } else if (char.moves[simplifiedinput]) {
                    poslist = char.moves[simplifiedinput];
                } else {
                    let conditionstring = move.split("&");
                    //returns a function that returns true if given field matches current field and satisfies value comparison
                    function parseConditionArgs(userfield, comparison, uservalue) {

                        //compares the field value to the given value
                        function comparefunc(value,comparison,valuestring,isnumfield) {
                            if (isnumfield) {
                                if (comparison=="<") {
                                    return value < valuestring;
                                } else if (comparison==">"){
                                    return value > valuestring;
                                } else if (comparison=="=" || comparison==":"){
                                    return value == valuestring;
                                }
                                return false;
                            }
                            
                            if (comparison=="<"){
                                return value.endsWith(valuestring);
                            } else if (comparison=="="){
                                return value.indexOf(valuestring) > -1;
                            } else if (comparison==">"){
                                return value.startsWith(valuestring);
                            } else if (comparison==":"){
                                return value.indexOf(valuestring) > -1;
                            }
                        }

                        return (thisfield, thisvalue) => {
                            thisfield = simplifyfield(thisfield);
                            userfield = simplifyfield(userfield);
                            if (thisfield.indexOf(userfield) < 0) return false; 
                            let numfields = ["imp","dmg","chip","grd","hit","ch","gb"];
                            let isnumfield = false;
                            if (numfields.indexOf(thisfield) > -1 && !isNaN(uservalue)) {
                                isnumfield = true;
                                thisvalue = parseInt(thisvalue);
                                uservalue = parseInt(uservalue);
                            } else {
                                if (thisfield.indexOf("Command")== 0) {
                                    thisvalue = simplifyMove(thisvalue);
                                    uservalue = simplifyMove(uservalue);
                                } else {
                                    thisvalue = simplifyfield(thisvalue);
                                    uservalue = simplifyfield(uservalue);
                                }
                            }
                            if (comparefunc(thisvalue,comparison,uservalue,isnumfield)) {
                                return true;
                            }
                            return false;
                        }
                    }

                    let conditions = conditionstring.map((cur)=>{
                        let b;
                        if (b = /^(.+)([=<>])(.+)$/.exec(cur)) {
                            return parseConditionArgs(b[1],b[2],b[3]);
                        } else if (b = /^i(\d+)$/i.exec(cur)) {
                            return parseConditionArgs("imp",":",b[1]);
                        } else {
                            //return parseConditionArgs("command","=",cur) || parseConditionArgs("attack","=",cur);
                            
                            return (arg1, arg2)=>{
                                return parseConditionArgs("command","=",cur)(arg1, arg2) || parseConditionArgs("attack","=",cur)(arg1, arg2);
                            }
                        }
                    })

                    //for each {moveshorthand:[array of moves]}
                    Object.entries(char.moves).forEach((entry)=>{
                        //for each move {command, name, etc}
                        entry[1].forEach((moveobj) => {
                            //check if move satisfies all contitons
                            let match = conditions.every((cur)=>{
                                //condition has to return true for at least 1 field:value
                                return Object.entries(moveobj).some((field)=>{
                                    if (field[0]!=="gfycat") {
                                        return cur(field[0], field[1]);
                                    }
                                    return false;
                                })

                            })

                            if (match) {
                                poslist.push(moveobj)
                            };
                            
                        })
                    })
                }

                if (poslist.length === 1) {
                    return createMoveMessage(char, poslist[0]);
                } else if (poslist.length > 1) {
                    let data_array = poslist.map((v, i) => {
                        return [`${v.Attack} - ${v.Command}`, createMoveMessage(char, v)]
                    })
                    let rich = new Discord.RichEmbed({
                        title: "Multiple moves found",
                        description:createCustomNumCommand2(message, data_array)
                    })
                    return ["",{embed:rich}];
                } else {
                    return [`\`Move not found\`\n<${char.link}>`];
                }
            }

            function createMoveMessage(char, move) {
                let rich = new Discord.RichEmbed({
                    title: char.name,
                    url: char.link,
                    description: Object.keys(move).filter((v) => {
                        return move[v]!="";
                    }).map((key)=>{
                        return `**${key}**: ${move[key]}`
                    }).join("\n")
                })
                //mes += gfycatlink;
                return ["",{embed:rich}];
            }

            let msg = parseCharList(charfound) || parseCharList(charfoundmid) || ["`Character not found`"]
            return msg;

        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

let sts = null;        
fs.readFile("./data/sts.json", 'utf8', function (e, data) {
    if (e) {
        return console.error("STS data not found");
    } else {
        sts = JSON.parse(data);
    }
})

commands.push(new Command({
    name: "sts",
    regex: /^sts (\S+)$/i,
    prefix: ".",
    testString: ".sts apparition",
    hardAsserts: ()=>{return sts;},
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "returns info on Slay the Spire cards and relics",
    longDesc: `.sts (card_name or relic_name)
returns information on a Slay the Spire card or relic. Matches by substring`,
    func: (message, args) =>{
        (async()=>{
            let results = [];
            sts.forEach((element) => {
                if (element.title.toLowerCase().indexOf(args[1].toLowerCase()) > -1) {
                    results.push(element);
                }
            })
            if (results.length < 1) {
                return ["`No results`"];
            } else if (results.length == 1) {
                let rich = new Discord.RichEmbed();
                rich.setTitle(results[0].title);
                rich.setImage(results[0].image)
                rich.setDescription(results[0].description);
                return ["", { embed: rich }];
            } else {
                let msg = "```" + results.map((v, i) => {
                    return `${i + 1}. ${v.title}`
                }).join("\n") + "```";
                //message.channel.sendMessage(msg).catch(err);

                extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                    var num = parseInt(message.content) - 1;
                    if (num < results.length && num > -1) {
                        let rich = new Discord.RichEmbed();
                        rich.setTitle(results[num].title);
                        rich.setImage(results[num].image)
                        rich.setDescription(results[num].description);
                        message.channel.send("", { embed: rich });
                        return true;
                    }
                    return false;
                })
                return [msg];
            }
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

//todo: .br .gw2api
let coin = null;
requestpromise("https://www.cryptocompare.com/api/data/coinlist/").then(body => {
    try {
        coin = JSON.parse(body);
    } catch (e) {
        console.error("could not parse cryptocompare");
    }
})

commands.push(new Command({
    name: "price",
    regex: /^price(?: (\d*(?:\.\d+)?))? (\S+)(?: (\w+))?$/i,
    prefix: ".",
    testString: ".price 10 btc cad",
    hardAsserts: ()=>{return coin;},
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "returns the exchange rate and graph of the price of a foreign currency or cryptocurrency",
    longDesc: `.price [amount] (from_symbol) [to_symbol]
returns a 30 hour graph of the price of a foreign currency or cryptocurrency
amount (optional) - the amount of from_symbol currency. Default is 1.
from_symbol - the currency symbol you are exchanging from. ex: CAD
to_symbol (optional) - the currency symbol you are exchanging to. Default is USD.`,
    func: (message, args) =>{
        (async()=>{
            let amt = 1;
            if (args[1]) amt = parseFloat(args[1]);
            let from = args[2].toUpperCase();
            let to = "USD";
            if (args[3]) to = args[3].toUpperCase();
            let chartpromise = requestpromise(`https://min-api.cryptocompare.com/data/histominute?fsym=${encodeURIComponent(from)}&tsym=${encodeURIComponent(to)}&limit=144&aggregate=10`).then(body => {
                try {
                    let res = JSON.parse(body);
                    if (res.Response && res.Response === "Error") {
                        return ["`"+res.Response+"`"]
                    }

                    function extendedEncode(arrVals, minVal, maxVal) {
                        var EXTENDED_MAP =
                            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.';
                        var EXTENDED_MAP_LENGTH = EXTENDED_MAP.length;
                        var chartData = '';

                        for (let i = 0, len = arrVals.length; i < len; i++) {
                            // In case the array vals were translated to strings.
                            var numericVal = new Number(arrVals[i]);
                            // Scale the value to maxVal.
                            var scaledVal = Math.floor(EXTENDED_MAP_LENGTH *
                                EXTENDED_MAP_LENGTH * (numericVal - minVal) / (maxVal - minVal));

                            if (scaledVal > (EXTENDED_MAP_LENGTH * EXTENDED_MAP_LENGTH) - 1) {
                                chartData += "..";
                            } else if (scaledVal < 0) {
                                chartData += '__';
                            } else {
                                // Calculate first and second digits and add them to the output.
                                var quotient = Math.floor(scaledVal / EXTENDED_MAP_LENGTH);
                                var remainder = scaledVal - EXTENDED_MAP_LENGTH * quotient;
                                chartData += EXTENDED_MAP.charAt(quotient) + EXTENDED_MAP.charAt(remainder);
                            }
                        }

                        return chartData;
                    }

                    let chart_url = "https://chart.googleapis.com/chart?cht=lxy&chs=729x410&chxt=x,y&chco=000000"
                    let low = res.Data[0].close;
                    let high = res.Data[0].close;
                    let x_data = [];
                    let y_data = [];

                    let curHour = moment.tz(res.Data[0].time * 1000, "America/New_York").hour();
                    let hour_string = [];
                    let time_string = [];
                    for (let i = 0; i < res.Data.length; i++) {
                        if (res.Data[i].close < low) low = res.Data[i].close;
                        if (res.Data[i].close > high) high = res.Data[i].close;
                        x_data.push(res.Data[i].time);
                        y_data.push(res.Data[i].close);
                        let thisMoment = moment.tz(res.Data[i].time * 1000, "America/New_York");
                        let thisHour = thisMoment.hour();
                        if (parseInt(thisHour / 3) != parseInt(curHour / 3)) {
                            curHour = thisHour;
                            if (thisHour != 0) {
                                hour_string.push(encodeURIComponent(thisMoment.format("h:mm a")));
                            } else {
                                hour_string.push(encodeURIComponent(thisMoment.format("dddd")));
                            }
                            time_string.push(res.Data[i].time);
                        }
                    }
                    chart_url += "&chd=e:" + extendedEncode(x_data, res.Data[0].time, res.Data[res.Data.length - 1].time) + "," + extendedEncode(y_data, low, high);
                    chart_url += "&chxr=0," + res.Data[0].time + "," + res.Data[res.Data.length - 1].time + "|1," + low + "," + high;
                    chart_url += "&chxl=0:|" + hour_string.join("|");
                    chart_url += "&chxp=0," + time_string.join(",");
                    //add y ticks
                    chart_url += "&chxs=0,,10,0,lt";
                    return [null,chart_url];
                } catch (e) {
                    err(e);
                }
            })

            let ratepromise = requestpromise(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${encodeURIComponent(from)}&tsyms=${encodeURIComponent(to)}`).then(body => {
                try {
                    let res = JSON.parse(body);
                    if (res.Response && res.Response === "Error") {
                        let msg = res.Message;
                        return ["`"+msg+"`"];
                    }
                    //let to_amt = amt * parseFloat(res[to]);
                    let fromsym = res.DISPLAY[from][to].FROMSYMBOL;
                    if (fromsym == from) fromsym = "";
                    let tosym = res.DISPLAY[from][to].TOSYMBOL;
                    if (tosym == to) tosym = "";
                    let to_amt = amt * res.RAW[from][to].PRICE;
                    let pctchange = Math.abs(res.DISPLAY[from][to].CHANGEPCT24HOUR);
                    let updown = "";
                    if (res.DISPLAY[from][to].CHANGEPCT24HOUR > 0) updown = "▲";
                    else if (res.DISPLAY[from][to].CHANGEPCT24HOUR < 0) updown = "▼";
                    let rich = new Discord.RichEmbed();
                    let image = "";
                    if (coin && coin.Data[from]) {
                        image = "https://www.cryptocompare.com" + coin.Data[from].ImageUrl
                        from += ` (${coin.Data[from].CoinName})`;
                    }
                    if (coin && coin.Data[to]) to += ` (${coin.Data[to].CoinName})`;
                    let msg = `${fromsym} ${amt} ${from} = ${tosym} ${to_amt} ${to} (${updown}${pctchange}%)`;
                    //rich.setDescription(msg)
                    //rich.setFooter(msg,image)
                    rich.setAuthor(msg, image);
                    rich.setFooter("Time is in EDT, the only relevant timezone.");
                    return [null, rich];
                } catch (e) {
                    err(e);
                }
            })
            let chart = await chartpromise;
            let rich = await ratepromise;
            if (!chart[0] && !rich[0]) return ["",rich[1].setImage(chart[1])];
            else return [rich[0] || chart[0]];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

function playSound(channel, URL, setvolume, setstart, setduration) {
    try {
        //todo serverVol
        setvolume = setvolume || /*(serverVol ? serverVol[channel.guild] / 100:false) || */.2;
        setstart = setstart || 0;

        function leave() {
            channel.leave();
        }
        if (channel.guild.voiceConnection != null && channel.guild.voiceConnection.player != null) {
            //if in the same voice channel
            if (channel.guild.voiceConnection.channel.equals(channel)) {
                let thisDispatch = channel.guild.voiceConnection.dispatcher;
                //if playing sound
                if (thisDispatch) {
                    thisDispatch.removeAllListeners('end');
                    thisDispatch.on('end', () => {
                        const dispatcher = channel.guild.voiceConnection.playStream(URL, {
                            seek: setstart,
                            volume: setvolume
                        }).on('end', leave);
                    });
                    thisDispatch.end();
                //sitting in channel without playing sound
                } else {
                    channel.guild.voiceConnection.playStream(URL, {
                        seek: setstart,
                        volume: setvolume
                    }).on('end', leave);
                }
            //if in another voice channel
            } else {
                channel.guild.voiceConnection.dispatcher.removeAllListeners('end');
                channel.guild.voiceConnection.dispatcher.end();
                channel.join().then(connnection => {
                    const dispatcher = connnection.playStream(URL, {
                        seek: setstart,
                        volume: setvolume
                    }).on('end', leave);
                }).catch(err);
            }
        //not in a voice channel
        } else {
            channel.join().then(connnection => {
                const dispatcher = connnection.playStream(URL, {
                    seek: setstart,
                    volume: setvolume
                }).on('end', leave);
            }).catch(err)
        }
    } catch (e) {
        console.error(e);
        throw e;
    }
}

commands.push(new Command({
    name: "yt",
    regex: /^yt (?:([a-zA-Z0-9_-]{11})|(?:https?:\/\/)?(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:[^\/\s]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11}))\S*(?: (\d{1,6}))?(?: (\d{1,6}))?(?: (\d{1,3}))?$/i,
    prefix: ".",
    testString: ".yt DN9YncMIr60",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "plays audio from a YouTube link in a voice channel",
    longDesc: `.yt (youtube_id)
plays audio from a YouTube link in a voice channel
youtube_id - can either be the full YouTube URL or the unique 11 characters at the end of the URL`,
    func: (message, args) =>{
        (async()=>{
            let voiceChannel = message.member.voiceChannel;
            if (!voiceChannel) {
                return message.reply(`get in a voice channel`).catch(err);
            }
            let stream = ytdl("https://www.youtube.com/watch?v=" + (args[1] || args[2]), {
                filter: 'audioonly',
                quality: 'highestaudio'
            });
            playSound(voiceChannel, stream);
        })().catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "yts",
    regex: /^yts ([^\n\r]+?)(?: ([\d]{1,2}))?$/i,
    prefix: ".",
    testString: ".yts blood drain again",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return config.api.youtube;},
    log: true,
    points: 1,
    shortDesc: "searches YouTube videos",
    longDesc: `.yts (search_turn) [number_of_results]
returns list of YouTube videos based on the search term
number_of_results - the number of results to return. Default is 6.`,
    func: (message, args) =>{
        (async()=>{
            args[1] = encodeURIComponent(args[1]);
            var max = 6;
            if (args[2] && parseInt(args[2]) > 0 && parseInt(args[2]) < 51) max = parseInt(args[2]);
            let urlpromise = requestpromise('https://www.googleapis.com/youtube/v3/search?part=snippet&key=' + config.api.youtube + '&type=video&maxResults=' + max + '&q=' + args[1])
            let loadingtask = message.channel.send("`Loading...`")
            let body = await urlpromise;

            let data = JSON.parse(body);
            let rich = new Discord.RichEmbed();
            rich.setTitle("YouTube results");
            rich.setURL("https://www.youtube.com/results?search_query=" + args[1])
            let msg = "";
            for (var i = 0; i < data.items.length; i++) {
                //rich.addField(i + 1, `[${data.items[i].snippet.title}](https://youtu.be/${data.items[i].id.videoId})`, false);
                msg += `**${i + 1}**. **[${data.items[i].snippet.title}](https://youtu.be/${data.items[i].id.videoId})**\n`;
            }
            rich.setDescription(msg);
            let loadingMessage = await loadingtask;
            //loadingMessage.edit(msg).catch(err);
            loadingMessage.edit(message.author, {
                embed: rich
            }).catch(err);
            extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, function (message) {
                var num = parseInt(message.content);
                if (num < data.items.length + 1 && num > 0) {
                    try {
                        const voiceChannel = message.member.voiceChannel;
                        if (!voiceChannel) {
                            message.channel.send(`https://youtu.be/${data.items[num-1].id.videoId}`).catch(err);
                            return false;
                        }
                        let stream = ytdl("https://www.youtube.com/watch?v=" + data.items[num-1].id.videoId, {
                            quality: 'highestaudio'
                        });
                        playSound(voiceChannel, stream);
                        return true;
                    } catch (e) {
                        err(e);
                        message.channel.send("`Error`").catch(err);
                    }
                }
                return false;
            })
        })().catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "quote",
    regex: /^quote (\d+)$/i,
    prefix: ".",
    testString: ".quote 508747221588639754",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "returns a link and quote of a past message",
    longDesc: `.quote (message_id or previous_nth_message)
returns a link to and a quote of a past message
message_id - get the id by selecting "copy id" from the settings of the message
previous_nth_message - the number of messages to go back to reach the message you want to quote. 1 is the last message, 2 is the one before, etc`,
    func: (message, args) =>{
        (async()=>{
            if (parseInt(args[1]) < 200) {
                let num = parseInt(args[1]);
                return await message.channel.fetchMessages({
                    limit: num + 1
                }).then(messages => {
                    return [messages.array()[num].url, {
                        embed: richQuote(messages.array()[num])
                    }]
                }).catch(e => {
                    ["`Message not found.`"]
                    //err(e);
                })
            } else {
                return await message.channel.fetchMessage(args[1]).then(message2 => {
                    return [message2.url, {
                        embed: richQuote(message2)
                    }]
                }).catch(e => {
                    return ["`Message not found.`"];
                    //err(e);
                })
            }
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "eval",
    regex: /^eval ([\s\S]+)$/i,
    prefix: ".",
    testString: ".eval 1+1",
    hidden: true,
    requirePrefix: true,
    log: true,
    points: 0,
    shortDesc: "",
    longDesc: ``,
    func: (message, args) =>{
        if (message.author.id !== config.adminID) return false;
        (async()=>{
            let output = eval(args[1]);
            if (output.length<1) output = "`No output`"
            return [output];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

async function weather(location_name){
    let body = await requestpromise(`http://autocomplete.wunderground.com/aq?query=${encodeURIComponent(location_name)}`)
    let data = JSON.parse(body);
    for (var i = 0; i < data.RESULTS.length; i++) {
        if (data.RESULTS[i].lat != "-9999.000000") break;
    }
    if (i == data.RESULTS.length) return ["`Location not found`"];
    let locName = data.RESULTS[i].name;
    let lat = data.RESULTS[i].lat;
    let lon = data.RESULTS[i].lon;
    body =await requestpromise(`https://api.darksky.net/forecast/${config.api.darksky}/${data.RESULTS[i].lat},${data.RESULTS[i].lon}?units=auto&exclude=minutely`)
    data = JSON.parse(body);
    let tM;
    (data.flags.units == "us") ? tM = "°F": tM = "°C";
    let iconNames = ["clear-day", "clear-night", "rain", "snow", "sleet", "wind", "fog", "cloudy", "partly-cloudy-day", "partly-cloudy-night"];
    let iconEmote = [":sunny:", ":crescent_moon:", ":cloud_rain:", ":cloud_snow:", ":cloud_snow:", ":wind_blowing_face:", ":fog:", ":cloud:", ":partly_sunny:", ":cloud:"];
    let rich = new Discord.RichEmbed();
    rich.setTitle("Powered by Dark Sky");
    let summary = data.daily.summary
    if (data.alerts) {
        let alertstring = data.alerts.map((alert)=>{
            return `[**ALERT**](${alert.uri}}): ${alert.description}`
        }).join("\n")
        summary = summary + "\n\n" + alertstring;
    }
    rich.setDescription(summary);
    rich.setURL("https://darksky.net/poweredby/");
    rich.setAuthor(locName, "", `https://darksky.net/forecast/${lat},${lon}`);
    let iconIndex;
    let curTime = moment.tz(data.currently.time * 1000, data.timezone).format('h:mma');
    rich.addField(`${(iconIndex = iconNames.indexOf(data.currently.icon)) > -1 ? iconEmote[iconIndex] : ""}Now`, `${curTime}\n**${data.currently.temperature}${tM}**\nFeels like **${data.currently.apparentTemperature}${tM}**\n${data.currently.summary}`, true)
    for (let i = 0; i < data.daily.data.length; i++) {
        let dayIcon = (iconIndex = iconNames.indexOf(data.daily.data[i].icon)) > -1 ? iconEmote[iconIndex] : "";
        let dayName = moment.tz(data.daily.data[i].time * 1000, data.daily.data[i].timezone).format('dddd');

        let timeLow = moment.tz(data.daily.data[i].temperatureMinTime * 1000, data.timezone).format('h:mma');
        let timeHigh = moment.tz(data.daily.data[i].temperatureMaxTime * 1000, data.timezone).format('h:mma');

        let dayDesc = `\n**${data.daily.data[i].temperatureMin}${tM}**/**${data.daily.data[i].temperatureMax}${tM}**`;
        dayDesc += `\nFeels like **${data.daily.data[i].apparentTemperatureMin}${tM}**/**${data.daily.data[i].apparentTemperatureMax}${tM}**`;
        if (i<data.daily.data.length-1) dayDesc += `\n${wordWrap(data.daily.data[i].summary,33)}`;
        else dayDesc += `\n${data.daily.data[i].summary}`;
        rich.addField(`${dayIcon}${dayName}`, dayDesc, true)
    }

    function getImg() {
        let res = JSON.parse(body);
        if (res.Response && res.Response === "Error") {
            return
        }
        var EXTENDED_MAP =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.';
        var EXTENDED_MAP_LENGTH = EXTENDED_MAP.length;

        function extendedEncode(arrVals, minVal, maxVal) {
            var chartData = '';

            for (let i = 0, len = arrVals.length; i < len; i++) {
                // In case the array vals were translated to strings.
                var numericVal = new Number(arrVals[i]);
                // Scale the value to maxVal.
                var scaledVal = Math.floor(EXTENDED_MAP_LENGTH *
                    EXTENDED_MAP_LENGTH * (numericVal - minVal) / (maxVal - minVal));

                if (scaledVal > (EXTENDED_MAP_LENGTH * EXTENDED_MAP_LENGTH) - 1) {
                    chartData += "..";
                } else if (scaledVal < 0) {
                    chartData += '__';
                } else {
                    // Calculate first and second digits and add them to the output.
                    var quotient = Math.floor(scaledVal / EXTENDED_MAP_LENGTH);
                    var remainder = scaledVal - EXTENDED_MAP_LENGTH * quotient;
                    chartData += EXTENDED_MAP.charAt(quotient) + EXTENDED_MAP.charAt(remainder);
                }
            }

            return chartData;
        }


        let hourdata = data.hourly.data;
        let chart_url = "https://chart.googleapis.com/chart?cht=lxy&chs=729x410&chxt=x,y&chco=FF0000,00FF00&chdl=Temp|Apparent%20temp&chdlp=t"
        let low = hourdata[0].temperature;
        let high = hourdata[0].temperature;
        let x_data = [];
        let y_data = [];
        let y2_data = [];

        let curHour = moment.tz(hourdata[0].time * 1000, data.timezone).hour();
        let hour_string = [];
        let time_string = [];
        let length = hourdata.length;
        for (let i = 0; i < length; i++) {
            if (hourdata[i].temperature < low) low = hourdata[i].temperature;
            else if (hourdata[i].temperature > high) high = hourdata[i].temperature;
            if (hourdata[i].apparentTemperature < low) low = hourdata[i].apparentTemperature;
            else if (hourdata[i].apparentTemperature > high) high = hourdata[i].apparentTemperature;
            x_data.push(hourdata[i].time);
            y_data.push(hourdata[i].temperature);
            y2_data.push(hourdata[i].apparentTemperature);
            let thisMoment = moment.tz(hourdata[i].time * 1000, data.timezone);
            let thisHour = thisMoment.hour();
            if (parseInt(thisHour / 3) != parseInt(curHour / 3)) {
                curHour = thisHour;
                if (thisHour != 0) {
                    hour_string.push(encodeURIComponent(thisMoment.format("h:mm a")));
                } else {
                    hour_string.push(encodeURIComponent(thisMoment.format("dddd")));
                }
                time_string.push(hourdata[i].time);
                //time_string.push((res.Data[i].time-res.Data[0].time)/(res.Data[res.Data.length - 1].time-res.Data[0].time)*100);
            }
        }
        chart_url += "&chd=e:" + extendedEncode(x_data, hourdata[0].time, hourdata[length - 1].time) + "," + extendedEncode(y_data, low, high);
        chart_url += "," + extendedEncode(x_data, hourdata[0].time, hourdata[length - 1].time) + "," + extendedEncode(y2_data, low, high);
        chart_url += "&chxr=0," + hourdata[0].time + "," + hourdata[length - 1].time + "|1," + low + "," + high;
        chart_url += "&chxl=0:|" + hour_string.join("|");
        chart_url += "&chxp=0," + time_string.join(",");

        //add y ticks
        chart_url += "&chxs=0,,10,0,lt";
        return chart_url;
    }

    rich.setImage(getImg());
    return ["",{embed:rich}];
}

commands.push(new Command({
    name: "weather",
    regex: /^wea(?:ther)? (\S.*)$/i,
    prefix: ".",
    testString: ".weather nyc",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return config.api.darksky;},
    log: true,
    points: 1,
    shortDesc: "returns 8 day forecast and chart of the temp for the next 2 days",
    longDesc: `.weather (location)
returns the 8 day forecast and a chart of the temperature for the next 2 days
location - can be several things like the name of a city or a zip code`,
    func: (message, args) =>{
        (async()=>{
            return await weather(args[1]);
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "pt",
    regex: /^pt ([^\r]+?)([ \n]?offline)?(?: ([\d]{1,2}))?$/i,
    prefix: ".",
    testString: ".pt tabula rasa",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "returns poe.trade based on item name or stats",
    longDesc: `.pt (item)
returns poe.trade based on item name or stats`,
    func: (message, args) =>{
        (async()=>{
            async function poesearch(message, args) {
                //let lm = message.channel.send("`Loading...`").catch(err);

                let online = "x";
                if (args[2] && args[2].toLowerCase() == " offline") online = "";
                let count = 6;
                if (args[3] && parseInt(args[3]) < 21 && parseInt(args[3]) > 0) count = parseInt(args[3])
                let poelinkid;
                let desc_list = [];
                args[1] = replaceAll(args[1], "’", "'");
                let stmt = sql.prepare("SELECT poeleague FROM users WHERE user_id = ?;")
                let poeleague = stmt.get(message.author.id).poeleague
                if (args[1].split("\n").length < 3) {
                    poelinkid = await requestpromiseheader({
                        method: 'POST',
                        url: "http://poe.trade/search",
                        followRedirect: false,
                        //proxy:'http://localhost:8888',
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        form: {
                            league: poeleague,
                            name: args[1],
                            online: online,
                            buyout: "x"
                        }
                    })
                } else {
                    //parse multiline
                    let form = {
                        league: poeleague,
                        online: online,
                        buyout: "x",
                        capquality: "x"
                    }
                    let group = args[1].split("\n--------\n");
                    group.forEach((e, i, aa) => {
                        aa[i] = e.split("\n")
                    })
                    if (group[0][0] === "Rarity: Unique") {
                        form.name = group[0][group[0].length - 2] + " " + group[0][group[0].length - 1];
                        form.rarity = "unique";
                        desc_list.push(`**Name: ${group[0][group[0].length - 2]} ${group[0][group[0].length - 1]}**`);
                        desc_list.push(`**Rarity: Unique**`);
                    } else if (group[0][group[0].length - 1] === "Stygian Vise") {
                        desc_list.push(`**Name: Stygian Vise**`);
                        form.name = group[0][group[0].length - 1];
                    } else if (group[0][0] === "Rarity: Rare") {
                        let bases = JSON.parse(`{"Helmet":["Aventail Helmet","Barbute Helmet","Battered Helm","Bone Circlet","Bone Helmet","Callous Mask","Close Helmet","Cone Helmet","Crusader Helmet","Deicide Mask","Eternal Burgonet","Ezomyte Burgonet","Fencer Helm","Festival Mask","Fluted Bascinet","Gilded Sallet","Gladiator Helmet","Golden Mask","Golden Wreath","Great Crown","Great Helmet","Harlequin Mask","Hubris Circlet","Hunter Hood","Iron Circlet","Iron Hat","Iron Mask","Lacquered Helmet","Leather Cap","Leather Hood","Lion Pelt","Lunaris Circlet","Magistrate Crown","Mind Cage","Necromancer Circlet","Nightmare Bascinet","Noble Tricorne","Pig-Faced Bascinet","Plague Mask","Praetor Crown","Prophet Crown","Raven Mask","Reaver Helmet","Regicide Mask","Royal Burgonet","Rusted Coif","Sallet","Samite Helmet","Scare Mask","Secutor Helm","Siege Helmet","Silken Hood","Sinner Tricorne","Solaris Circlet","Soldier Helmet","Steel Circlet","Torture Cage","Tribal Circlet","Tricorne","Ursine Pelt","Vaal Mask","Vine Circlet","Visored Sallet","Wolf Pelt","Zealot Helmet"],"One Hand Axe":["Arming Axe","Boarding Axe","Broad Axe","Butcher Axe","Ceremonial Axe","Chest Splitter","Cleaver","Decorative Axe","Engraved Hatchet","Etched Hatchet","Infernal Axe","Jade Hatchet","Jasper Axe","Karui Axe","Reaver Axe","Royal Axe","Runic Hatchet","Rusted Hatchet","Siege Axe","Spectral Axe","Tomahawk","Vaal Hatchet","War Axe","Wraith Axe","Wrist Chopper"],"Flask":["Amethyst Flask","Aquamarine Flask","Basalt Flask","Bismuth Flask","Colossal Hybrid Flask","Colossal Life Flask","Colossal Mana Flask","Diamond Flask","Divine Life Flask","Divine Mana Flask","Eternal Life Flask","Eternal Mana Flask","Giant Life Flask","Giant Mana Flask","Grand Life Flask","Grand Mana Flask","Granite Flask","Greater Life Flask","Greater Mana Flask","Hallowed Hybrid Flask","Hallowed Life Flask","Hallowed Mana Flask","Jade Flask","Large Hybrid Flask","Large Life Flask","Large Mana Flask","Medium Hybrid Flask","Medium Life Flask","Medium Mana Flask","Quartz Flask","Quicksilver Flask","Ruby Flask","Sacred Hybrid Flask","Sacred Life Flask","Sacred Mana Flask","Sanctified Life Flask","Sanctified Mana Flask","Sapphire Flask","Silver Flask","Small Hybrid Flask","Small Life Flask","Small Mana Flask","Stibnite Flask","Sulphur Flask","Topaz Flask"],"Fishing Rods":["Fishing Rod"],"One Hand Sword":["Ancient Sword","Antique Rapier","Apex Rapier","Baselard","Basket Rapier","Battered Foil","Battle Sword","Broad Sword","Burnished Foil","Charan's Sword","Copper Sword","Corsair Sword","Courtesan Sword","Cutlass","Dragonbone Rapier","Dragoon Sword","Dusk Blade","Elder Sword","Elegant Foil","Elegant Sword","Estoc","Eternal Sword","Fancy Foil","Gemstone Sword","Gladius","Graceful Sword","Grappler","Harpy Rapier","Hook Sword","Jagged Foil","Jewelled Foil","Legion Sword","Midnight Blade","Pecoraro","Primeval Rapier","Rusted Spike","Rusted Sword","Sabre","Serrated Foil","Smallsword","Spiraled Foil","Tempered Foil","Thorn Rapier","Tiger Hook","Twilight Blade","Vaal Blade","Vaal Rapier","Variscite Blade","War Sword","Whalebone Rapier","Wyrmbone Rapier"],"Claw":["Awl","Blinder","Cat's Paw","Double Claw","Eagle Claw","Eye Gouger","Fright Claw","Gemini Claw","Gouger","Great White Claw","Gut Ripper","Hellion's Paw","Imperial Claw","Nailed Fist","Noble Claw","Prehistoric Claw","Sharktooth Claw","Sparkling Claw","Terror Claw","Thresher Claw","Throat Stabber","Tiger's Paw","Timeworn Claw","Twin Claw","Vaal Claw"],"Breach":["Ancient Reliquary Key","Blessing of Chayula","Blessing of Esh","Blessing of Tul","Blessing of Uul-Netol","Blessing of Xoph","Chayula's Breachstone","Esh's Breachstone","Splinter of Chayula","Splinter of Esh","Splinter of Tul","Splinter of Uul-Netol","Splinter of Xoph","Tul's Breachstone","Uul-Netol's Breachstone","Xoph's Breachstone"],"Body Armour":["Arena Plate","Assassin's Garb","Astral Plate","Battle Lamellar","Battle Plate","Blood Raiment","Bone Armour","Bronze Plate","Buckskin Tunic","Cabalist Regalia","Carnal Armour","Chain Hauberk","Chainmail Doublet","Chainmail Tunic","Chainmail Vest","Chestplate","Colosseum Plate","Commander's Brigandine","Conjurer's Vestment","Conquest Chainmail","Copper Plate","Coronal Leather","Crimson Raiment","Crusader Chainmail","Crusader Plate","Crypt Armour","Cutthroat's Garb","Desert Brigandine","Destiny Leather","Destroyer Regalia","Devout Chainmail","Dragonscale Doublet","Eelskin Tunic","Elegant Ringmail","Exquisite Leather","Field Lamellar","Frontier Leather","Full Chainmail","Full Dragonscale","Full Leather","Full Plate","Full Ringmail","Full Scale Armour","Full Wyrmscale","General's Brigandine","Gladiator Plate","Glorious Leather","Glorious Plate","Golden Mantle","Golden Plate","Holy Chainmail","Hussar Brigandine","Infantry Brigandine","Lacquered Garb","Latticed Ringmail","Light Brigandine","Lordly Plate","Loricated Ringmail","Mage's Vestment","Majestic Plate","Necromancer Silks","Occultist's Vestment","Oiled Coat","Oiled Vest","Ornate Ringmail","Padded Jacket","Padded Vest","Plate Vest","Quilted Jacket","Ringmail Coat","Sacrificial Garb","Sadist Garb","Sage's Robe","Saint's Hauberk","Saintly Chainmail","Savant's Robe","Scale Doublet","Scale Vest","Scarlet Raiment","Scholar's Robe","Sentinel Jacket","Shabby Jerkin","Sharkskin Tunic","Silk Robe","Silken Garb","Silken Vest","Silken Wrap","Simple Robe","Sleek Coat","Soldier's Brigandine","Spidersilk Robe","Strapped Leather","Sun Leather","Sun Plate","Thief's Garb","Triumphant Lamellar","Vaal Regalia","Varnished Coat","War Plate","Waxed Garb","Widowsilk Robe","Wild Leather","Wyrmscale Doublet","Zodiac Leather"],"Map":["Abyss Map","Academy Map","Acid Lakes Map","Alleyways Map","Ancient City Map","Arachnid Nest Map","Arachnid Tomb Map","Arcade Map","Arena Map","Arid Lake Map","Armoury Map","Arsenal Map","Ashen Wood Map","Atoll Map","Barrows Map","Basilica Map","Bazaar Map","Beach Map","Beacon Map","Belfry Map","Bog Map","Bone Crypt Map","Burial Chambers Map","Cage Map","Caldera Map","Canyon Map","Carcass Map","Castle Ruins Map","Catacombs Map","Cavern Map","Cells Map","Cemetery Map","Channel Map","Chateau Map","City Square Map","Colonnade Map","Colosseum Map","Conservatory Map","Coral Ruins Map","Core Map","Courthouse Map","Courtyard Map","Coves Map","Crematorium Map","Crimson Temple Map","Crypt Map","Crystal Ore Map","Cursed Crypt Map","Dark Forest Map","Defiled Cathedral Map","Desert Map","Desert Spring Map","Dig Map","Dunes Map","Dungeon Map","Estuary Map","Excavation Map","Factory Map","Fields Map","Flooded Mine Map","Forge of the Phoenix Map","Gardens Map","Geode Map","Ghetto Map","Gorge Map","Graveyard Map","Grotto Map","Harbinger Map","Haunted Mansion Map","High Gardens Map","Iceberg Map","Infested Valley Map","Ivory Temple Map","Jungle Valley Map","Laboratory Map","Lair Map","Lair of the Hydra Map","Lava Chamber Map","Lava Lake Map","Leyline Map","Lighthouse Map","Lookout Map","Malformation Map","Marshes Map","Mausoleum Map","Maze Map","Maze of the Minotaur Map","Mesa Map","Mineral Pools Map","Moon Temple Map","Mud Geyser Map","Museum Map","Necropolis Map","Oasis Map","Orchard Map","Overgrown Ruin Map","Overgrown Shrine Map","Palace Map","Park Map","Pen Map","Peninsula Map","Phantasmagoria Map","Pier Map","Pit Map","Pit of the Chimera Map","Plateau Map","Plaza Map","Port Map","Precinct Map","Primordial Pool Map","Promenade Map","Quarry Map","Racecourse Map","Ramparts Map","Reef Map","Relic Chambers Map","Residence Map","Scriptorium Map","Sepulchre Map","Sewer Map","Shaped Academy Map","Shaped Acid Lakes Map","Shaped Arachnid Nest Map","Shaped Arachnid Tomb Map","Shaped Arcade Map","Shaped Arena Map","Shaped Arid Lake Map","Shaped Armoury Map","Shaped Arsenal Map","Shaped Ashen Wood Map","Shaped Atoll Map","Shaped Barrows Map","Shaped Beach Map","Shaped Bog Map","Shaped Burial Chambers Map","Shaped Canyon Map","Shaped Castle Ruins Map","Shaped Catacombs Map","Shaped Cavern Map","Shaped Cells Map","Shaped Cemetery Map","Shaped Channel Map","Shaped Colonnade Map","Shaped Courtyard Map","Shaped Coves Map","Shaped Crypt Map","Shaped Crystal Ore Map","Shaped Desert Map","Shaped Dunes Map","Shaped Dungeon Map","Shaped Factory Map","Shaped Ghetto Map","Shaped Graveyard Map","Shaped Grotto Map","Shaped Jungle Valley Map","Shaped Malformation Map","Shaped Marshes Map","Shaped Mesa Map","Shaped Mud Geyser Map","Shaped Museum Map","Shaped Oasis Map","Shaped Orchard Map","Shaped Overgrown Shrine Map","Shaped Peninsula Map","Shaped Phantasmagoria Map","Shaped Pier Map","Shaped Pit Map","Shaped Port Map","Shaped Primordial Pool Map","Shaped Promenade Map","Shaped Quarry Map","Shaped Racecourse Map","Shaped Ramparts Map","Shaped Reef Map","Shaped Sewer Map","Shaped Shore Map","Shaped Spider Forest Map","Shaped Spider Lair Map","Shaped Strand Map","Shaped Temple Map","Shaped Terrace Map","Shaped Thicket Map","Shaped Tower Map","Shaped Tropical Island Map","Shaped Underground River Map","Shaped Vaal City Map","Shaped Vaal Pyramid Map","Shaped Villa Map","Shaped Waste Pool Map","Shaped Wharf Map","Shipyard Map","Shore Map","Shrine Map","Siege Map","Spider Forest Map","Spider Lair Map","Springs Map","Strand Map","Sulphur Vents Map","Sulphur Wastes Map","Summit Map","Sunken City Map","Temple Map","Terrace Map","Thicket Map","Torture Chamber Map","Tower Map","Toxic Sewer Map","Tribunal Map","Tropical Island Map","Underground River Map","Underground Sea Map","Vaal City Map","Vaal Pyramid Map","Vaal Temple Map","Vault Map","Villa Map","Volcano Map","Waste Pool Map","Wasteland Map","Waterways Map","Wharf Map"],"One Hand Mace":["Ancestral Club","Auric Mace","Barbed Club","Battle Hammer","Behemoth Mace","Bladed Mace","Ceremonial Mace","Dragon Mace","Dream Mace","Driftwood Club","Flanged Mace","Gavel","Legion Hammer","Nightmare Mace","Ornate Mace","Pernarch","Petrified Club","Phantom Mace","Rock Breaker","Spiked Club","Stone Hammer","Tenderizer","Tribal Club","War Hammer","Wyrm Mace"],"Amulet":["Agate Amulet","Amber Amulet","Ashscale Talisman","Avian Twins Talisman","Black Maw Talisman","Blue Pearl Amulet","Bonespire Talisman","Breakrib Talisman","Chrysalis Talisman","Citrine Amulet","Clutching Talisman","Coral Amulet","Deadhand Talisman","Deep One Talisman","Fangjaw Talisman","Gold Amulet","Greatwolf Talisman","Hexclaw Talisman","Horned Talisman","Jade Amulet","Jet Amulet","Jet Amulet","Lapis Amulet","Lone Antler Talisman","Longtooth Talisman","Mandible Talisman","Marble Amulet","Monkey Paw Talisman","Monkey Twins Talisman","Onyx Amulet","Paua Amulet","Primal Skull Talisman","Rot Head Talisman","Rotfeather Talisman","Ruby Amulet","Spinefuse Talisman","Splitnewt Talisman","Three Hands Talisman","Three Rat Talisman","Turquoise Amulet","Undying Flesh Talisman","Wereclaw Talisman","Writhing Talisman"],"Two Hand Mace":["Brass Maul","Colossus Mallet","Coronal Maul","Dread Maul","Driftwood Maul","Fright Maul","Great Mallet","Imperial Maul","Jagged Maul","Karui Maul","Mallet","Meatgrinder","Morning Star","Piledriver","Plated Maul","Sledgehammer","Solar Maul","Spiny Maul","Steelhead","Terror Maul","Totemic Maul","Tribal Maul"],"Sceptre":["Abyssal Sceptre","Blood Sceptre","Bronze Sceptre","Carnal Sceptre","Crystal Sceptre","Darkwood Sceptre","Driftwood Sceptre","Grinning Fetish","Horned Sceptre","Iron Sceptre","Karui Sceptre","Lead Sceptre","Ochre Sceptre","Opal Sceptre","Platinum Sceptre","Quartz Sceptre","Ritual Sceptre","Royal Sceptre","Sambar Sceptre","Sekhem","Shadow Sceptre","Stag Sceptre","Tyrant's Sekhem","Vaal Sceptre","Void Sceptre"],"Two Hand Axe":["Abyssal Axe","Dagger Axe","Despot Axe","Double Axe","Ezomyte Axe","Fleshripper","Gilded Axe","Headsman Axe","Jade Chopper","Jasper Chopper","Karui Chopper","Labrys","Noble Axe","Poleaxe","Shadow Axe","Stone Axe","Sundering Axe","Talon Axe","Timber Axe","Vaal Axe","Void Axe","Woodsplitter"],"Prophecy":["A Call into the Void","A Firm Foothold","A Forest of False Idols","A Gracious Master","A Master Seeks Help","A Prodigious Hand","A Regal Death","A Valuable Combination","A Whispered Prayer","Abnormal Effulgence","Against the Tide","An Unseen Peril","Anarchy's End I","Anarchy's End II","Anarchy's End III","Anarchy's End IV","Ancient Doom","Ancient Rivalries I","Ancient Rivalries II","Ancient Rivalries III","Ancient Rivalries IV","Baptism by Death","Beyond Sight I","Beyond Sight II","Beyond Sight III","Beyond Sight IV","Beyond Sight V","Blood in the Eyes","Blood of the Betrayed","Bountiful Traps","Brothers in Arms","Cleanser of Sins","Crash Test","Crushing Squall","Custodians of Silence","Day of Sacrifice I","Day of Sacrifice II","Day of Sacrifice III","Day of Sacrifice IV","Deadly Rivalry I","Deadly Rivalry II","Deadly Rivalry III","Deadly Rivalry IV","Deadly Rivalry V","Deadly Twins","Defiled in the Scepter","Delay Test","Delay and Crash Test","Dying Cry","Echoes of Lost Love","Echoes of Mutation","Echoes of Witchcraft","Ending the Torment","Enter the Maelström","Erased from Memory","Erasmus' Gift","Fallow At Last","Fated Connections","Fear's Wide Reach","Fire and Brimstone","Fire and Ice","Fire from the Sky","Fire, Wood and Stone","Flesh of the Beast","Forceful Exorcism","From Death Springs Life","From The Void","Gilded Within","Golden Touch","Graceful Flames","Heart of the Fire","Heavy Blows","Hidden Reinforcements","Hidden Vaal Pathways","Holding the Bridge","Hunter's Lesson","Ice from Above","In the Grasp of Corruption","Kalandra's Craft","Lasting Impressions","Lightning Falls","Living Fires","Lost in the Pages","Monstrous Treasure","Mouth of Horrors","Mysterious Invaders","Nature's Resilience","Nemesis of Greed","Notched Flesh","Overflowing Riches","Path of Betrayal","Plague of Frogs","Plague of Rats","Pleasure and Pain","Pools of Wealth","Possessed Foe","Power Magnified","Rebirth","Reforged Bonds","Resistant to Change","Risen Blood","Roth's Legacy","SHOULD NOT APPEAR","Sanctum of Stone","Severed Limbs","Smothering Tendrils","Soil, Worms and Blood","Storm on the Horizon","Storm on the Shore","Strong as a Bull","Thaumaturgical History I","Thaumaturgical History II","Thaumaturgical History III","Thaumaturgical History IV","The Aesthete's Spirit","The Alchemist","The Ambitious Bandit I","The Ambitious Bandit II","The Ambitious Bandit III","The Apex Predator","The Beautiful Guide","The Beginning and the End","The Black Stone I","The Black Stone II","The Black Stone III","The Black Stone IV","The Blacksmith","The Blessing","The Bloody Flowers Redux","The Bowstring's Music","The Brothers of Necromancy","The Brutal Enforcer","The Child of Lunaris","The Corrupt","The Cursed Choir","The Dream Trial","The Dreamer's Dream","The Eagle's Cry","The Emperor's Trove","The Feral Lord I","The Feral Lord II","The Feral Lord III","The Feral Lord IV","The Feral Lord V","The Flayed Man","The Flow of Energy","The Forgotten Garrison","The Forgotten Soldiers","The Fortune Teller's Collection","The Four Feral Exiles","The God of Misfortune","The Hardened Armour","The Hollow Pledge","The Hungering Swarm","The Invader","The Jeweller's Touch","The Karui Rebellion","The King and the Brambles","The King's Path","The Lady in Black","The Last Watch","The Lost Maps","The Lost Undying","The Misunderstood Queen","The Mysterious Gift","The Nest","The Pair","The Petrified","The Pirate's Den","The Plaguemaw I","The Plaguemaw II","The Plaguemaw III","The Plaguemaw IV","The Plaguemaw V","The Prison Guard","The Prison Key","The Queen's Vaults","The Scout","The Servant's Heart","The Sharpened Blade","The Silverwood","The Singular Spirit","The Sinner's Stone","The Snuffed Flame","The Soulless Beast","The Spread of Corruption","The Stockkeeper","The Sword King's Passion","The Trembling Earth","The Twins","The Unbreathing Queen I","The Unbreathing Queen II","The Unbreathing Queen III","The Unbreathing Queen IV","The Unbreathing Queen V","The Undead Brutes","The Undead Storm","The Vanguard","The Walking Mountain","The Ward's Ward","The Warmongers I","The Warmongers II","The Warmongers III","The Warmongers IV","The Watcher's Watcher","The Wealthy Exile","Through the Mirage","Touched by Death","Touched by the Wind","Trash to Treasure","Twice Enchanted","Unbearable Whispers I","Unbearable Whispers II","Unbearable Whispers III","Unbearable Whispers IV","Unbearable Whispers V","Undead Uprising","Unnatural Energy","Vaal Invasion","Vaal Winds","Visions of the Drowned","Vital Transformation","Waiting in Ambush","Weeping Death","Wind and Thunder","Winter's Mournful Melodies"],"Gem":["Abyssal Cry","Added Chaos Damage","Added Cold Damage","Added Fire Damage","Added Lightning Damage","Additional Accuracy","Ancestral Call Support","Ancestral Protector","Ancestral Warchief","Anger","Animate Guardian","Animate Weapon","Arc","Arcane Surge Support","Arctic Armour","Arctic Breath","Assassin's Mark","Ball Lightning","Ball Lightning","Barrage","Bear Trap","Blade Flurry","Blade Vortex","Bladefall","Blasphemy","Blast Rain","Blight","Blind","Blink Arrow","Block Chance Reduction","Blood Magic","Blood Rage","Bloodlust","Bodyswap","Bone Offering","Brutality Support","Burning Arrow","Burning Damage Support","Cast On Critical Strike","Cast on Death","Cast on Melee Kill","Cast when Damage Taken","Cast when Stunned","Cast while Channelling Support","Caustic Arrow","Chain","Chance to Bleed Support","Chance to Flee","Chance to Ignite","Charged Dash","Clarity","Cleave","Cluster Traps","Cold Penetration","Cold Snap","Cold to Fire","Concentrated Effect","Conductivity","Contagion","Controlled Destruction","Conversion Trap","Convocation","Cremation","Culling Strike","Curse On Hit","Cyclone","Damage on Full Life Support","Dark Pact","Deadly Ailments Support","Decay Support","Decoy Totem","Desecrate","Despair","Determination","Detonate Dead","Detonate Mines","Devouring Totem","Discharge","Discipline","Dominating Blow","Double Strike","Dual Strike","Earthquake","Efficacy Support","Elemental Damage with Attacks Support","Elemental Focus","Elemental Hit","Elemental Proliferation","Elemental Weakness","Empower","Endurance Charge on Melee Stun","Enduring Cry","Enfeeble","Enhance","Enlighten","Essence Drain","Ethereal Knives","Explosive Arrow","Faster Attacks","Faster Casting","Faster Projectiles","Fire Nova Mine","Fire Penetration","Fire Trap","Fireball","Firestorm","Flame Dash","Flame Surge","Flame Totem","Flameblast","Flammability","Flesh Offering","Flicker Strike","Fork","Fortify","Freeze Mine","Freezing Pulse","Frenzy","Frost Blades","Frost Bomb","Frost Wall","Frostbite","Frostbolt","Generosity","Glacial Cascade","Glacial Hammer","Grace","Greater Multiple Projectiles","Ground Slam","Haste","Hatred","Heavy Strike","Herald of Ash","Herald of Ice","Herald of Thunder","Hypothermia","Ice Bite","Ice Crash","Ice Nova","Ice Shot","Ice Spear","Ice Trap","Ignite Proliferation Support","Immolate Support","Immortal Call","Incinerate","Increased Area of Effect","Increased Critical Damage","Increased Critical Strikes","Increased Duration","Infernal Blow","Innervate","Iron Grip","Iron Will","Item Quantity","Item Rarity","Kinetic Blast","Knockback","Lacerate","Leap Slam","Less Duration","Lesser Multiple Projectiles","Lesser Poison Support","Life Gain on Hit","Life Leech","Lightning Arrow","Lightning Penetration","Lightning Strike","Lightning Tendrils","Lightning Trap","Lightning Warp","Magma Orb","Maim Support","Mana Leech","Melee Physical Damage","Melee Splash","Minefield","Minion Damage","Minion Life","Minion Speed","Minion and Totem Elemental Resistance","Mirage Archer Support","Mirror Arrow","Molten Shell","Molten Strike","Multiple Traps","Multistrike","Onslaught Support","Orb of Storms","Phase Run","Physical Projectile Attack Damage","Physical to Lightning","Pierce","Poacher's Mark","Point Blank","Poison","Portal","Power Charge On Critical","Power Siphon","Projectile Weakness","Puncture","Punishment","Purity of Elements","Purity of Fire","Purity of Ice","Purity of Lightning","Rain of Arrows","Raise Spectre","Raise Zombie","Rallying Cry","Ranged Attack Totem","Reave","Reckoning","Reduced Mana","Rejuvenation Totem","Remote Mine","Righteous Fire","Riposte","Ruthless Support","Scorching Ray","Searing Bond","Shield Charge","Shock Nova","Shockwave Totem","Shrapnel Shot","Siege Ballista","Slower Projectiles","Smoke Mine","Spark","Spectral Throw","Spell Cascade Support","Spell Echo","Spell Totem","Spirit Offering","Split Arrow","Static Strike","Storm Barrier Support","Storm Burst","Storm Call","Stun","Summon Chaos Golem","Summon Flame Golem","Summon Ice Golem","Summon Lightning Golem","Summon Raging Spirit","Summon Skeleton","Summon Stone Golem","Sunder","Sweep","Swift Affliction Support","Tempest Shield","Temporal Chains","Tornado Shot","Trap","Trap Cooldown","Trap and Mine Damage","Unbound Ailments Support","Unearth","Vaal Arc","Vaal Breach","Vaal Burning Arrow","Vaal Clarity","Vaal Cold Snap","Vaal Cyclone","Vaal Detonate Dead","Vaal Discipline","Vaal Double Strike","Vaal Fireball","Vaal Flameblast","Vaal Glacial Hammer","Vaal Grace","Vaal Ground Slam","Vaal Haste","Vaal Ice Nova","Vaal Immortal Call","Vaal Lightning Strike","Vaal Lightning Trap","Vaal Lightning Warp","Vaal Molten Shell","Vaal Power Siphon","Vaal Rain of Arrows","Vaal Reave","Vaal Righteous Fire","Vaal Spark","Vaal Spectral Throw","Vaal Storm Call","Vaal Summon Skeletons","Vengeance","Vigilant Strike","Vile Toxins Support","Viper Strike","Vitality","Void Manipulation","Volatile Dead","Volley Support","Vortex","Vulnerability","Warlord's Mark","Whirling Blades","Wild Strike","Wither","Wrath"],"Two Hand Sword":["Bastard Sword","Butcher Sword","Corroded Blade","Curved Blade","Engraved Greatsword","Etched Greatsword","Exquisite Blade","Ezomyte Blade","Footman Sword","Headman's Sword","Highland Blade","Infernal Sword","Lion Sword","Lithe Blade","Longsword","Ornate Sword","Reaver Sword","Spectral Sword","Tiger Sword","Two-Handed Sword","Vaal Greatsword","Wraith Sword"],"Jewel":["Cobalt Jewel","Crimson Jewel","Ghastly Eye Jewel","Hypnotic Eye Jewel","Murderous Eye Jewel","Prismatic Jewel","Searching Eye Jewel","Viridian Jewel"],"Bow":["Assassin Bow","Bone Bow","Citadel Bow","Composite Bow","Compound Bow","Crude Bow","Death Bow","Decimation Bow","Decurve Bow","Golden Flame","Grove Bow","Harbinger Bow","Highborn Bow","Imperial Bow","Ivory Bow","Long Bow","Maraketh Bow","Ranger Bow","Recurve Bow","Reflex Bow","Royal Bow","Short Bow","Sniper Bow","Spine Bow","Steelwood Bow","Thicket Bow"],"Gloves":["Ambush Mitts","Ancient Gauntlets","Antique Gauntlets","Arcanist Gloves","Assassin's Mitts","Bronze Gauntlets","Bronzescale Gauntlets","Carnal Mitts","Chain Gloves","Clasped Mitts","Conjurer Gloves","Crusader Gloves","Deerskin Gloves","Dragonscale Gauntlets","Eelskin Gloves","Embroidered Gloves","Fingerless Silk Gloves","Fishscale Gauntlets","Goathide Gloves","Golden Bracers","Goliath Gauntlets","Gripped Gloves","Hydrascale Gauntlets","Iron Gauntlets","Ironscale Gauntlets","Legion Gloves","Mesh Gloves","Murder Mitts","Nubuck Gloves","Plated Gauntlets","Rawhide Gloves","Ringmail Gloves","Riveted Gloves","Samite Gloves","Satin Gloves","Serpentscale Gauntlets","Shagreen Gloves","Sharkskin Gloves","Silk Gloves","Slink Gloves","Soldier Gloves","Sorcerer Gloves","Spiked Gloves","Stealth Gloves","Steel Gauntlets","Steelscale Gauntlets","Strapped Mitts","Titan Gauntlets","Trapper Mitts","Vaal Gauntlets","Velvet Gloves","Wool Gloves","Wrapped Mitts","Wyrmscale Gauntlets","Zealot Gloves"],"Map Fragments":["Divine Vessel","Eber's Key","Fragment of the Chimera","Fragment of the Hydra","Fragment of the Minotaur","Fragment of the Phoenix","Inya's Key","Mortal Grief","Mortal Hope","Mortal Ignorance","Mortal Rage","Offering to the Goddess","Sacrifice at Dawn","Sacrifice at Dusk","Sacrifice at Midnight","Sacrifice at Noon","Volkuur's Key","Yriel's Key"],"Quiver":["Blunt Arrow Quiver","Broadhead Arrow Quiver","Conductive Quiver","Cured Quiver","Fire Arrow Quiver","Heavy Quiver","Light Quiver","Penetrating Arrow Quiver","Rugged Quiver","Serrated Arrow Quiver","Sharktooth Arrow Quiver","Spike-Point Arrow Quiver","Two-Point Arrow Quiver"],"Divination Card":["A Mother's Parting Gift","Abandoned Wealth","Anarchy's Price","Assassin's Favour","Atziri's Arsenal","Audacity","Birth of the Three","Blind Venture","Boundless Realms","Bowyer's Dream","Call to the First Ones","Cartographer's Delight","Chaotic Disposition","Coveted Possession","Death","Destined to Crumble","Dialla's Subjugation","Doedre's Madness","Dying Anguish","Earth Drinker","Emperor of Purity","Emperor's Luck","Gemcutter's Promise","Gift of the Gemling Queen","Glimmer of Hope","Grave Knowledge","Her Mask","Heterochromia","Hope","House of Mirrors","Hubris","Humility","Hunter's Resolve","Hunter's Reward","Jack in the Box","Lantador's Lost Love","Last Hope","Left to Fate","Light and Truth","Lingering Remnants","Lost Worlds","Loyalty","Lucky Connections","Lucky Deck","Lysah's Respite","Mawr Blaidd","Merciless Armament","Might is Right","Mitts","No Traces","Pride Before the Fall","Prosperity","Rain Tempter","Rain of Chaos","Rats","Rebirth","Scholar of the Seas","Shard of Fate","Struck by Lightning","The Aesthete","The Arena Champion","The Artist","The Avenger","The Battle Born","The Betrayal","The Blazing Fire","The Body","The Brittle Emperor","The Calling","The Carrion Crow","The Cartographer","The Cataclysm","The Catalyst","The Celestial Justicar","The Chains that Bind","The Coming Storm","The Conduit","The Cursed King","The Dapper Prodigy","The Dark Mage","The Demoness","The Devastator","The Doctor","The Doppelganger","The Dragon","The Dragon's Heart","The Drunken Aristocrat","The Encroaching Darkness","The Endurance","The Enlightened","The Ethereal","The Explorer","The Eye of the Dragon","The Feast","The Fiend","The Fletcher","The Flora's Gift","The Formless Sea","The Forsaken","The Fox","The Gambler","The Garish Power","The Gemcutter","The Gentleman","The Gladiator","The Harvester","The Hermit","The Hoarder","The Hunger","The Immortal","The Incantation","The Inoculated","The Inventor","The Jester","The King's Blade","The King's Heart","The Last One Standing","The Lich","The Lion","The Lord in Black","The Lover","The Lunaris Priestess","The Mercenary","The Metalsmith's Gift","The Oath","The Offering","The One With All","The Opulent","The Pack Leader","The Pact","The Penitent","The Poet","The Polymath","The Porcupine","The Queen","The Rabid Rhoa","The Realm","The Risk","The Road to Power","The Ruthless Ceinture","The Saint's Treasure","The Scarred Meadow","The Scavenger","The Scholar","The Sephirot","The Sigil","The Siren","The Soul","The Spark and the Flame","The Spoiled Prince","The Standoff","The Stormcaller","The Summoner","The Sun","The Surgeon","The Surveyor","The Survivalist","The Thaumaturgist","The Throne","The Tower","The Traitor","The Trial","The Twins","The Tyrant","The Union","The Valkyrie","The Valley of Steel Boxes","The Vast","The Visionary","The Void","The Warden","The Warlord","The Watcher","The Web","The Wind","The Wolf","The Wolf's Shadow","The Wolven King's Bite","The Wolverine","The Wrath","The Wretched","Three Faces in the Dark","Thunderous Skies","Time-Lost Relic","Tranquillity","Treasure Hunter","Turn the Other Cheek","Vinia's Token","Volatile Power","Wealth and Power"],"Shield":["Alder Spiked Shield","Alloyed Spiked Shield","Ancient Spirit Shield","Angelic Kite Shield","Archon Kite Shield","Baroque Round Shield","Battle Buckler","Bone Spirit Shield","Branded Kite Shield","Brass Spirit Shield","Bronze Tower Shield","Buckskin Tower Shield","Burnished Spiked Shield","Cardinal Round Shield","Cedar Tower Shield","Ceremonial Kite Shield","Champion Kite Shield","Chiming Spirit Shield","Colossal Tower Shield","Compound Spiked Shield","Copper Tower Shield","Corroded Tower Shield","Corrugated Buckler","Crested Tower Shield","Crimson Round Shield","Crusader Buckler","Driftwood Spiked Shield","Ebony Tower Shield","Elegant Round Shield","Enameled Buckler","Etched Kite Shield","Ezomyte Spiked Shield","Ezomyte Tower Shield","Fir Round Shield","Fossilised Spirit Shield","Gilded Buckler","Girded Tower Shield","Goathide Buckler","Golden Buckler","Hammered Buckler","Harmonic Spirit Shield","Imperial Buckler","Ironwood Buckler","Ivory Spirit Shield","Jingling Spirit Shield","Lacewood Spirit Shield","Lacquered Buckler","Laminated Kite Shield","Layered Kite Shield","Linden Kite Shield","Mahogany Tower Shield","Maple Round Shield","Mirrored Spiked Shield","Mosaic Kite Shield","Oak Buckler","Ornate Spiked Shield","Painted Buckler","Painted Tower Shield","Pine Buckler","Pinnacle Tower Shield","Plank Kite Shield","Polished Spiked Shield","Rawhide Tower Shield","Redwood Spiked Shield","Reinforced Kite Shield","Reinforced Tower Shield","Rotted Round Shield","Scarlet Round Shield","Shagreen Tower Shield","Sovereign Spiked Shield","Spiked Bundle","Spiked Round Shield","Spiny Round Shield","Splendid Round Shield","Splintered Tower Shield","Steel Kite Shield","Studded Round Shield","Supreme Spiked Shield","Tarnished Spirit Shield","Teak Round Shield","Thorium Spirit Shield","Titanium Spirit Shield","Twig Spirit Shield","Vaal Buckler","Vaal Spirit Shield","Walnut Spirit Shield","War Buckler","Yew Spirit Shield"],"Dagger":["Ambusher","Boot Blade","Boot Knife","Butcher Knife","Carving Knife","Copper Kris","Demon Dagger","Ezomyte Dagger","Fiend Dagger","Flaying Knife","Glass Shank","Golden Kris","Gutting Knife","Imp Dagger","Imperial Skean","Platinum Kris","Poignard","Prong Dagger","Royal Skean","Sai","Skean","Skinning Knife","Slaughter Knife","Stiletto","Trisula"],"Leaguestone":["Ambush Leaguestone","Anarchy Leaguestone","Beyond Leaguestone","Bloodlines Leaguestone","Breach Leaguestone","Domination Leaguestone","Essence Leaguestone","Invasion Leaguestone","Nemesis Leaguestone","Onslaught Leaguestone","Perandus Leaguestone","Prophecy Leaguestone","Rampage Leaguestone","Talisman Leaguestone","Tempest Leaguestone","Torment Leaguestone","Warbands Leaguestone"],"Wand":["Carved Wand","Crystal Wand","Demon's Horn","Driftwood Wand","Engraved Wand","Faun's Horn","Goat's Horn","Heathen Wand","Imbued Wand","Omen Wand","Opal Wand","Pagan Wand","Profane Wand","Prophecy Wand","Quartz Wand","Sage Wand","Serpent Wand","Spiraled Wand","Tornado Wand"],"Essence":["Essence of Anger","Essence of Anguish","Essence of Contempt","Essence of Delirium","Essence of Doubt","Essence of Dread","Essence of Envy","Essence of Fear","Essence of Greed","Essence of Hatred","Essence of Horror","Essence of Hysteria","Essence of Insanity","Essence of Loathing","Essence of Misery","Essence of Rage","Essence of Scorn","Essence of Sorrow","Essence of Spite","Essence of Suffering","Essence of Torment","Essence of Woe","Essence of Wrath","Essence of Zeal","Remnant of Corruption"],"Boots":["Ambush Boots","Ancient Greaves","Antique Greaves","Arcanist Slippers","Assassin's Boots","Bronzescale Boots","Carnal Boots","Chain Boots","Clasped Boots","Conjurer Boots","Crusader Boots","Deerskin Boots","Dragonscale Boots","Eelskin Boots","Goathide Boots","Golden Caligae","Goliath Greaves","Hydrascale Boots","Iron Greaves","Ironscale Boots","Leatherscale Boots","Legion Boots","Mesh Boots","Murder Boots","Nubuck Boots","Plated Greaves","Rawhide Boots","Reinforced Greaves","Ringmail Boots","Riveted Boots","Samite Slippers","Satin Slippers","Scholar Boots","Serpentscale Boots","Shackled Boots","Shagreen Boots","Sharkskin Boots","Silk Slippers","Slink Boots","Soldier Boots","Sorcerer Boots","Stealth Boots","Steel Greaves","Steelscale Boots","Strapped Boots","Titan Greaves","Trapper Boots","Two-Toned Boots","Vaal Greaves","Velvet Slippers","Wool Shoes","Wrapped Boots","Wyrmscale Boots","Zealot Boots"],"Currency":["Albino Rhoa Feather","Ancient Orb","Ancient Shard","Annulment Shard","Apprentice Cartographer's Seal","Apprentice Cartographer's Sextant","Armourer's Scrap","Binding Shard","Blacksmith's Whetstone","Blessed Orb","Cartographer's Chisel","Chaos Orb","Chaos Shard","Chromatic Orb","Divine Orb","Engineer's Orb","Engineer's Shard","Eternal Orb","Exalted Orb","Exalted Shard","Gemcutter's Prism","Glassblower's Bauble","Harbinger's Orb","Harbinger's Shard","Horizon Shard","Jeweller's Orb","Journeyman Cartographer's Seal","Journeyman Cartographer's Sextant","Master Cartographer's Seal","Master Cartographer's Sextant","Mirror Shard","Mirror of Kalandra","Orb of Alchemy","Orb of Alteration","Orb of Annulment","Orb of Augmentation","Orb of Binding","Orb of Chance","Orb of Fusing","Orb of Horizons","Orb of Regret","Orb of Scouring","Orb of Transmutation","Perandus Coin","Portal Scroll","Regal Orb","Regal Shard","Scroll of Wisdom","Silver Coin","Stacked Deck","Unshaping Orb","Vaal Orb"],"Ring":["Amethyst Ring","Breach Ring","Coral Ring","Diamond Ring","Gold Ring","Golden Hoop","Iron Ring","Moonstone Ring","Opal Ring","Paua Ring","Prismatic Ring","Ruby Ring","Sapphire Ring","Steel Ring","Topaz Ring","Two-Stone Ring","Unset Ring"],"Belt":["Chain Belt","Cloth Belt","Crystal Belt","Golden Obi","Heavy Belt","Leather Belt","Rustic Sash","Studded Belt","Stygian Vise","Vanguard Belt"],"Staff":["Coiled Staff","Crescent Staff","Eclipse Staff","Ezomyte Staff","Foul Staff","Gnarled Branch","Highborn Staff","Imperial Staff","Iron Staff","Judgement Staff","Lathi","Long Staff","Maelström Staff","Military Staff","Moon Staff","Primitive Staff","Primordial Staff","Quarterstaff","Royal Staff","Serpentine Staff","Vile Staff","Woodful Staff"]}`)
                        let name = group[0][group[0].length - 1]
                        function getBase(name) {
                            for (let i in bases) {
                                if (bases[i].indexOf(name) > -1) {
                                    return i;
                                }
                            }
                            return null;
                        }
                        form.type = getBase(name);
                        desc_list.push(`**Type: ${form.type}**`);
                    }
                    else {
                        form.name = group[0][group[0].length - 1];
                        desc_list.push(`**Name: ${form.name}**`);
                    }
                    //TODO rare
                    //switch form to a string
                    let formstring = Object.keys(form).map((e) => {
                        return `${e}=${encodeURIComponent(form[e])}`
                    }).join("&");

                    let formose = false;
                    if (group[group.length - 1][group[group.length - 1].length - 1] == "f") {
                        formose = true;
                    }
                    if (group[group.length - 1][group[group.length - 1].length - 1] != "x") {
                        let itemlevel = group.findIndex((e) => {
                            return e[0].match(/Item Level: (\d+)/g)
                        });
                        if (itemlevel > -1) {
                            itemlevel++;
                            if (group[itemlevel][0] !== "Unidentified") {
                                let group_count = 0;
                                let totalresist = 0;
                                let totalhealth = 0;
                                let chaosresist = 0;
                                if (group[itemlevel].length === 1) {
                                    let e = group[itemlevel][0];
                                    //group[itemlevel][0].replace(/^(\+?)(\d+)(%?.+)$/, (m, p1, p2, p3) => {
                                    let b;
                                    if (b = /^(\+)(\d+)(% to )(Fire|Cold|Lightning)( Resistance)/.exec(e)) {
                                        totalresist += parseInt(b[2]);
                                    }
                                    else if (b = /^(\+)(\d+)(% to )(Fire|Cold|Lightning) and (Fire|Cold|Lightning)( Resistances)/.exec(e)) {
                                        totalresist += parseInt(b[2]) * 2;
                                    }
                                    else if (b = /^(\+)(\d+)(% to all Elemental Resistances)/.exec(e)) {
                                        totalresist += parseInt(b[2]) * 3;
                                    }
                                    else if (b = /^(\+)(\d+)( to maximum Life)/.exec(e)) {
                                        totalhealth += parseInt(b[2]);
                                    }
                                    else {
                                        if (!formose && (b = /^(\+?)(\d+(?:\.\d+)?)(%?.+)$/.exec(e))) {
                                            formstring += `&mod_name=${replaceAll("%28implicit%29+" + encodeURIComponent(b[1] + "#" + b[3]), "%20", "+")}&mod_min=${b[2]}&mod_max=`;
                                            desc_list.push(`(implicit) ${b[1]}#${b[3]} (min: ${b[2]})`);
                                        }
                                    }
                                    group_count++;
                                    //});
                                    itemlevel++;
                                }
                                group[itemlevel].forEach((e) => {
                                    let b;
                                    //+?123%? anything
                                    if (b = /^(\+)(\d+)(% to )(Fire|Cold|Lightning)( Resistance)/.exec(e)) {
                                        totalresist += parseInt(b[2]);
                                    }
                                    else if (b = /^(\+)(\d+)(% to )(Fire|Cold|Lightning) and (Fire|Cold|Lightning)( Resistances)/.exec(e)) {
                                        totalresist += parseInt(b[2]) * 2;
                                    }
                                    else if (b = /^(\+)(\d+)(% to all Elemental Resistances)/.exec(e)) {
                                        totalresist += parseInt(b[2]) * 3;
                                    }
                                    else if (b = /^(\+)(\d+)(% to Chaos Resistance)/.exec(e)) {
                                        chaosresist += parseInt(b[2]);
                                    }
                                    else if (b = /^(\+)(\d+)( to maximum Life)/.exec(e)) {
                                        totalhealth += parseInt(b[2]);
                                    }
                                    else if (b = /^(\+|Gain |)(\d+(?:\.\d+)?)(%?.+)$/.exec(e)) {
                                        if (!formose) {
                                            formstring += `&mod_name=${replaceAll(encodeURIComponent(b[1] + "#" + b[3]), "%20", "+")}&mod_min=${b[2]}&mod_max=`;
                                            desc_list.push(`${b[1]}#${b[3]} (min: ${b[2]})`);
                                            group_count++;
                                        }
                                    } else if (b = /^(Adds )(\d+)( to )(\d+)(.+)$/.exec(e)) {
                                        if (!formose) {
                                            let avg = (parseInt(b[2]) + parseInt(b[4])) / 2;
                                            formstring += `&mod_name=${replaceAll(encodeURIComponent(b[1] + "#" + b[3] + "#" + b[5]), "%20", "+")}&mod_min=${avg}&mod_max=`;
                                            desc_list.push(`${b[1]}#${b[3]}#${b[5]} (min: ${avg})`);
                                            group_count++;
                                        }
                                    }
                                })
                                if (formose) {
                                    if (totalresist + totalhealth > 0) {
                                        formstring += `&mod_name=%28pseudo%29+%2B%23%25+total+Elemental+Resistance&mod_min=&mod_max=&mod_name=%28pseudo%29+%28total%29+%2B%23+to+maximum+Life&mod_min=&mod_max=&group_type=Sum&group_min=${totalresist + totalhealth}&group_max=&group_count=2`
                                        desc_list.push(`(pseudo) +#% total Elemental Resistance`);
                                        desc_list.push(`(pseudo) (total) +# to maximum Life`);
                                        desc_list.push(`Group total (min: ${totalresist + totalhealth + chaosresist})`);
                                    }
                                }
                                else {
                                    if (totalresist > 0) {
                                        formstring += `&mod_name=%28pseudo%29+%2B%23%25+total+Elemental+Resistance&mod_min=${totalresist}&mod_max=`;
                                        desc_list.push(`(pseudo) +#% total Elemental Resistance (min: ${totalresist})`);
                                        group_count++;
                                    }
                                    if (totalhealth > 0) {
                                        formstring += `&mod_name=%28pseudo%29+%28total%29+%2B%23+to+maximum+Life&mod_min=${totalhealth}&mod_max=`;
                                        desc_list.push(`(pseudo) (total) +# to maximum Life (min: ${totalhealth})`);
                                        group_count++;
                                    }
                                    formstring += "&group_type=And&group_min=&group_max=&group_count=" + group_count;
                                }
                            }
                        }
                    }
                    
                    poelinkid = await requestpromiseheader({
                        method: 'POST',
                        url: "http://poe.trade/search",
                        followRedirect: false,
                        //proxy:'http://localhost:8888',
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: formstring
                    });
                    
                }
                let link = poelinkid.headers.location;
                let body;
                try {
                    body = await requestpromise({
                        method: 'POST',
                        url: link,
                        //proxy: 'http://localhost:8888',
                        followRedirect: false,
                        method: "post",
                        body: "sort=price_in_chaos_new&bare=true",
                        gzip: true,
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                            "Accept-Encoding": "gzip"
                        }
                    })
                } catch (e) {
                    //console.error(e);
                    return setLeague("Update your league", null, message);
                }
                let $ = cheerio.load(body);
                let rich = new Discord.RichEmbed();
                rich.setTitle("Results - " + poeleague);
                rich.setDescription(desc_list.join("\n"));
                rich.setURL(link);
                rich.setFooter('Type "setpoeleague" to change your PoE league')
                $(".item").slice(0, count).each((i, e) => {
                    let title = $(e).attr("data-name");
                    let corrupt = $(e).find(".title>span").text().trim();
                    if (corrupt != "") title += " (" + corrupt + ")";
                    //let wikilink = $(e).find(".wiki-link").attr("href");
                    //if (wikilink != "") title = `[${title}](${wikilink})`;
                    //.find(".title").clone().children().remove().end().text().trim();
                    let desc = $(e).attr("data-buyout");
                    desc += "\n" + $(e).find(".found-time-ago").text().trim();
                    desc += "\n" + $(e).find(".bottom-row .label").text().trim();
                    rich.addField(title, desc, true)
                })
                return [link, {
                    embed: rich
                }];
                /*
                Promise.all([lm, rp2]).then((things) => {
                    things[0].edit.apply(things[0], things[1]).catch(err);
                })*/
            }
            async function setLeague(top, loadingmessage, message, checked){
                let body;
                try {
                    body = await requestpromise("http://api.pathofexile.com/leagues?type=main&compact=0");
                } catch (e) {
                    return ["`Error loading PoE API`"]
                }
                let data = JSON.parse(body);
                let leaguelist = [];
                /*
                for (let i = 0; i < data.length; i++) {
                    let solo = false;
                    for (let j = 0; j < data[i].rules.length; j++) {
                        if (data[i].rules[j].id === 24) {
                            solo = true;
                            break;
                        }
                    }
                    if (!solo) data.push(data2[i]);
                }
                */
                data.forEach((leag)=>{
                    let istradeleague = leag.rules.every((rule)=>{
                        return rule.id !== "NoParties";
                    })
                    if (istradeleague) leaguelist.push([leag.id, (thismess)=>{
                        if (thismess.author.id !== message.author.id) return false;
                        (async ()=>{
                            let stmt = sql.prepare("INSERT INTO users(user_id,poeleague) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET poeleague=excluded.poeleague;")
                            stmt.run(message.author.id, leag.id)

                            let itemsearch = await poesearch(thismess,args)
                            thismess.channel.send.apply(thismess.channel, itemsearch).catch(e=>{
                                if (e.code == 50035) {
                                    message.channel.send("`Message too large`").catch(err);
                                } else {
                                    err(e);
                                    message.channel.send("`Error`").catch(err);
                                }
                            });
                        })().catch( e=> {
                            err(e);
                            message.channel.send("`Error`").catch(err);
                        })
                        return true;
                    }]);
                })

                let msg = top + createCustomNumCommand(message,leaguelist);
                return [msg];
            }
            return await poesearch(message, args);
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "setpoeleague",
    regex: /^setpoeleague$/i,
    prefix: ".",
    testString: ".setpoeleague",
    hidden: false,
    requirePrefix: false,
    shortDesc: "sets your PoE league for .pt",
    longDesc: `.setpoeleague
sets your PoE league for .pt`,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            let body;
            try {
                body = await requestpromise("http://api.pathofexile.com/leagues?type=main&compact=0");
            } catch (e) {
                return ["`Error loading PoE API`"]
            }
            let data = JSON.parse(body);
            let leaguelist = [];
            data.forEach((leag)=>{
                let istradeleague = leag.rules.every((rule)=>{
                    return rule.id !== "NoParties";
                })
                if (istradeleague) leaguelist.push([leag.id, (thismess)=>{
                    if (thismess.author.id !== message.author.id) return false;
                    (async ()=>{
                        let stmt = sql.prepare("INSERT INTO users(user_id,poeleague) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET poeleague=excluded.poeleague;")
                        stmt.run(message.author.id, leag.id)
                        thismess.channel.send(`\`PoE league set to ${leag.id}\``).catch(e=>{
                            if (e.code == 50035) {
                                message.channel.send("`Message too large`").catch(err);
                            } else {
                                err(e);
                                message.channel.send("`Error`").catch(err);
                            }
                        });
                    })().catch( e=> {
                        err(e);
                        message.channel.send("`Error`").catch(err);
                    })
                    return true;
                }]);
            })

            let msg = createCustomNumCommand(message,leaguelist);
            return [msg];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "poe",
    regex: /^poe (.+)$/i,
    prefix: ".",
    testString: "",
    hidden: false,
    requirePrefix: true,
    shortDesc: "",
    longDesc: {title:`.poe (search)`,
        description: `search poe wiki`,
        fields: [{
            name: `search`,
            value: `search term`
        }]
    },
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            //https://pathofexile.gamepedia.com/api.php
            async function createItemRich(item_name, url) {
                let response = await rp(`https://pathofexile.gamepedia.com/api.php?action=cargoquery&tables=items&fields=items.html,items.name&where=items.name=${encodeURIComponent(`"${item_name}"`)}&format=json`)
                response = JSON.parse(response);
                if (response.cargoquery.length>0) {
                    let html = unescape(response.cargoquery[0].title.html)
                    html = html.replace(/<span [^>]*?class="group.+?>/g,"\n\n").replace(/<(\w+?) .+?>/g,"").replace(/<\/(\w+?)>/g,"").replace(/<br>/g,"\n").replace(/\[\[:\w+:.+?\|(.+?)\]\]/g,"$1").replace(/\[\[(.+)\]\]/,"")
                    let lines = html.split("\n");
                    while (lines[0]==="" || lines[0]===item_name) {
                        lines.shift()
                    }
                    let rich = new Discord.RichEmbed()
                        .setTitle(item_name)
                        .setURL(url)
                        .setDescription(lines.join("\n"));
                    return rich;
                } else {
                    return `**__${item_name}__**\n${url}`;
                }
            }
            //https://pathofexile.gamepedia.com/api.php
            let response = await rp(`https://pathofexile.gamepedia.com/api.php?action=opensearch&search=${encodeURIComponent(args[1])}&format=json`)
            response = JSON.parse(response)
            //convert to {name, url}
            let items = response[1].map((item_name,index)=>{
                return {name:item_name, url:response[3][index]}
            })
            let list = items.map((item)=>{
                return [item.name, async ()=>{return createItemRich(item.name, item.url)}];
            })
            switch (list.length) {
                case 0:
                    return `\`No results found\``;
                case 1:
                    return await list[0][1]();
                default:
                    let rich = new Discord.RichEmbed()
                        .setTitle("Multiple items found")
                        .setDescription(createCustomNumCommand3(message, list))
                    return rich;
            }
            /*
            let rich = new Discord.RichEmbed();
            let name = response[1][0]
            response = await rp(`https://pathofexile.gamepedia.com/api.php?action=cargoquery&tables=items&fields=items.html,items.name&where=items.name=${encodeURIComponent(`"${name}"`)}&format=json`)
            response = JSON.parse(response)
            let html = unescape(response.cargoquery[0].title.html)*/
        })().then(params=>{
            if (!Array.isArray(params)) params = [params];
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "define",
    regex: /^def(?:ine)? (.+?)(?: (\d))?$/i,
    prefix: ".",
    testString: ".define Devils Triangle",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "returns urban dictionary definition",
    longDesc: `define (term)
returns urban dictionary definition`,
    func: (message, args) =>{
        (async()=>{
            let num = parseInt(args[2]) || 0;
            let data = JSON.parse(await requestpromise(`http://api.urbandictionary.com/v0/define?term=${encodeURIComponent(args[1])}`));
            if (data.list[num]) {
                let rich = new Discord.RichEmbed();
                rich.setTitle(data.list[num].word);
                let desc = data.list[num].definition.replace(/[\[\]]/g,"");
                if (data.list[num].example) {
                    desc += "\n\n*" + data.list[num].example.replace(/[\[\]]/g,"") + "*";
                }
                rich.setDescription(desc);
                //rich.setTimestamp(new Date(data.list[num].written_on));
                return ["",rich];
            }
            return ["`No results found`"];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "roll",
    regex: /^roll (?:(\d*)d)?(\d+)([+-]\d+)?$/i,
    prefix: ".",
    testString: ".roll 3d6-10",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "rolls dice",
    longDesc: {title:`.roll [(num_dice)d](max_num)[+(add)]`,
        description: `rolls dice between 1 and max_num`,
        fields:[{
            name: `num_dice`,
            value: `number of dice to roll`
        },{
            name: `max`,
            value: `the max roll`
        },{
            name: `add`,
            value: `number to add at the end`
        },{
            name: `Examples`,
            value: `**.roll 6** - rolls a die between 1 to 6 inclusive
**.roll d6** - same as .roll d6
**.roll 10d6** - rolls 10 6-sided dice and adds them together
**.roll 10d6+10** - rolls 10 6-sided dice and then adds 10 to the total`
        }]
    },
    func: (message, args) =>{
        (async()=>{
            let num_dice = parseInt(args[1]) || 1;
            let max = parseInt(args[2]);
            let add = parseInt(args[3]) || 0;
            if (max<1) return ["`Dice side must be > 0`"];
            if (num_dice<1) return ["`Number of dice must be > 0`"];
            if (num_dice>300) return ["`Number of dice must be <= 300`"];
            let rolls = [];
            for (let n = 0; n < num_dice; n++) {
                rolls.push(Math.floor(Math.random() * max) + 1);
            }
            if (rolls.length===1 && add===0) return [`\`${rolls[0]}\``];
            let msg = "`(" + rolls.join(" + ") + ")";
            let total = rolls.reduce((acc, cur) => acc + cur, 0);
            if (add !==0) {
                total += add;
                if (add>0) msg += "+" + add;
                else msg += add;
            }
            msg += "`= " + total;
            return [msg];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "rss",
    regex: /^rss (\w+)(?: (.+))?$/i,
    prefix: ".",
    testString: ".rss add https://en-forum.guildwars2.com/categories/game-release-notes/feed.rss",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return rss;},
    log: true,
    points: 1,
    shortDesc: "returns posted feeds",
    longDesc: {title:`.rss (action) (args)`,
        description: `Subscribing to a feed will allow me to automatically post when updates occur`,
        fields: [{
            name: `rss add (rss_link or any type of steam_page_url)`,
            value: `Subscribes to an RSS feed
**Examples**
__.rss add [https]()://steamcommunity.com/games/389730/__ - subscribes to Tekken 7 steam news
__.rss add [http]()://rss.cnn.com/rss/cnn_topstories.rss__ - subscribes CNN top stories (enjoy the spam)`
        },{
            name: `rss subs`,
            value: `Lists all subscriptions`
        },{
            name: `rss list`,
            value: `Lists all recent news from subscriptions`
        },{
            name: `rss remove (num)`,
            value: `Remove a subscription from this channel. Get the number from ".rss subs"`
        },{
            name: `rss test`,
            value: `Returns the latest feed`
        }]
    },
    func: (message, args) =>{
        (async()=>{
            if (args[1] === "add") {
                return await rss.add(message, args[2]);
            } else if (args[1] === "subs" || args[1] === "sub") {
                return await rss.subs(message);
            } else if (args[1] === "list") {
                return await rss.list(message);
            } else if (args[1] === "remove" || args[1] === "rem") {
                return await rss.remove(message, args[2]);
            } else if (args[1] === "test" ) {
                return await rss.test(message);
            } else {
                return ["`unknown action`"];
            }
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "cog",
    regex: /^cog(?: (.+))?$/i,
    prefix: ".",
    testString: "",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "turns image into a spinning cogwheel",
    longDesc: `.cog (imageurl) or .cog (emoji) or .cog while attaching an image
returns a gif of the image in a spinning cogwheel`,
    func: (message, args) =>{
        (async()=>{
            function toCodePoint(unicodeSurrogates, sep) {
                var
                r = [],
                c = 0,
                p = 0,
                i = 0;
                while (i < unicodeSurrogates.length) {
                    c = unicodeSurrogates.charCodeAt(i++);
                    if (p) {
                        r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
                        p = 0;
                    } else if (0xD800 <= c && c <= 0xDBFF) {
                        p = c;
                    } else {
                        r.push(c.toString(16));
                    }
                }
                return r.join(sep || '-');
            }

            let image;
            if (message.attachments.size>0) {
                image = await loadImage(message.attachments.first().url);
            } else if (args[1].length<7) {
                image = await loadImage(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/11.3.0/2/72x72/${toCodePoint(args[1])}.png`);
            } else if (/^<:.+:.+>$/.test(args[1])) {
                let emoji = bot.emojis.find(emoji=>{
                    return emoji.toString() == args[1];
                })
                image = await loadImage(emoji.url);
            } else {
                image = await loadImage(args[1]);
            }
            let size = 320
            let transparentcolor="#fffffc"
            let cogcolor="#b0c4de"
            const encoder = new GIFEncoder(size, size);
            let stream = encoder.createReadStream()
            encoder.start();
            encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
            encoder.setDelay(1000/60*2);  // frame delay in ms
            encoder.setQuality(10); // image quality. 10 is default.
            encoder.setTransparent(transparentcolor); //
            const canvas = createCanvas(size, size);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = transparentcolor;

            function cog(ctx){
                ctx.globalCompositeOperation='destination-in';
                let cx      = 320/2,                    // center x
                cy      = 320/2,                    // center y
                notches = 8,                      // num. of notches
                radiusO = 160,                    // outer radius
                radiusI = 120,                    // inner radius
                taperO  = 50,                     // outer taper %
                taperI  = 35,                     // inner taper %
                // pre-calculate values for loop
                pi2     = 2 * Math.PI,            // cache 2xPI (360deg)
                angle   = pi2 / (notches * 2),    // angle between notches
                taperAI = angle * taperI * 0.005, // inner taper offset (100% = half notch)
                taperAO = angle * taperO * 0.005, // outer taper offset
                a       = angle,                  // iterator (angle)
                toggle  = false;                  // notch radius level (i/o)
                ctx.beginPath();
                ctx.moveTo(cx + radiusO * Math.cos(taperAO), cy + radiusO * Math.sin(taperAO));
                for (; a <= pi2+.01; a += angle) {
                    // draw inner to outer line
                    if (toggle) {
                        ctx.lineTo(cx + radiusI * Math.cos(a - taperAI),
                                cy + radiusI * Math.sin(a - taperAI));
                        ctx.lineTo(cx + radiusO * Math.cos(a + taperAO),
                                cy + radiusO * Math.sin(a + taperAO));
                    }
                    // draw outer to inner line
                    else {
                        ctx.lineTo(cx + radiusO * Math.cos(a - taperAO),  // outer line
                                cy + radiusO * Math.sin(a - taperAO));
                        ctx.lineTo(cx + radiusI * Math.cos(a + taperAI),  // inner line
                                cy + radiusI * Math.sin(a + taperAI));
                    }
                    // switch level
                    toggle = !toggle;
                }
                ctx.closePath();
                ctx.fill();
                ctx.globalCompositeOperation='source-over';
            }
            function spin(angle) {
                ctx.restore();
                ctx.fillStyle = cogcolor;
                ctx.fillRect(0, 0, 320, 320);
                ctx.fillStyle = transparentcolor;
                ctx.translate(320/2, 320/2);
                ctx.rotate(angle*Math.PI/180);
                ctx.translate(-320/2, -320/2);
                ctx.drawImage(image,0,0,320,320)
                cog(ctx);
                encoder.addFrame(ctx);
            }

            async function animate(frames) {
                for (let i=0;i<frames;i++) {
                    await spin(360/frames);
                }
            }

            await animate(40);

            encoder.finish();
            let attach = new Discord.Attachment(stream, "cog.gif");
            return [attach];
        })().then(params=>{
            if (params == null) return;
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "translate",
    regex: /^translate ([\s\S]+)$/i,
    prefix: ".",
    testString: ".translate hola",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "translate a string to english",
    longDesc: `.translate (string)
translate a string to english`,
    func: (message, args) =>{
        (async()=>{
            return [(await translate(args[1], {to: 'en'})).text]
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "level",
    regex: /^level$/i,
    prefix: ".",
    testString: ".level",
    hidden: true,
    requirePrefix: true,
    log: true,
    points: 0,
    shortDesc: "returns user power level",
    longDesc: `.level
returns user power level`,
    func: (message, args) =>{
        (async()=>{
            let stmt = sql.prepare("SELECT points FROM users WHERE user_id = ?;")
            let points = stmt.get(message.author.id).points
            let level = Math.floor(Math.pow(points,0.5))
            return [`\`Your power level is ${level}.\``]
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "rank",
    regex: /^rank$/i,
    prefix: ".",
    testString: ".rank",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "have a trophy",
    longDesc: `.rank
have a trophy`,
    func: (message, args) =>{
        (async()=>{
            let stmt = sql.prepare("SELECT rank FROM (SELECT ROW_NUMBER() OVER (ORDER BY points DESC) rank, user_id FROM users) WHERE user_id = ?;")
            let rank = stmt.get(message.author.id).rank
            let url = "";
            if (rank<4) {
                url = "https://vignette.wikia.nocookie.net/sonic/images/a/a4/League_division_S.png";
            } else if (rank<10) {
                url = "https://vignette.wikia.nocookie.net/sonic/images/c/c3/League_division_A.png";
            } else if (rank<20) {
                url = "https://vignette.wikia.nocookie.net/sonic/images/6/6b/League_division_B.png";
            } else if (rank<30) {
                url = "https://vignette.wikia.nocookie.net/sonic/images/4/43/League_division_C.png";
            } else if (rank<40) {
                url = "https://vignette.wikia.nocookie.net/sonic/images/2/23/League_division_D.png";
            } else if (rank<60) {
                url = "https://vignette.wikia.nocookie.net/sonic/images/9/9c/League_division_E.png";
            } else {
                url = "https://vignette.wikia.nocookie.net/sonic/images/c/cd/League_division_F.png";
            }
            let attach = new Discord.Attachment(url);
            return [attach]
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "image",
    regex: /^im(?:age|g) ([^\n\r]+?)$/i,
    prefix: ".",
    testString: ".image cat",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return config.api.image;},
    shortDesc: "returns the first image search result",
    longDesc: `.image (term)
returns the first image result. safesearch is off if the channel is nsfw`,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            //args[1] = encodeURIComponent(args[1]);
            let safe = message.channel.nsfw?"":"&safe=active"
            //https://developers.google.com/custom-search/v1/cse/list
            let urlpromise = await requestpromise(`https://www.googleapis.com/customsearch/v1?key=${config.api.image}&q=${encodeURIComponent(args[1])}&searchType=image&num=10${safe}`)
            let data=JSON.parse(urlpromise)
            let validmime = ["image/png","image/jpeg","image/bmp","image/gif"]
            let extension = [".png",".jpg",".bmp",".gif"]
            if (data.items && data.items.length>0) {
                let imagedata = data.items.find(element=>{
                    return validmime.indexOf(element.mime)>-1;
                })
                if (imagedata){
                    let attach = new Discord.Attachment(imagedata.link,`${encodeURIComponent(args[1])}${extension[validmime.indexOf(imagedata.mime)]}`);
                    return [attach]
                }
            }
            return ["`No results found`"]
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

function createChartStream(datapoints, labels, annotations, ylabelcallback) {
    const configuration = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: datapoints,
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 5,
                pointRadius: 0
            }]
        },
        plugins: [annotation],
        options: {
            annotation: {
                annotations: annotations
            },
            legend: {
                display:false,
                labels: {
                    fontStyle: "bold",
                    fontSize: 20
                }
            },
            showLines: true,
            elements : {
                line: {
                    tension: 0
                }
            },
            scales: {
                xAxes: [{
                    ticks: {
                        fontStyle: "bold",
                        fontSize: 16,
                        autoSkip: false
                    }
                }],
                yAxes: [{
                    ticks: {
                        callback: ylabelcallback,
                        fontStyle: "bold",
                        fontSize: 16
                    }
                }]
            }
        }
    };
    const canvasRenderService = new CanvasRenderService(729, 410);
    const chart = canvasRenderService.renderChart(configuration);
    const canvas = chart.canvas;
    let PNGStream = canvas.createPNGStream();
    PNGStream.on("end", ()=>{
        chart.destroy();
    })
    return PNGStream;
}

commands.push(new Command({
    name: "stock",
    regex: /^stock ([\w\d]+)$/i,
    prefix: ".",
    testString: ".stock aapl",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return config.api.stock;},
    shortDesc: ".returns price and chart of stock symbol",
    longDesc: `.stock (symbol)
returns price and chart of stock symbol`,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            //https://iexcloud.io/console/usage
            //https://iexcloud.io/docs/api/#historical-prices
            let base = `https://cloud.iexapis.com/stable/`
            let symbol = args[1]
            let token = config.api.stock;

            let response = await rp(`${base}ref-data/us/dates/trade/last/2?token=${token}`)
            response = JSON.parse(response);
            let promprice = rp(`${base}stock/${symbol}/quote?token=${token}`)
            let promlist = [];
            response.forEach(data=>{
                promlist.push(rp(`${base}stock/${symbol}/chart/date/${data.date.replace(/-/g,"")}?token=${token}&chartInterval=1`))
            })
            response = await rp(`${base}stock/${symbol}/intraday-prices?token=${token}&chartInterval=1`)
            response = JSON.parse(response);
            let stock_data = response;
            let thisdate = stock_data.length>0?stock_data[0].date:"";
            for (let promnum=1; promnum<promlist.length; promnum++) {
                response = await promlist[promnum]
                response = JSON.parse(response);
                if (response[0].date == thisdate) {
                    continue;
                }
                stock_data = response.concat(stock_data);
            }
            stock_data = stock_data.map(data=>{
                return {
                    close: data.close,
                    time: moment.tz(`${data.date} ${data.minute}`, "YYYY-MM-DD HH:mm", "America/New_York")
                }
            })
            let stock_price = JSON.parse(await promprice);
            let annotations = []
            let labels = stock_data.map((data, ind, arr)=>{
                let label_text = data.time.format("h:mm a")
                if (label_text == "9:30 am") {
                    annotations.push(
                        {
                            type: "line",
                            mode: "vertical",
                            scaleID: "x-axis-0",
                            value: data.time.format("MMM D"),
                            borderColor: 'rgba(255, 255, 255, 1)',
                            borderWidth: 1
                        }
                    )
                    return data.time.format("MMM D")
                } else if (ind == arr.length-1 && label_text == "3:59 pm") {
                    return "4:00 pm"
                }
                return (data.time.minute()%60==0)?label_text:"";
            })
            let datapoints = stock_data.map((data)=>{return data.close})
            let stream = createChartStream(datapoints, labels, annotations, (value) => '$' + value);
            let updown = "";
            if (stock_price.change > 0) updown = "▲";
            else if (stock_price.change < 0) updown = "▼";
            let rich = new Discord.RichEmbed();
            rich.setTitle(stock_price.companyName);
            rich.setDescription(`${stock_price.symbol} $${stock_price.latestPrice} (${updown}${Math.abs(stock_price.change)}%)`);
            rich.attachFile({attachment: stream, name: `${stock_price.symbol}.png`})
            rich.setImage(`attachment://${stock_price.symbol}.png`)
            return ["", rich];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "news",
    regex: /^news(?: (.+))?$/i,
    prefix: ".",
    testString: ".news trump",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return config.api.news;},
    shortDesc: "searches news articles",
    longDesc: {title:`.news __search_term__`,
        description: `returns news articles containing search term`,
        fields: [{
            name: `search_term`,
            value: `Surround phrases with quotes (") for exact match.
Prepend words or phrases that must appear with a + symbol. Eg: +bitcoin
Prepend words that must not appear with a - symbol. Eg: -bitcoin
Alternatively you can use the AND / OR / NOT keywords, and optionally group these with parenthesis. Eg: crypto AND (ethereum OR litecoin) NOT bitcoin.`
        },{
            name: `Examples`,
            value: `.news trump - returns news containing "trump"
.news "yang gang" - return news containing the phrase "yang gang"`
        }]
    },
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            //https://newsapi.org/docs/endpoints/everything
            async function smmry(e) {
                let summary = JSON.parse(await rp(`http://api.smmry.com/&SM_API_KEY=${config.api.smmry}&SM_WITH_BREAK=true&SM_URL=${e.url}`)).sm_api_content;
                summary = summary.replace(/\[BREAK\]/g, "\n\n");
                let rich = new Discord.RichEmbed()
                    .setTitle(e.title)
                    .setURL(e.url)
                    .setDescription(summary)
                return rich;
            }
            let response;
            if (args[1]) {
                response = await rp(`https://newsapi.org/v2/everything?q=${encodeURIComponent(`${args[1]}`)}&apiKey=${config.api.news}&sortBy=publishedAt&language=en&pageSize=20`)
            } else {
                response = await rp(`https://newsapi.org/v2/top-headlines?apiKey=${config.api.news}&pageSize=20&language=en`)
            }
            response = JSON.parse(response);
            let desc = response.articles.filter((e,i,arr)=>{
                return arr.findIndex((that_e)=>{
                    return that_e.title.toLowerCase() === e.title.toLowerCase();
                }) === i;
            }).map(e=>{
                return [`${e.source.name}: **[${e.title}](${e.url})**`, async()=>{return smmry(e)}];
            })

            if (desc.length==1) {
                return await desc[0][1]()
            } else if (desc.length<1) {
                return "`No results found`";
            } else {
                let rich = new Discord.RichEmbed()
                rich.setTitle(`Recent News${args[1]?`: ${args[1]}`:""}`);
                rich.setDescription(createCustomNumCommand3(message,desc));
                return rich;
            }
        })().then(params=>{
            if (!Array.isArray(params)) params = [params];
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "ff14",
    regex: /^ff(?:14|xiv) (.+)$/i,
    prefix: ".",
    testString: ".ff14 furry",
    hidden: false,
    requirePrefix: true,
    shortDesc: "returns FFXIV Lodestone character data",
    longDesc: {title:`.ff14 __character_name__`,
        description: `returns character data`,
        fields: [{
            name: `character_name`,
            value: `The name to search for`
        }]
    },
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            //https://xivapi.com/docs/Character#search
            let response = await rp(`https://xivapi.com/character/search?name=${encodeURIComponent(args[1])}`)
            response = JSON.parse(response);

            async function charRich(char) {
                let response = await rp(`https://xivapi.com/character/${char.ID}?data=AC,FC`)
                response = JSON.parse(response);
                let char_data = response.Character;
                let rich = new Discord.RichEmbed()
                    .setTitle(`${char_data.Name} - ${char_data.Server}`)
                    .setImage(char_data.Portrait)
                    .setURL(`https://na.finalfantasyxiv.com/lodestone/character/${char.ID}/`)
                let desc_lines = []
                let genders = ["Male", "Female"]
                let races = ["Hyur", "Elezen", "Lalafell", "Miqo'te", "Roegadyn", "Au Ra"]
                desc_lines.push(`**${genders[char_data.Gender-1]} ${races[char_data.Race-1]}**`)
                if (response.FreeCompany) desc_lines.push(`Free Company: [${response.FreeCompany.GrandCompany}](https://na.finalfantasyxiv.com/lodestone/freecompany/${response.FreeCompany.ID}/)`)
                if (response.Achievements) desc_lines.push(`Achievement Points: ${response.Achievements.Points}`)
                if (char_data.Minions) desc_lines.push(`Minions: ${char_data.Minions.length}`);
                if (char_data.Mounts) desc_lines.push(`Mounts: ${char_data.Mounts.length}`);
                if (char_data.Bio) desc_lines.push(`Character Profile: ${char_data.Bio}`);
                rich.setDescription(desc_lines.join("\n"))
                return rich;
            }

            let char_list = response.Results.map(char=>{
                return [`${char.Name} - ${char.Server}`, async()=>await charRich(char)]
            })

            if (char_list.length<1) {
                return `\`No characters found\``
            } else if (char_list.length==1) {
                return await char_list[0][1]();
            } else {
                let rich = new Discord.RichEmbed({
                    title: "Multiple characters found",
                    description: createCustomNumCommand3(message,char_list)
                })
                return rich;
            }
        })().then(params=>{
            if (Array.isArray(params)) {
                message.channel.send.apply(message.channel, params).catch(e=>{
                    if (e.code == 50035) {
                        message.channel.send("`Message too large`").catch(err);
                    } else {
                        err(e);
                        message.channel.send("`Error`").catch(err);
                    }
                });
            } else {
                message.channel.send(params).catch(e=>{
                    if (e.code == 50035) {
                        message.channel.send("`Message too large`").catch(err);
                    } else {
                        err(e);
                        message.channel.send("`Error`").catch(err);
                    }
                });
            }
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "patchnotes",
    regex: /^patch(notes)?$/i,
    prefix: ".",
    testString: ".patchnotes",
    hidden: false,
    requirePrefix: true,
    shortDesc: `lists recent changes`,
    longDesc: `.patchnotes
lists recent changes`,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            return `\`v6.08
• Added new character poe who searches the PoE Wiki.
• Implemented leaderboards. Use ".rank" to check your rank. Ranked matchmaking later?

v6.07
• Added new character rss who has the unique ability to post news for Steam games and other RSS feeds. rss is a stance-heavy character so use ".rss help" to check his movelist.
• Renamed remindme to reminder because it made new players confused.
• reminder can now be played in simple mode.
• Reminders are now saved even if the game crashes.
• ygo's "no cards found" is now safe on block.

v5.30
• Added new characters mtg, stock, news, ff14.
• mtg, ygo, and art can now use "random."\``
        })().then(params=>{
            message.channel.send(params).catch(e=>{
                if (e.code == 50035) {
                    err(e);
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

//messages without prefixes

commands.push(new Command({
    name: "alexa play",
    regex: /alexa play (.+)$/i,
    prefix: "",
    testString: "blah blah alexa play despacito",
    hidden: true,
    requirePrefix: false,
    hardAsserts: ()=>{return config.api.youtube;},
    log: true,
    points: 1,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            let search = encodeURIComponent(args[1]);
            let urlpromise = requestpromise('https://www.googleapis.com/youtube/v3/search?part=snippet&key=' + config.api.youtube + '&type=video&maxResults=1' + '&q=' + search)
            let body = await urlpromise;

            let data = JSON.parse(body);
            if (data.items.length<1) return null;
            const voiceChannel = message.member.voiceChannel;
            if (!voiceChannel) {
                return [`${data.items[0].snippet.title}\nhttps://youtu.be/${data.items[0].id.videoId}`];
            } else {
                let stream = ytdl("https://www.youtube.com/watch?v=" + data.items[0].id.videoId, {                                    
                    filter: 'audioonly',
                    quality: 'highestaudio'                         
                });
                playSound(voiceChannel, stream);
                return null;
            }
        })().then(params=>{
            if (!params) return;
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "00:00am est",
    regex: /(\d{1,2}):?(\d{2})? ?([ap]m)? ?(est|cst|pst|nzdt|jst|utc|edt|cdt|pdt|gmt)/i,
    prefix: "",
    testString: "blah blah blah 12:30am est blah blah blah",
    hidden: false,
    requirePrefix: false,
    shortDesc: "converts to different timezones",
    longDesc: `(00:00)[am or pm] (time_zone)
returns the time converted to different time zones. can be anywhere in a message`,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            let fullZones2 = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC"];
            let fullName = convertTZ(args[4]);
            //msg += fullName;
            let inputTime = moment.tz(`${args[1]}${args[2]}${args[3]}`, ["h:mma", "hmma"], fullName).subtract(1, 'days');
            if (!inputTime.isValid()) return;
            if (parseInt(args[1])<13 && args[3]===undefined) {
                for (let i=0;i<4;i++) {
                    if (inputTime.diff(moment()) >= 0) {
                        break;
                    }
                    inputTime.add(12, 'hours');
                }
            } else {
                for (let i=0;i<2;i++) {
                    if (inputTime.diff(moment()) >= 0) {
                        break;
                    }
                    inputTime.add(1, 'days');
                }
            }
            let msg = "`" + inputTime.valueOf() + "\n" + inputTime.fromNow() + "\n";

            msg = msg + fullZones2.map(zone=>{
                return inputTime.tz(zone).format('ddd, MMM Do YYYY, h:mma z');
            }).join("\n")

            msg += "`";
            return [msg];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "fuck (thing)",
    regex: /^fuck (?:you |u )?(\S+)$/i,
    prefix: "",
    testString: "fuck blah",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    func: (message, args) =>{
        if (args[1].toLowerCase() === "you" || args[1].toLowerCase() === "u" || args[1].toLowerCase() === "this" || args[1].toLowerCase() === "that") return false;
        (async()=>{
            return [`I think its hilarious u kids talking shit about ${args[1]}. u wouldnt say this shit to ${args[1]} at lan. not only that but ${args[1]} wears the freshest clothes, eats at the chillest restaurants and hangs out with the hottest dudes. yall are pathetic lol`]
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "whens",
    regex: /^(?:so )?when(?:s|'s| is| are) (.+)$/i,
    prefix: "",
    testString: "whens something",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            return ["never"];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "what",
    regex: /^(what|wat)\??$/i,
    prefix: "",
    testString: "what",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            let thismsgs = await message.channel.fetchMessages({
                limit: 1,
                before: message.id
            })
            let thismsg = thismsgs.first();
            if (thismsg.content == "") return ["", new Discord.Attachment("https://i.kym-cdn.com/photos/images/newsfeed/000/173/576/Wat8.jpg")]
            else if (thismsg.author.id === message.author.id)  return ["", new Discord.Attachment("https://i.kym-cdn.com/photos/images/newsfeed/000/173/576/Wat8.jpg")]
            else return [thismsg.content.toUpperCase()];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                err(e);
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "jonio",
    regex: /^jonio$/i,
    prefix: ".",
    testString: "jonio",
    hidden: true,
    requirePrefix: false,
    shortDesc: "returns my jonio link",
    longDesc: `returns my jonio link`,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            return ["http://www.dhuang8.com/gg/"];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

//todo volume

commands.push(new Command({
    name: "botlink",
    regex: /^botlink$/i,
    prefix: ".",
    testString: "botlink",
    hidden: true,
    requirePrefix: false,
    hardAsserts: ()=>{return config.adminID && config.botlink;},
    shortDesc: "",
    longDesc: ``,
    func: (message, args) =>{
        if (message.author.id !== config.adminID) return false;
        (async()=>{
            return [`<${config.botlink}>`];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

commands.push(new Command({
    name: "bad bot",
    regex: /(^| )(bad|dumb|stupid|shit) bot($| |\.)/i,
    prefix: "",
    testString: "this dumb bot",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            return ["sorry"];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

//rip dat boi
commands.push(new Command({
    name: "animal",
    regex: /animal/i,
    prefix: "",
    testString: "blah blah blah animal",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            let files = fs.readdirSync("animalgifs/");
            let file = files[Math.floor(Math.random() * files.length)]
            let attach = new Discord.Attachment("animalgifs/" + file);
            return [attach];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))

//might be too annoying now
/*
commands.push(new Command({
    name: "im blah",
    regex: /(?:^|(?:\.|,) )(?:\w+ )?(?:im|i'm)((?: \w+){1})(?:\.|$)/i,
    prefix: "",
    testString: "im bored",
    hidden: true,
    requirePrefix: false,
    shortDesc: "return hi blah",
    longDesc: ``,
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            let greetings = ["Hello", "Hi", "Hey"]
            let responses = ["Nice to see you.", ""]
            if (message.guild.me.nickname) {
                responses.push(`I'm ${message.guild.me.nickname}.`)
            }
            let response = responses[parseInt(Math.random() * responses.length)];
            let greeting = greetings[parseInt(Math.random() * greetings.length)];
            var msg = `${greeting}${args[1]}. ${response}`;
            return [msg];
        })().then(params=>{
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))
*/

commands.push(new Command({
    name: "exit",
    regex: /^exit$/i,
    prefix: ".",
    testString: "",
    hidden: true,
    requirePrefix: true,
    hardAsserts: ()=>{return config.adminID;},
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 0,
    func: (message, args) =>{
        (async()=>{
            if (message.author.id != config.adminID) return false;
            process.exit();
        })().catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))
/*
commands.push(new Command({
    name: "nothing",
    regex: /^nothing$/i,
    prefix: ".",
    testString: "",
    hidden: false,
    requirePrefix: true,
    hardAsserts: ()=>{return;},
    shortDesc: "",
    longDesc: {title:`.nothing __args__`,
        description: `returns nothing`,
        fields: [{
            name: `nothing`,
            value: `of value is lost`
        }]
    },
    log: true,
    points: 1,
    func: (message, args) =>{
        (async()=>{
            //todo
        })().then(params=>{
            if (!Array.isArray(params)) params = [params];
            message.channel.send.apply(message.channel, params).catch(e=>{
                if (e.code == 50035) {
                    message.channel.send("`Message too large`").catch(err);
                } else {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                }
            });
        }).catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))
*/
commands.push(new Command({
    name: "test2",
    regex: /^test2$/i,
    prefix: "",
    testString: "test2",
    hidden: true,
    requirePrefix: true,
    func: (message) =>{
        (async()=>{
            return message.channel.send("`Loading`");
        })()
        
        .then( async (lm) => {
            await sleep(5000);
            throw new Error(123)
            let loadingMes = await lm;
            loadingMes.edit("Done")
        })
        .catch(e=>{
            console.error(e)
            message.channel.send("`Error`");
        })
        return true;
    }
}))
commands.push(new Command({
    name: "help",
    regex: /^help$/i,
    requirePrefix: true,
    testString: ".help",
    shortDesc: "returns a list of commands",
    longDesc: `.help
returns a list of commands. respond with the number for details on a specific command`,
    log: true,
    points: 1,
    func: (message, args)=>{
        let results = [];
        let mes = commands.filter((cur)=>{
            return cur.getVisibility();
        }).map((cur, index)=>{
            if (typeof cur.getLongDesc() == "string"){
                results.push(["```" + cur.getLongDesc() + "```"]);
            } else {
                results.push(["",{embed: new Discord.RichEmbed(cur.getLongDesc())}]);
            }
            return `**${index+1}.** ${cur.getShortDesc()}`;
        }).join("\n");
        extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
            var num = parseInt(message.content) - 1;
            if (num < results.length && num > -1) {
                message.channel.send.apply(message.channel, results[num]).catch(err);
                return true;
            }
            return false;
        })
        let rich = new Discord.RichEmbed({
            title: "List of commands",
            description: mes
        })
        message.channel.send("",{embed:rich}).catch(err);
        return true;
    }
}))
commands.push(new Command({
    name: "update",
    regex: /^update(?: (.+))?$/i,
    requirePrefix: true,
    hidden: true,
    hardAsserts: ()=>{return config.adminID;},
    shortDesc: "update script",
    longDesc: `.update
updates script`,
    log: true,
    points: 0,
    func: (message, args) =>{
        if (message.author.id != config.adminID) return false;
        (async()=>{
            if (args[1]) {
                execFile('node', [`update_scripts/${args[1]}/update.js`], (e, stdout, stderr) => {
                    if (e) {
                        message.channel.send("`Error`")
                        err(e)
                    } else {
                        message.channel.send(`\`${stdout} ${stderr}\``)
                    }
                })
            } else {
                execFile('git', ["pull", "https://github.com/dhuang8/Tall-Bot.git", "v3"], (e, stdout, stderr) => {
                    if (e) {
                        message.channel.send("`Error`")
                        err(e)
                    } else {
                        message.channel.send(`\`${stdout} ${stderr}\``)
                    }
                })
            }
        })().catch(e=>{
            err(e);
            message.channel.send("`Error`").catch(err);
        })
        return true;
    }
}))
commands.push(new Command({
    name: "test",
    regex: /^test$/i,
    requirePrefix: true,
    hidden: true,
    hardAsserts: ()=>{return config.adminID;},
    shortDesc: "tests commands",
    longDesc: `.test
returns a list of commands. respond with the number to test that command`,
    log: true,
    points: 0,
    func: (message, args)=>{
        if (message.author.id != config.adminID) return false;
        let results = [];
        let mes = "```";
        mes += commands.filter((cur)=>{
            return cur.testString !== "";
        }).map((cur, index)=>{
            results.push(cur);
            return `${index+1}. ${cur.name} - "${cur.testString}"`;
        }).join("\n");
        mes += "```";
        extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
            var num = parseInt(message.content) - 1;
            if (num < results.length && num > -1) {
                message.content = results[num].testString;
                return results[num].run(message);
            }
            return false;
        })
        message.channel.send(mes).catch(err);
        return true;
    }
}))


commands.push(new Command({
    name: "stop",
    regex: /stop/i,
    prefix: ".",
    testString: "",
    hidden: false,
    requirePrefix: false,
    shortDesc: "stops the current song playing",
    longDesc: `stop
stops the current song playing`,
    log: true,
    points: 0,
    func: (message, args) =>{
        let server = message.channel.guild;
        if (server.voiceConnection != null) {
            server.voiceConnection.disconnect();
            return true;
        }
    }
}))

function generateREADME() {
    let readme = `# Tall Bot
A Discord bot that does a lot of things

[Test the bot](https://discord.gg/YpjRNZT)

[Invite the bot to a server](https://discordapp.com/oauth2/authorize?client_id=180762874593935360&scope=bot&permissions=4294967295)

# How to run

\`npm install\`

\`node discord.js\`

paste token into config.json

\`node discord.js\` again
`
    readme += commands.filter(cmd=>{
        return !cmd.hidden;
    }).map(cmd=>{
        let desc = `## ${cmd.name}\n`;
        if (typeof cmd.longDesc === "string") {
            desc += cmd.longDesc.split("\n").slice(1).join("\n\n");
        } else {
            desc += cmd.longDesc.description + "\n";
            desc += `### ${cmd.longDesc.title}\n`;
            cmd.longDesc.fields.forEach(field=>{
                desc += `#### ${field.name}\n${field.value.split("\n").join("\n\n")}\n`;
            })
        }
        return desc;
    }).join("\n").replace(/\[/g, "\\[");
    fs.writeFileSync("README.md", readme);
    console.log("Readme generated")
}

if (process.argv[2] == "r") generateREADME();

bot.on('message', (message) => {
    if (commands.some((v) => {
        return v.run(message)
    })) return;
});