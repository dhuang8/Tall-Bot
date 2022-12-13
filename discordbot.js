"use strict";
const Discord = require('discord.js');
const fs = require('fs');
const moment = require('moment-timezone');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');
const exec = require('child_process').exec;
const execFile = require('child_process').execFile;
const execFileSync = require('child_process').execFileSync;
const CronJob = require('cron').CronJob;
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');
const translate = require('@vitalets/google-translate-api');
const Database = require("better-sqlite3");
const { CanvasRenderService } = require('chartjs-node-canvas');
const annotation = require('chartjs-plugin-annotation');
const rp = require('request-promise');
const unescape = require('unescape');
const RSSManager = require('./utils/RSSManager');
const EpicStore = require('./utils/EpicStore');
const Pokemon = require('./utils/Pokemon');
const oauth2 = require('simple-oauth2')
const { Readable, PassThrough } = require('stream')
const prism = require('prism-media');
const ipc=require('node-ipc');
//const heapdump = require('heapdump');


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
        youtube: null,
        darksky: null,
        battlerite: null,
        hearthstone: null
    },
    token: null
};

const sql = new Database('sqlitedb/discord.sqlite'/*, { verbose: console.log }*/);
sql.prepare("CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, points INTEGER, poeleague TEXT) WITHOUT ROWID;").run();
sql.prepare("CREATE TABLE IF NOT EXISTS reminders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, channel_id TEXT, message_text TEXT, message_id TEXT, time DATETIME, original_time DATETIME, url TEXT, triggered BOOLEAN DEFAULT(FALSE), FOREIGN KEY(user_id) REFERENCES users(user_id));").run();

ipc.config.id = 'tallbot';
ipc.config.retry= 1500;
ipc.config.silent=true;

ipc.serve(
    function(){
        ipc.server.on(
            'message',
            function(data,socket){
                try {
                    if (typeof data.message == "object") data.message = new Discord.RichEmbed(data.message);
                    bot.channels.resolve(data.channelid).send(data.message);
                } catch (e) {
                    console.error("cannot decipher data:", data)
                }
            }
        );
    }
);
ipc.server.start();

let globalvars = { bot, config, sql }
module.exports = globalvars
const Command = require('./utils/Command');


const canvasRenderService = new CanvasRenderService(400, 225, (ChartJS) => {
    //const canvasRenderService = new CanvasRenderService(729, 410, (ChartJS) => {
    ChartJS.defaults.global.legend.display = false;
    ChartJS.defaults.global.legend.labels.fontStyle = "bold";
    ChartJS.defaults.global.legend.labels.fontSize = 10;
    ChartJS.defaults.global.showLines = true;
    //ChartJS.defaults.global.spanGaps = true;
    ChartJS.defaults.global.elements.line.tension = 0;
    ChartJS.defaults.line.scales.xAxes[0].ticks = {
        callback: (tick) => {
            if (tick == "") return undefined;
            return tick;
        },
        fontStyle: "bold",
        fontSize: 10,
        autoSkip: false,
        maxRotation: 0
    }
    ChartJS.defaults.line.scales.yAxes[0].ticks = {
        fontStyle: "bold",
        fontSize: 10
    }

    let scatterScale = ChartJS.scaleService.getScaleConstructor('linear').extend ({
        buildTicks: function() {
            this.ticks = this.chart.config.data.labels;
            this.ticksAsNumbers = this.chart.config.data.labels.map(label=>{
                return label.tick;
            })
            this.zeroLineIndex = this.ticks.indexOf(0);
        },        
        convertTicksToLabels: function() {
            this.ticks = this.chart.config.data.labels.map(label=>{
                return label.label;
            })
        }
    });
    ChartJS.scaleService.registerScaleType('scatterScale', scatterScale, ChartJS.scaleService.getScaleDefaults("linear"));
});

function getDefaultConfiguration() {
    return {
        type: 'line',
        data: {
            datasets: [{
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                pointRadius: 0
            }]
        },
        plugins: [annotation],
        options: {
            annotation: {
                annotations: null
            },
            scales: {
                xAxes: [],
                yAxes: [{
                    ticks: {
                        fontStyle: "bold",
                        fontSize: 10
                    }
                }]
            }
        }
    };
}

function createChartStream(configuration) {
    return canvasRenderService.renderToStream(configuration);
}

bot.on('guildCreate', (guild) => {
    try {
        let msg = `${moment().format('h:mma')} ${guild.name} (${guild.id}) guild joined.`;
        bot.channels.resolve(config.botChannelID).send(`\`${msg}\``).catch(err);
    } catch (e) {
        err(e)
    }
})

bot.on('guildDelete', (guild) => {
    try {
        let msg = `${moment().format('h:mma')} ${guild.name} (${guild.id}) guild left.`;
        bot.channels.resolve(config.botChannelID).send(`\`${msg}\``).catch(err);
    } catch (e) {
        err(e)
    }
})


//start richembeds with a random color
let save = Discord.RichEmbed;
//let save = Discord.MessageEmbed;
Discord.RichEmbed = function (data) {
    let rich = new Discord.MessageEmbed(data);
    return rich.setColor("RANDOM"); //parseInt(Math.random() * 16777216));
}

function richQuote(message) {
    try {
        let rich = new Discord.RichEmbed();
        let username = (message.member && message.member.nickname) ? message.member.nickname : message.author.username;
        rich.setAuthor(username, message.author.displayAvatarURL());
        let empty = true;
        if (message.content !== "") {
            rich.setDescription(message.content);
            empty = false;
        }
        rich.setTimestamp(message.createdAt);
        if (message.attachments.first() && message.attachments.first().height && message.attachments.first().url.slice(-4) == ".png") {
            rich.setImage(message.attachments.first().url);
            empty = false;
        }
        if (!empty) return rich;
        if (message.embeds.length > 0) return message.embeds[0];
    } catch (e) {
        throw e;
    }
}

function err(error, loadingMessage, content) {
    if (config.errorChannelID) {
        bot.channels.resolve(config.errorChannelID).send(`${error.stack}`, {
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
function createCustomNumCommand(message, data_array) {
    let mes = "```";
    mes += data_array.map((cur, index) => {
        return `${index + 1}. ${cur[0]}`;
    }).join("\n");
    mes += "```";
    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
        var num = parseInt(message.content) - 1;
        if (num < data_array.length && num > -1) {
            if (typeof data_array[num][1] == "function") {
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
function createCustomNumCommand2(message, data_array) {
    let mes = data_array.map((cur, index) => {
        return `**${index + 1}**. ${cur[0]}`;
    }).join("\n");

    if (mes.length > 2048) {
        while (mes.length > 2048 - 4) {
            mes = mes.replace(/\n.+$/, "")
        }
        mes = mes + "\n...";
    }
    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
        var num = parseInt(message.content) - 1;
        if (num < data_array.length && num > -1) {
            if (typeof data_array[num][1] == "function") {
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
function createCustomNumCommand3(message, data_array) {
    let mes = data_array.map((cur, index) => {
        return `**${index + 1}**. ${cur[0]}`;
    }).join("\n");

    if (mes.length > 2048) {
        while (mes.length > 2048 - 4) {
            mes = mes.replace(/\n.+$/, "")
        }
        mes = mes + "\n...";
    }

    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
        var num = parseInt(message.content) - 1;
        if (num < data_array.length && num > -1) {
            if (typeof data_array[num][1] == "function") {
                (async () => {
                    return await data_array[num][1](message);
                })().then(params => {
                    if (params == null) {
                        return;
                    } else if (Array.isArray(params)) {
                        message.channel.send.apply(message.channel, params).catch(e => {
                            if (e.code == 50035) {
                                message.channel.send("`Message too large`").catch(err);
                            } else {
                                err(e);
                                message.channel.send("`Error`").catch(err);
                            }
                        });
                    } else {
                        message.channel.send(params).catch(e => {
                            if (e.code == 50035) {
                                message.channel.send("`Message too large`").catch(err);
                            } else {
                                err(e);
                                message.channel.send("`Error`").catch(err);
                            }
                        });
                    }
                }).catch(e => {
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

function wordWrap(str, length) {
    let regex = new RegExp(`(?=(.{1,${length}}(?: |$)))\\1`, "g");
    return str.replace(regex, "$1\n");
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

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
    return str;
}

const last_update = "2022-12-13";

fs.readFile("./config.json", "utf8", (e, data) => {
    if (e && e.code === "ENOENT") {
        fs.writeFile("./config.json", JSON.stringify(config, null, 4), (e) => {
            console.error(e);
        })
        console.error("paste discord token in config.json and restart");
    } else {
        config = JSON.parse(data);
        globalvars.config = config;
        bot.on('shardResume', () => {
            console.log(`reconnected`)
            bot.user.setActivity(`${last_update} .help for list of commands`, { type: "PLAYING" }).catch(console.log)
            //bot.user.setActivity('2020-03-27 .help for list of commands', { type: "PLAYING" }).catch(bot.err)
            //bot.channels.resolve(config.errorChannelID).send(`\`${process.platform} reconnected\``).catch(bot.err)
        });
        bot.on('ready', () => {
            console.log("ready2")
            if (config.errorChannelID) bot.channels.resolve(config.errorChannelID).send(`\`${process.platform} ready2\``).catch(bot.err)
            bot.user.setActivity(`${last_update} .help for list of commands`, { type: "PLAYING" }).catch(bot.err)
        });
        bot.once("ready", () => {
            console.log("ready")
            if (config.errorChannelID) bot.channels.resolve(config.errorChannelID).send(`\`${process.platform} ready\``).catch(bot.err)
            let rows = sql.prepare("SELECT * FROM reminders WHERE triggered=false").all();
            rows.forEach(row => {
                setReminder(row.id, row.user_id, row.channel_id, row.message_text, row.message_id, row.time, row.original_time, row.url);
            })
        })
        bot.login(config.token).catch(console.error);
        new CronJob('0 0 0 1 * 0', function () {
            sql.prepare("UPDATE users SET points=points*9/10;").run();
        }, null, true, 'America/New_York');
        if (config.weatherChannelID) {
            new CronJob('0 0 8 * * *', function () {
                (async () => {
                    return await weather("nyc");
                })().then(params => {
                    bot.channels.resolve(config.weatherChannelID).send(params).catch(err);
                }).catch(e => {
                    err(e);
                })
            }, null, true, 'America/New_York');

        }
    }
})

let commands = [];
let extraCommand = [];

commands.push(new Command({
    name: "test if bot",
    hidden: true,
    prefix: "",
    log: false,
    points: 0,
    prerun: (message) => {
        return message.author.bot;
    },
    run: (message, args) => {
        return null;
    }
}))

commands.push(new Command({
    name: "log outside messages and pings",
    hidden: true,
    req: () => { return config.adminID && config.guildID },
    prerun: (message) => {
        return message.author.bot;
    },
    log: false,
    points: 0,
    prerun: (message) => {
        (async () => {
            let msgguild = message.guild ? message.guild.id : "whispers";
            let msgchannel = message.channel.id;
            let guildcat = bot.guilds.resolve(config.guildID).channels.cache.find(chan => chan.name == msgguild && chan.type == "category");
            if (!guildcat) {
                guildcat = await bot.guilds.resolve(config.guildID).channels.create(msgguild, { type: "category" });
            }
            let guildchan = bot.guilds.resolve(config.guildID).channels.cache.find(chan => chan.name == msgchannel && chan.type == "text");
            if (!guildchan) {
                guildchan = await bot.guilds.resolve(config.guildID).channels.create(msgchannel, { type: "text" });
                guildchan.setParent(guildcat);
            }
            let msg = "`" + message.author.tag + ":` " + message.cleanContent
            message.attachments.forEach(attach => {
                msg += "\n" + attach.proxyURL;
            })
            if (message.mentions.users.get(bot.user.id)) {
                msg = bot.users.resolve(config.adminID).toString() + " " + msg;
            }
            if (msg.length > 2000) msg = msg.slice(0, 1997) + "...";
            guildchan.send(msg);
        })().catch(e => {
            console.error(e);
            //throw e;
            err(e);
        })
        return false;
    },
    run: (message, args) => {
        return null;
    }
}))

commands.push(new Command({
    name: "send bot messages",
    hidden: true,
    req: () => { return config.adminID && config.guildID },
    log: false,
    points: 0,
    prerun: (message) => {
        return message.channel.guild && message.channel.guild.id == config.guildID && message.author.id == config.adminID
    },
    run: async (message, args) => {
        bot.channels.resolve(message.channel.name).send(message.content);
    }
}))
commands.push(new Command({
    name: "remove messages in bot and error channels",
    hidden: true,
    prefix: "",
    log: false,
    points: 0,
    req: () => { return config.botChannelID && config.errorChannelID },
    prerun: (message) => {
        return message.channel.id === config.botChannelID || message.channel.id === config.errorChannelID
    },
    run: async (message, args) => {
        message.delete().catch(err);
        return null;
    }
}))

//is there a better way to do this
commands.push(new Command({
    name: "extra custom commands",
    hidden: true,
    prefix: "",
    log: false,
    points: 0,
    prerun: (message, args) => {
        if (extraCommand[message.channel.id] != null) {
            return extraCommand[message.channel.id].onMessage(message);
        }
        return false;
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
    typing: false,
    points: 0,
    run: (message, args) => {
        return "pong";
    }
}))
commands.push(new Command({
    name: "^",
    regex: /^\^+$/,
    shortDesc: "responds with ^",
    prefix: "",
    testString: "^",
    hidden: true,
    log: true,
    typing: false,
    points: 1,
    run: (message, args) => {
        return "^".repeat(args[0].length + 1).slice(0, 2000);
    }
}))
/*
commands.push(new Command({
    name: "k",
    regex: /^k$/i,
    testString: "k",
    shortDesc: "responds with some long message",
    longDesc: "responds with \"You fucking do that every damn time I try to talk to you about anything even if it's not important you just say K and to be honest it makes me feel rejected and unheard like nothing would be better that that bullshit who the fuck just says k after you tell them something important I just don't understand how you think that's ok and I swear to god you're probably just gonna say k to this but when you do you'll know that you're slowly killing me inside\"",
    prefix: "",
    hidden: true,
    log: true,
    typing: false,
    points: 1,
    run: (message, args) => {
        return `You fucking do that every damn time I try to talk to you about anything even if it's not important you just say K and to be honest it makes me feel rejected and unheard like nothing would be better that that bullshit who the fuck just says k after you tell them something important I just don't understand how you think that's ok and I swear to god you're probably just gonna say k to this but when you do you'll know that you're slowly killing me inside`;
    }
}))
*/
commands.push(new Command({
    name: "time",
    regex: /^time$/i,
    testString: "time",
    prefix: ".",
    requirePrefix: true,
    shortDesc: "responds with the time at several time zones",
    longDesc: "responds with the time in UTC, CST, EST, PST, NZST, and JST",
    log: true,
    typing: false,
    points: 1,
    run: (message, args) => {
        let fullZones = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC"];
        //msg += fullName;
        let inputTime = moment();
        let msg = inputTime.valueOf() + "\n";
        msg += fullZones.map((v) => {
            return inputTime.tz(v).format('ddd, MMM Do YYYY, h:mma z')
        }).join("\n");
        msg = "`" + msg + "`";
        return msg;
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
    run: async (message, args) => {
        let body = await rp({
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
            rich.setImage(pic);
            rich.setTitle(escapeMarkdownText(htmldecode(name)));
            rich.setURL(link);
            if (tribe !== "-") desc += tribe + "\n";
            $(this).find(".el-card-detail-status").each(function (i, e) {
                if ($(this).find(".el-card-detail-status-header").text().trim() == "") {
                    desc += htmldecode($(this).find(".el-card-detail-skill-description").html().trim().replace(/<br>/g, "\n"));
                } else {
                    let fieldtitle = $(this).find(".el-label-card-state").text().trim();
                    let atk = $(this).find(".is-atk").text().trim();
                    let def = $(this).find(".is-life").text().trim();
                    let desc = htmldecode($(this).find(".el-card-detail-skill-description").html().trim().replace(/<br>/g, "\n"));
                    rich.addField(escapeMarkdownText(htmldecode(fieldtitle)), `${atk}/${def}\n${escapeMarkdownText(desc)}`)
                }
            })
            rich.setDescription(escapeMarkdownText(htmldecode(desc)));
            list.push([name, rich]);
        })
        if (list.length < 1) {
            responseMessage = "`No results`";
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
            responseMessage = msg;
        }
        return responseMessage;
    }
}))

let timeouts = [];

function createReminder(user_id, channel_id, message_text, message_id, time, original_time, url) {
    try {
        let info = sql.prepare("INSERT INTO reminders(user_id, channel_id, message_text, message_id, time, original_time, url) VALUES (?,?,?,?,?,?,?)").run(user_id, channel_id, message_text, message_id, time.valueOf(), original_time, url);
        if (info.changes < 1) throw new Error("Could not create reminder");
        let rich = Discord.RichEmbed();
        rich.setTitle(message_text);
        rich.setDescription(`Setting reminder to ${time.format("MMM D YYYY h:mm:ss a z")}`);
        rich.setTimestamp(time);
        setReminder(info.lastInsertRowid, user_id, channel_id, message_text, message_id, time.valueOf(), original_time, url);
        return rich;
    } catch (e) {
        err(e)
    }
}

function setReminder(id, user_id, channel_id, message_text, message_id, time, original_time, url) {
    try {
        let now = moment();
        let wait = (time - now.valueOf());
        //handle long timeouts;
        if (wait > 2147483647) return;

        timeouts[id] = bot.setTimeout(function () {
            let info = sql.prepare("UPDATE reminders SET triggered=TRUE where id=?").run(id);
            if (info.changes < 1) throw new Error("Could not modify reminder");
            let channel = bot.channels.resolve(channel_id)
            if (!channel) throw new Error("Could not find channel");
            let rich = new Discord.RichEmbed();
            let user;
            let username;
            if (channel.type == "text") {
                let member = channel.members.get(user_id)
                if (member == null) throw new Error("Could not find member");
                user = member.user;
                username = member.nickname;
            } else if (channel.type == "dm") {
                user = channel.recipient;
            }
            if (user == null) throw new Error("Could not find user");
            if (username == null) username = user.username;
            rich.setAuthor(username, user.displayAvatarURL());
            rich.setDescription(message_text);
            rich.setTimestamp(original_time);
            bot.channels.resolve(channel_id).send(`reminder: ${message_text}\n${url}`, {
                reply: user,
                embed: rich
            });
        }, wait)
    } catch (e) {
        err(e)
    }
}

function cancelReminder(id) {
    let info = sql.prepare("UPDATE reminders SET triggered=TRUE where id=?").run(id);
    if (timeouts[id]) bot.clearTimeout(timeouts[id]);
    timeouts[id] = null;
    if (info.changes < 1) return false;
    return true
}

commands.push(new Command({
    name: "reminder",
    regex: /^remind(?:me|er|ers) (.+)$/i,
    prefix: ".",
    requirePrefix: true,
    hidden: true,
    testString: '.reminder this is a test message 5 seconds',
    shortDesc: "sends a message to yourself at a later time",
    longDesc: {
        title: `.reminder (message_with_timestring) or .reminder (action) (arg) or .reminder (message) (num) (unit_of_time)`,
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
    typing: false,
    run: (message, args) => {
        function listReminders() {
            let rows = sql.prepare("SELECT * FROM reminders WHERE user_id=? AND triggered=false AND channel_id=?").all(message.author.id, message.channel.id);
            if (rows.length < 1) {
                let rich = new Discord.RichEmbed()
                    .setTitle("No reminders left")
                return rich;
            }
            let lines = rows.map((reminder, index) => {
                return `**${index + 1}.** ${reminder.message_text} — ${moment(reminder.time).format("MMM D YYYY h:mm:ss a z")}`
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
            let row = sql.prepare("SELECT row_number() OVER (ORDER BY original_time) fake_id, id FROM reminders WHERE user_id=? AND channel_id=? AND triggered=false ORDER BY original_time DESC LIMIT 1").get(message.author.id, message.channel.id);
            if (row && cancelReminder(row.id)) {
                return [`\`Canceled reminder ${row.fake_id}\``, listReminders()]
            }
            return `\`Failed to cancel reminder\``;
        }
        let a = /cancel (\d+)$/i.exec(args[1]);
        if (a) {
            let fake_id = parseInt(a[1])
            let row = sql.prepare("SELECT id, fake_id FROM (SELECT row_number() OVER (ORDER BY original_time) fake_id, id FROM reminders WHERE user_id=? AND channel_id=? AND triggered=false) WHERE fake_id=?").get(message.author.id, message.channel.id, fake_id);
            if (row && cancelReminder(row.id)) {
                return [`\`Canceled reminder ${row.fake_id}\``, listReminders()]
            }
            return `\`Failed to cancel reminder\``;
        }
        let ret = ""
        if (process.platform == "linux") {
            ret = execFileSync("python3.7", ["main.pyc", args[1].toUpperCase()], { cwd: "external_scripts/dateparse/", encoding: "utf8" })
        } else {
            ret = execFileSync("py", ["-3", "main.pyc", args[1].toUpperCase()], { cwd: "external_scripts/dateparse/", encoding: "utf8" })
        }
        let time = moment.unix(parseFloat(ret));
        return ["", { embed: createReminder(message.author.id, message.channel.id, message.content, message.id, time, message.createdTimestamp, message.url) }]
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
    run: async (message, args) => {
        let response;
        if (args[1].toLowerCase() === "random") {
            response = await rp({
                url: `https://db.ygoprodeck.com/api/v7/randomcard.php`,
                json: true
            }).catch(e => { return { error: "`No cards found`" } })
        } else {
            response = await rp({
                url: `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(args[1])}`,
                json: true
            }).catch(e => { return { error: "`No cards found`" } })
        }
        if (response.error) return response.error;

        function cardRich(card) {
            let rich = new Discord.RichEmbed()
                .setTitle(escapeMarkdownText(card.name))
                .setURL(`http://yugioh.wikia.com/wiki/${encodeURIComponent(card.name)}`);
            if (card.card_images.length > 0) {
                rich.setImage(card.card_images[0].image_url)
            }
            let desc_lines = []
            if (card.attribute != null) desc_lines.push(`${card.attribute}`);
            if (card.level != null) desc_lines.push(`Level: ${card.level}:star:`);
            if (card.scale != null) desc_lines.push(`Scale: ${card.scale}`);
            if (card.linkmarkers != null) {
                const ascii_arrows = {
                    "Top": ":arrow_up:",
                    "Bottom": ":arrow_down:",
                    "Left": ":arrow_left:",
                    "Right": ":arrow_right:",
                    "Top-Left": ":arrow_upper_left:",
                    "Top-Right": ":arrow_upper_right:",
                    "Bottom-Left": ":arrow_lower_left:",
                    "Bottom-Right": ":arrow_lower_right:"
                };
                let links = card.linkmarkers.map(dir => {
                    return ascii_arrows[dir];
                }).join(" ")

                desc_lines.push(`LINK: ${links}`);
            }
            let race_type = []
            if (card.race != null) race_type.push(card.race)
            if (card.type != null) race_type.push(card.type)
            if (race_type.length > 0) desc_lines.push(`**[${escapeMarkdownText(race_type.join(" / "))}]**`)
            if (card.desc != null) desc_lines.push(escapeMarkdownText(card.desc).replace("----------------------------------------\r\n",""));
            let atk_def = []
            if (card.atk != null) atk_def.push(`ATK/${card.atk}`);
            if (card.def != null) atk_def.push(`DEF/${card.def}`);
            if (card.linkval && card.linkval > 0) atk_def.push(`LINK–${card.linkval}`);
            if (atk_def.length > 0) desc_lines.push(`**${atk_def.join("  ")}**`)
            desc_lines.push(``);
            if (card.banlist_info) {
                const format = {
                    "ban_tcg": "TCG",
                    "ban_ocg": "OCG",
                    "ban_goat": "GOAT"
                };
                Object.keys(card.banlist_info).forEach(key=>{
                    desc_lines.push(`**${format[key]}**: ${card.banlist_info[key]}`);                    
                })
            }
            if (card.card_prices != null) {
                const shops = Object.keys(card.card_prices[0])
                let sum = shops.map(shop=>{
                    return parseFloat(card.card_prices[0][shop])
                }).reduce((a,b)=>{
                    return a+b;
                },0)
                let avg = sum/shops.length
                desc_lines.push(`Price: $${avg.toFixed(2)}`);
            }
            rich.setDescription(desc_lines.join("\n"));
            return rich;
        }

        let card_list = response.data.map(card => {
            return [card.name, () => { return cardRich(card) }]
        })

        if (card_list.length == 1) {
            return card_list[0][1]();
        } else if (card_list.length > 1) {
            return ["", new Discord.RichEmbed({
                title: "Multiple cards found",
                description: createCustomNumCommand3(message, card_list)
            })];
        } else {
            return ["`No cards found`"];
        }
    }
}))

let token;
let meta;
commands.push(new Command({
    name: "hs",
    regex: /^hs (.+)$/i,
    requirePrefix: true,
    prefix: ".",
    testString: ".hs open the waygate",
    shortDesc: "returns hearthstone card data",
    longDesc: `.hs (card name)
returns hearthstone card data`,
    req: () => { return config.api.blizzard; },
    log: true,
    points: 1,
    run: async (message, args) => {
        const credentials = {
            client: {
                id: config.api.blizzard.id,
                secret: config.api.blizzard.secret
            },
            auth: {
                tokenHost: 'https://us.battle.net/oauth/token'
            }
        };
        if (!token || token.expired()) {
            const thisoauth = oauth2.create(credentials);
            const result = await thisoauth.clientCredentials.getToken();
            token = thisoauth.accessToken.create(result);
        }
        //gameMode=battlegrounds
        let cardsprom1 = rp({
            url: `https://us.api.blizzard.com/hearthstone/cards?locale=en_US&textFilter=${args[1]}&gameMode=constructed&access_token=${token.token.access_token}`,
            //url: `https://us.api.blizzard.com/hearthstone/cards?locale=en_US&id=59891&access_token=${token.token.access_token}`,
            json: true
        });
        let cardsprom2 = rp({
            url: `https://us.api.blizzard.com/hearthstone/cards?locale=en_US&textFilter=${args[1]}&gameMode=battlegrounds&access_token=${token.token.access_token}`,
            json: true
        });
        if (!meta) {
            meta = await rp({
                url: `https://us.api.blizzard.com/hearthstone/metadata?locale=en_US&access_token=${token.token.access_token}`,
                json: true
            });
        }
        let cards = (await cardsprom1).cards
        let cards2 = (await cardsprom2).cards
        cards = cards.concat(cards2)
        function cardRich(card, mode) {
            let rich = new Discord.RichEmbed();
            rich.setTitle(card.name);
            let desc_lines = [];
            if (!card.battlegrounds) {
                rich.setImage(card.image);
                if (card.classId) {
                    let class2 = meta.classes.find(class3 => {
                        return class3.id == card.classId;
                    });
                    desc_lines.push(`**Class:** ${class2.name}`);
                }
                if (card.cardSetId) {
                    let set = meta.sets.find(set => {
                        return set.name.id == set.classId;
                    });
                    desc_lines.push(`**Set:** ${set.name}`);
                }
                if (card.manaCost) desc_lines.push(`**Cost**: ${card.manaCost}`);
            } else {
                if (card.battlegrounds.hero) desc_lines.push(`**Hero**`);
                if (card.battlegrounds.tier) desc_lines.push(`**Tier**: ${card.battlegrounds.tier}`);
                rich.setImage(card.battlegrounds.image);
            }
            if (card.collectible != 1) desc_lines.push("**Uncollectible**");
            if (card.attack && card.health) desc_lines.push(`${card.attack}/${card.health}`);
            desc_lines.push("");
            if (card.text) {
                card.text = card.text.replace(/&nbsp;/g, " ");
                card.text = card.text.replace(/\*/g, "\\*");
                card.text = card.text.replace(/<i>/g, "*");
                card.text = card.text.replace(/<\/i>/g, "*");
                card.text = card.text.replace(/<b>/g, "**");
                card.text = card.text.replace(/<\/b>/g, "**");
                desc_lines.push(card.text);
            }
            if (card.flavorText) {
                card.flavorText = card.flavorText.replace(/<i>/g, "");
                card.flavorText = card.flavorText.replace(/<\/i>/g, "");
                card.flavorText = card.flavorText.replace(/<b>/g, "");
                card.flavorText = card.flavorText.replace(/<\/b>/g, "");
            }
            rich.setDescription(desc_lines.join("\n"));
            rich.setFooter(card.flavorText);
            return rich;
        }
        cards = cards.map(card => {
            let title = card.name
            if (card.battlegrounds) title += " (BG)";
            return [title, () => { return cardRich(card) }];
        })
        if (cards.length < 1) {
            return "`No results`";
        } else if (cards.length == 1) {
            return cards[0][1]();
        } else {
            let rich = new Discord.RichEmbed({
                title: "",
                description: createCustomNumCommand3(message, cards)
            })
            return rich;
        }
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
    req: () => { return art; },
    shortDesc: "return artifact cards",
    longDesc: `.art (search_term or random)
return artifact cards`,
    log: true,
    points: 1,
    run: async (message, args) => {
        function simplifyname(s) {
            s = replaceAll(s, " ", "");
            s = replaceAll(s, "-", "");
            s = s.toLowerCase()
            return s;
        }
        let perfectmatch = [];
        let goodmatch = [];
        if (args[1].toLowerCase() === "random") {
            let keys = Object.keys(art)
            let rand = Math.floor(keys.length * Math.random())
            let card = art[keys[rand]]
            perfectmatch.push([card.card_name, async () => await createMessage(card)])
        } else {
            Object.keys(art).forEach((key) => {
                let card = art[key]
                let cardsimplename = simplifyname(card.card_name);
                let searchsimple = simplifyname(args[1]);
                if (cardsimplename === searchsimple) perfectmatch.push([card.card_name, async () => await createMessage(card)]);
                else if (cardsimplename.indexOf(searchsimple) > -1) goodmatch.push([card.card_name, async () => await createMessage(card)]);
            })
        }

        async function parselist(list) {
            if (list.length == 1) {
                return await list[0][1]();
            } else if (list.length > 1) {
                let rich = new Discord.RichEmbed({
                    title: "Multiple cards found",
                    description: createCustomNumCommand3(message, list)
                })
                return ["", { embed: rich }]
            } else {
                return false;
            }
        }

        async function createMessage(card) {
            let rich = new Discord.RichEmbed();
            let price;
            let link;
            try {
                let pricebody = await rp("https://steamcommunity.com/market/priceoverview/?appid=583950&currency=1&market_hash_name=1" + card.card_id)
                let pricedata = JSON.parse(pricebody);
                if (pricedata.success) {
                    price = pricedata.lowest_price;
                    link = "https://steamcommunity.com/market/listings/583950/1" + card.card_id
                }
            } catch (e) {

            }
            rich.setTitle(escapeMarkdownText(card.card_name));
            if (card.card_text) {
                rich.addField(card.card_type, escapeMarkdownText(card.card_text));
            } else {
                rich.setDescription("**" + card.card_type + "**");
            }
            if (card.rarity) rich.addField("Rarity", card.rarity)
            if (card.set) rich.addField("Set", card.set)
            if (card.references.length > 0) {
                let reflist = card.references.map((ref) => {
                    return art[ref.card_id].card_name;
                }).join("\n");
                rich.addField("Includes", reflist)
            }
            if (price) rich.addField("Price", price)
            if (link) rich.setURL(link)
            rich.setImage(card.image)
            return ["", { embed: rich }]
        }

        return await parselist(perfectmatch) || await parselist(goodmatch) || "`No cards found`"
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
    longDesc: {
        title: `.mtg __search_term or random__`,
        description: `returns Magic the Gathering card`,
        fields: [{
            name: `search_term`,
            value: `The card name. For split, double-faced and flip cards, just the name of one side of the card. Basically each ‘sub-card’ has its own record.`
        }, {
            name: `random`,
            value: `returns a random card`
        }, {
            name: `Examples`,
            value: `.mtg saheeli
.mtg random`
        }]
    },
    log: true,
    points: 1,
    run: async (message, args) => {
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
            if (card.text) desc_lines.push(replaceIcons(escapeMarkdownText(card.text)));
            let stats = ""
            if (card.power) stats += card.power;
            if (card.toughness) stats += "/" + card.toughness;
            if (stats !== "") desc_lines.push(stats);
            if (card.flavor) desc_lines.push(`\n*_${card.flavor}_*`);

            rich.setDescription(desc_lines.join("\n"))
            return rich;
        }

        function replaceIcons(text) {
            let icons = {
                "{R/G}": `<:mtg_ur:609868515255517215>`,
                "{U/R}": `<:mtg_ur:609868528182493186>`,
                "{R/W}": `<:mtg_rw:609867524061921320>`,
                "{W/B}": `<:mtg_wb:609867910772424748>`,
                "{B/R}": `<:mtg_br:609867020770607104>`,
                "{B/G}": `<:mtg_bg:609860420127424518>`,
                "{E}": `<:mtg_e:584109084861530132>`,
                "{W}": `<:mtg_w:584108894595448970>`,
                "{U}": `<:mtg_u:584108894922735629>`,
                "{T}": `<:mtg_t:584108894591254535>`,
                "{R}": `<:mtg_r:584108894524276746>`,
                "{G}": `<:mtg_g:584108863607930881>`,
                "{B}": `<:mtg_b:584108877440876544>`,
                "{C}": `<:mtg_c:584131157206237184>`,
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
            Object.keys(icons).forEach(icon => {
                let literal = icon.replace(/\{/g, `\\{`).replace(/\}/g, `\\}`)
                text = text.replace(new RegExp(literal, 'g'), icons[icon]);
            })
            return text;
        }

        //https://docs.magicthegathering.io/#api_v1cards_list
        let response;
        if (args[1].toLowerCase() === "random") {
            response = await rp(`https://api.magicthegathering.io/v1/cards?random=true&pageSize=100`)
            response = JSON.parse(response);
            response.cards = [response.cards.find(card => {
                return card.multiverseid !== undefined;
            })]
        } else {
            response = await rp(`https://api.magicthegathering.io/v1/cards?name=${encodeURIComponent(args[1])}`)
            response = JSON.parse(response);
        }
        let card_list = {}

        response.cards.forEach((card) => {
            card.checkid = card.multiverseid || 0;
            if (!card_list[card.name]) card_list[card.name] = card;
            else if (card_list[card.name].checkid < card.checkid) card_list[card.name] = card
        })

        card_list = Object.values(card_list).map(card => {
            return [card.name, () => { return [cardRich(card)] }]
        })

        if (card_list.length < 1) {
            return "`No results`";
        } else if (card_list.length == 1) {
            return card_list[0][1]();
        } else {
            let rich = new Discord.RichEmbed({
                title: "Multiple cards found",
                description: createCustomNumCommand3(message, card_list)
            })
            return rich;
        }
    }
}))

let teppen = null;
fs.readFile("./data/teppen.json", 'utf8', function (e, data) {
    if (e) {
        console.error("Teppen data not found");
    } else {
        teppen = JSON.parse(data);
    }
})

commands.push(new Command({
    name: "teppen",
    regex: /^tep(?:pen)? (.+)$/i,
    prefix: ".",
    testString: ".teppen jill",
    hidden: false,
    requirePrefix: true,
    req: () => { return teppen; },
    shortDesc: "search for TEPPEN cards",
    longDesc: `.teppen (search)`,
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) => {
        function simplifyname(s) {
            s = s.replace(/ /g, "");
            s = s.replace(/-/g, "");
            s = s.replace(/\./g, "");
            s = s.toLowerCase();
            return s;
        }
        function createRich(card) {
            let rich = new Discord.RichEmbed();
            rich.setTitle(card.Name);
            let desclines = [`**ID:** ${card["No."]}`];
            if (card.Type) desclines.push(`**Type:** ${card.Type}`);
            if (card.Rarity) desclines.push(`**Rarity:** ${card.Rarity}`);
            if (card.Tribe) desclines.push(`**Tribe:** ${card.Tribe}`);
            if (card.MP) desclines.push(`${card.MP} MP`);
            if (card.Attack) {
                let line = card.Attack;
                if (card.HP) {
                    line += "/" + card.HP;
                }
                desclines.push(line);
            }
            if (card.Effects) desclines.push(card.Effects);
            rich.setDescription(desclines.join("\n"));
            rich.setImage(`https://teppenthegame.com${card.Img}`)
            return ["", { embed: rich }]
        }
        let perfectmatch = [];
        let goodmatch = [];
        Object.keys(teppen).forEach((key) => {
            let card = teppen[key]
            let simplename = simplifyname(card.Name);
            let searchsimple = simplifyname(args[1]);
            if (simplename === searchsimple) perfectmatch.push([`${card.Name} — ${card["No."]}`, createRich(card)]);
            else if (simplename.indexOf(searchsimple) > -1) goodmatch.push([`${card.Name} — ${card["No."]}`, createRich(card)]);
        })

        function parselist(list) {
            if (list.length == 1) {
                return list[0][1];
            } else if (list.length > 1) {
                let rich = new Discord.RichEmbed({
                    title: "Multiple cards found",
                    description: createCustomNumCommand3(message, list)
                })
                return ["", { embed: rich }]
            } else {
                return false;
            }
        }

        return parselist(perfectmatch) || parselist(goodmatch) || "`Card not found`";
    }
}))

let ahdb = null;
rp({
    url: `https://arkhamdb.com/api/public/cards/`,
    json: true
}).then((json)=>{
    ahdb = json;
})
let adbsql;
if (fs.existsSync('sqlitedb/ahlcg.sqlite')) { adbsql = new Database('sqlitedb/ahlcg.sqlite');}

commands.push(new Command({
    name: "adb",
    regex: /^adb (.+)$/i,
    prefix: ".",
    testString: ".adb emergency cache",
    hidden: false,
    requirePrefix: true,
    req: () => { return ahdb; },
    shortDesc: "search for Arkham Horror LCG cards",
    longDesc: `.adb (search)`,
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) => {
        function simplifyname(s) {
            s = s.replace(/ /g, "");
            s = s.replace(/-/g, "");
            s = s.replace(/\./g, "");
            s = s.toLowerCase();
            return s;
        }
        function parseCardText(s) {
            s = s.replace(/\[\[(.+?)\]\]/g, "***$1***");
            s = s.replace(/\[(.+?)\]/g, "**$1**");
            s = s.replace(/<b>(.+?)<\/b>/g, "**$1**");
            s = s.replace(/<i>(.+?)<\/i>/g, "*$1*");
            s = s.replace(/<br\/>/g, "\n");
            return s;
        }
        function createRich(card) {
            let cardanalytics;
            if (adbsql) cardanalytics = adbsql.prepare("select * from card where id=?").get(card.code);
            let rich = new Discord.RichEmbed();
            rich.setTitle(card.name);
            if (card.url != null) rich.setURL(card.url)
            let desclines = [];
            if (cardanalytics != null) desclines.push(`Pick Rate: ${Math.round(cardanalytics.count*100/cardanalytics.possible)}%`);
            if (card.faction_name != null) desclines.push(`${card.faction_name}`);
            if (card.type_name != null) desclines.push(`**${card.type_name}**`);
            if (card.traits != null) desclines.push(`*${card.traits}*`);
            if (card.cost != null) desclines.push(`Cost: ${card.cost}`);
            if (card.xp != null) desclines.push(`XP: ${card.xp}`);
            if (card.text != null) desclines.push(parseCardText(card.text));
            rich.setDescription(desclines.join("\n"));
            if (card.imagesrc != null) rich.setImage(`https://arkhamdb.com${card.imagesrc}`)
            if (card.flavor != null) rich.setFooter(card.flavor)
            return ["", { embed: rich }]
        }
        let cardlist = [];
        ahdb.forEach(card=>{
            if (simplifyname(card.name).indexOf(simplifyname(args[1]))>-1) {
                let title = card.name;
                let xptext = ""
                if (card.xp != null && card.xp>0) title = `${card.name} (${card.xp})`
                cardlist.push([title, ()=>{
                    return createRich(card)
                }]);
            } else if (card.code == args[1]) {
                let title = card.name;
                if (card.xp != null && card.xp>0) title = `${card.name} (${card.xp})`
                cardlist.push([title, ()=>{
                    return createRich(card)
                }]);
            }
        })

        function parselist(list) {
            if (list.length == 1) {
                return list[0][1]();
            } else if (list.length > 1) {
                let rich = new Discord.RichEmbed({
                    title: "Multiple cards found",
                    description: createCustomNumCommand3(message, list)
                })
                return ["", { embed: rich }]
            } else {
                return false;
            }
        }

        return parselist(cardlist) || "`Card not found`";
    }
}))

/*
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
    req: () => { return gundam; },
    shortDesc: "you get gundam stuff back",
    longDesc: `.gundam (search)`,
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) => {
        function simplifyname(s) {
            s = replaceAll(s, " ", "");
            s = replaceAll(s, "-", "");
            s = s.toLowerCase()
            return s;
        }
        let perfectmatch = [];
        let goodmatch = [];
        Object.keys(gundam).forEach((key) => {
            let thisgundam = gundam[key]
            let simplename = simplifyname(thisgundam.Model);
            let searchsimple = simplifyname(args[1]);
            if (simplename === searchsimple) perfectmatch.push([thisgundam.Model, createMessage(thisgundam)]);
            else if (simplename.indexOf(searchsimple) > -1) goodmatch.push([thisgundam.Model, createMessage(thisgundam)]);
        })

        function parselist(list) {
            if (list.length == 1) {
                return list[0][1];
            } else if (list.length > 1) {
                let rich = new Discord.RichEmbed({
                    title: "Multiple gundams found",
                    description: createCustomNumCommand3(message, list)
                })
                return ["", { embed: rich }]
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
            return ["", { embed: rich }]
        }

        return parselist(perfectmatch) || parselist(goodmatch) || "`Gundam not found`";
    }
}))
*/
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
    regex: /^(?:t7|tek) (\S+)(?: ([^\n\r]+?))?$/i,
    prefix: ".",
    requirePrefix: true,
    req: () => { return t7},
    testString: ".t7 ak block=1",
    log: true,
    points: 1,
    typing: false,
    shortDesc: "returns info on Tekken 7 moves",
    longDesc: {
        title: `.t7 __character_name__ __condition__`,
        description: `returns information on a Tekken 7 character's move string`,
        fields: [{
            name: `character_name`,
            value: `full or part of a character's name`
        }, {
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
        }, {
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
    run: async (message, args) => {

        function simplifyMove(s) {
            s = s.toLowerCase();
            s = replaceAll(s, " ", "");
            s = replaceAll(s, "\\/", "");
            s = replaceAll(s, ",", "");
            s = replaceAll(s, ":", "");
            s = replaceAll(s, "~", "");
            s = s.replace(/\*/g, "");
            s = replaceAll(s, "(\\D)\\+(\\d)", "$1$2");
            s = replaceAll(s, "(\\D)\\+(\\D)", "$1$2");
            if (s.indexOf("run") == 0) s = "fff" + s.slice(3);
            if (s.indexOf("running") == 0) s = "fff" + s.slice(6);
            if (s.indexOf("wr") == 0) s = "fff" + s.slice(2);
            if (s.indexOf("cd") == 0) s = "fnddf" + s.slice(2);
            if (s.indexOf("rds") == 0) s = "bt" + s.slice(3);
            if (s.indexOf("qcf") == 0) s = "ddff" + s.slice(3);
            if (s.indexOf("qcb") == 0) s = "ddbb" + s.slice(3);
            if (s.indexOf("hcf") == 0) s = "bdbddff" + s.slice(3);
            if (s.indexOf("hcb") == 0) s = "fdfddbb" + s.slice(3);
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
        args[2] = args[2] || " ";
        let double_names = ["armor king", "lucky chloe", "devil jin", "master raven", "jack 7"]
        if (double_names.indexOf((args[1] + " " + args[2].split(" ", 1)[0]).toLowerCase()) > -1) {
            args[2] = args[2].slice(args[2].split(" ", 1)[0].length + 1);
        }
        else if (nameinput == "dj") nameinput = "devil"
        else if (nameinput == "djin") nameinput = "devil"
        else if (nameinput == "dvj") nameinput = "devil"
        else if (nameinput == "panda") nameinput = "kuma"
        else if (nameinput == "ak") nameinput = "armor"

        //special move conversions
        if (args[2].toLowerCase() == "rd") args[2] = "rage drive"
        else if (args[2].toLowerCase() == "ra") args[2] = "rage art"

        Object.keys(t7).forEach((v, i) => {
            let charindex = v.indexOf(nameinput);
            if (charindex === 0) charfound.push(v);
            else if (charindex > 0) charfoundmid.push(v);
        })

        function parseCharList(charfound) {
            if (charfound.length == 1) return getMove(charfound[0], args[2]);
            else if (charfound.length > 1) {
                extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                    var num = parseInt(message.content) - 1;
                    if (num < charfound.length && num > -1) {
                        message.channel.send.apply(message.channel, getMove(charfound[num], args[2])).catch(err);
                        return true;
                    }
                    return false;
                })
                let msg = charfound.map((e, i) => {
                    return `**${i + 1}**. ${t7[e].name}`
                }).join("\n");
                let rich = new Discord.RichEmbed();
                rich.setDescription(msg);
                rich.setTitle("Choose your fighter")
                return ["", rich];
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
                    Object.entries(char.moves).forEach((entry) => {
                        //for each move {command, name, etc}
                        entry[1].forEach((moveobj) => {
                            //check if move satisfies all conditions
                            let match = conditions.every((cur) => {
                                //condition has to return true for at least 1 field:value
                                return Object.entries(moveobj).some((field) => {
                                    //field[0] is the field name and field[1] is the field value
                                    //ignore gfycat and cell columns during comparison
                                    if (field[0] !== "gfycat" && field[0] !== "cell") {
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
                    function comparefunc(value, comparison, valuestring, isnumfield) {
                        if (isnumfield) {
                            if (comparison == "<") {
                                return value < valuestring;
                            } else if (comparison == ">") {
                                return value > valuestring;
                            } else if (comparison == "=" || comparison == ":") {
                                return value == valuestring;
                            } else if (comparison == "<=") {
                                return value <= valuestring;
                            } else if (comparison == ">=") {
                                return value >= valuestring;
                            }
                            return false;
                        }

                        if (comparison == "<" || comparison == "<=") {
                            return value.endsWith(valuestring);
                        } else if (comparison == "=") {
                            return value == valuestring;
                        } else if (comparison == ">" || comparison == ">=") {
                            return value.startsWith(valuestring);
                        } else if (comparison == ":") {
                            return value.indexOf(valuestring) > -1;
                        }
                    }

                    function checkregex(thisvalue, comparison, uservalue) {
                        if (comparison == "=") {
                            let reg = new RegExp("^" + thisvalue + "$");
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
                            let check = checkregex(thisvalue, comparison, uservalue);
                            return check;
                        }


                        if (thisfield.indexOf(userfield) !== 0) return false;
                        let numfields = ["damage", "startupframe", "blockframe", "hitframe", "counterhitframe", "post-techframes", "speed"];
                        let isnumfield = false;
                        let tmpthisvalue;
                        let tmpuservalue;
                        if (numfields.indexOf(thisfield) > -1 && !isNaN(uservalue)) {
                            isnumfield = true;
                            tmpthisvalue = parseInt(thisvalue);
                            tmpuservalue = parseInt(uservalue);
                        } else {
                            if (thisfield.indexOf("command") == 0) {
                                tmpthisvalue = simplifyMove(thisvalue);
                                tmpuservalue = simplifyMove(uservalue);
                            } else {
                                tmpthisvalue = simplifyfield(thisvalue);
                                tmpuservalue = simplifyfield(uservalue);
                            }
                        }
                        if (comparefunc(tmpthisvalue, comparison, tmpuservalue, isnumfield)) {
                            return true;
                        }
                        return false;
                    }
                }

                let conditions = [(arg1, arg2) => {
                    return parseConditionArgs("command", "=", move)(arg1, arg2);
                }]
                poslist = getMoveList(conditions);

                if (poslist.length < 1) {
                    let conditionstring = move.split("&");
                    conditions = conditionstring.map((cur) => {
                        let b;
                        if (b = /^(.+?)([<>]=|[:=<>])(.+)$/.exec(cur)) {
                            return parseConditionArgs(b[1], b[2], b[3]);
                        } else if (b = /^i(\d+)$/i.exec(cur)) {
                            return parseConditionArgs("startupframe", ":", b[1]);
                        } else {
                            return (arg1, arg2) => {
                                let defaultfields = ["command","name","notes","rbnorway","engrish"];
                                let found = defaultfields.find(field => {
                                    return parseConditionArgs(field, ":", cur)(arg1, arg2)
                                })
                                if (!found && isNaN(cur)){
                                    let otherfields = ["startup","hit","counter"];
                                    found = otherfields.find(field => {
                                        return parseConditionArgs(field, ":", cur)(arg1, arg2)
                                    })
                                }
                                return found;
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
                    description: createCustomNumCommand3(message, data_array)
                })
                return ["", { embed: rich }]
            } else {
                let rich = new Discord.RichEmbed();
                rich.setTitle(char.name)
                rich.setDescription(`Move not found\n**[Help improve the frame data here](https://docs.google.com/spreadsheets/d/${config.t7sheetid}#gid=${char.sheet_id})**\n\n**[or search rbnorway](${char.link})**`)
                return ["", { embed: rich }];
            }
        }

        function createMoveMessage(char, move) {
            let rich = new Discord.RichEmbed();
            rich.setTitle(char.name)
            let mes = Object.keys(move).filter((v) => {
                return v != "gfycat" && v != "regexp" && v != "cell";
            }).map((key) => {
                return `**${key}**: ${move[key]}`
            }).join("\n");
            if (move.cell) {
                mes += `\n**[Edit frame data](https://docs.google.com/spreadsheets/d/${config.t7sheetid}#gid=${char.sheet_id}&range=${move.cell})**`
            }
            rich.setDescription(mes);
            if (move.gfycat) {
                let gfycatid = /.+\/(.+?)$/.exec(move.gfycat);
                rich.setImage(`https://thumbs.gfycat.com/${gfycatid[1]}-size_restricted.gif`);
            }
            return rich;
            /*
            let gfycatlink = move.gfycat || "";
            let mes = `>>> __**${char.name}**__\n`
            mes += Object.keys(move).filter((v) => {
                return v != "gfycat" && v != "regexp" && v != "cell";
            }).map((key) => {
                return `**${key}**: ${move[key]}`
            }).join("\n");
            if (move.cell) {
                mes += `\n**Edit frame data:** <https://docs.google.com/spreadsheets/d/${config.t7sheetid}#gid=${char.sheet_id}&range=${move.cell}>`
            }
            mes += "\n" + gfycatlink;
            return mes;
            */
        }

        let msg = parseCharList(charfound) || parseCharList(charfoundmid) || "`Character not found`";
        return msg;
    }
}))
/*
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
    req: () => { return sc6; },
    log: true,
    points: 1,
    typing: false,
    shortDesc: "returns info on Soulcalibur 6 moves",
    longDesc: {
        title: `.sc6 __character_name__ __condition__`,
        description: `returns information about a Soulcalibur 6 character's attack string`,
        fields: [{
            name: `character_name`,
            value: `full or part of a character's name`
        }, {
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
        }, {
            name: "Examples",
            value: `**.sc6 tal aaba** - returns information on Talim's AABA
**.sc6 ivy ivy** - returns Ivy moves where the name contains "ivy"
**.sc6 nigh imp<15** - returns Nightmare moves that are faster than 15 frames
**.sc6 nigh hit level<m&hit level>h** - returns Nightmare moves that begin with a mid and end with a low`
        }]
    },
    run: async (message, args) => {
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
        Object.keys(sc6).forEach((v, i) => {
            let thisname = simplifyfield(v);
            let nameinput = simplifyfield(args[1]);
            let charindex = thisname.indexOf(nameinput);
            if (charindex === 0) charfound.push(v);
            else if (charindex > 0) charfoundmid.push(v);
        })


        function parseCharList(charfound) {
            if (charfound.length == 1) return getMove(charfound[0], args[2]);
            else if (charfound.length > 1) {
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
                    description: charfound.map((e, i) => {
                        return `${i + 1}. ${sc6[e].name}`
                    }).join("\n")
                })
                return ["", { embed: rich }];
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
                    function comparefunc(value, comparison, valuestring, isnumfield) {
                        if (isnumfield) {
                            if (comparison == "<") {
                                return value < valuestring;
                            } else if (comparison == ">") {
                                return value > valuestring;
                            } else if (comparison == "=" || comparison == ":") {
                                return value == valuestring;
                            }
                            return false;
                        }

                        if (comparison == "<") {
                            return value.endsWith(valuestring);
                        } else if (comparison == "=") {
                            return value.indexOf(valuestring) > -1;
                        } else if (comparison == ">") {
                            return value.startsWith(valuestring);
                        } else if (comparison == ":") {
                            return value.indexOf(valuestring) > -1;
                        }
                    }

                    return (thisfield, thisvalue) => {
                        thisfield = simplifyfield(thisfield);
                        userfield = simplifyfield(userfield);
                        if (thisfield.indexOf(userfield) < 0) return false;
                        let numfields = ["imp", "dmg", "chip", "grd", "hit", "ch", "gb"];
                        let isnumfield = false;
                        if (numfields.indexOf(thisfield) > -1 && !isNaN(uservalue)) {
                            isnumfield = true;
                            thisvalue = parseInt(thisvalue);
                            uservalue = parseInt(uservalue);
                        } else {
                            if (thisfield.indexOf("Command") == 0) {
                                thisvalue = simplifyMove(thisvalue);
                                uservalue = simplifyMove(uservalue);
                            } else {
                                thisvalue = simplifyfield(thisvalue);
                                uservalue = simplifyfield(uservalue);
                            }
                        }
                        if (comparefunc(thisvalue, comparison, uservalue, isnumfield)) {
                            return true;
                        }
                        return false;
                    }
                }

                let conditions = conditionstring.map((cur) => {
                    let b;
                    if (b = /^(.+)([=<>])(.+)$/.exec(cur)) {
                        return parseConditionArgs(b[1], b[2], b[3]);
                    } else if (b = /^i(\d+)$/i.exec(cur)) {
                        return parseConditionArgs("imp", ":", b[1]);
                    } else {
                        //return parseConditionArgs("command","=",cur) || parseConditionArgs("attack","=",cur);

                        return (arg1, arg2) => {
                            return parseConditionArgs("command", "=", cur)(arg1, arg2) || parseConditionArgs("attack", "=", cur)(arg1, arg2);
                        }
                    }
                })

                //for each {moveshorthand:[array of moves]}
                Object.entries(char.moves).forEach((entry) => {
                    //for each move {command, name, etc}
                    entry[1].forEach((moveobj) => {
                        //check if move satisfies all contitons
                        let match = conditions.every((cur) => {
                            //condition has to return true for at least 1 field:value
                            return Object.entries(moveobj).some((field) => {
                                if (field[0] !== "gfycat") {
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
                    description: createCustomNumCommand2(message, data_array)
                })
                return ["", { embed: rich }];
            } else {
                return [`\`Move not found\`\n<${char.link}>`];
            }
        }

        function createMoveMessage(char, move) {
            let rich = new Discord.RichEmbed({
                title: char.name,
                url: char.link,
                description: Object.keys(move).filter((v) => {
                    return move[v] != "";
                }).map((key) => {
                    return `**${key}**: ${move[key]}`
                }).join("\n")
            })
            //mes += gfycatlink;
            return ["", { embed: rich }];
        }

        let msg = parseCharList(charfound) || parseCharList(charfoundmid) || "`Character not found`"
        return msg;
    }
}))
*/

let ssbu = null;
fs.readFile("./data/ssbu.json", 'utf8', function (e, data) {
    if (e) {
        return console.error("SSBU data not found");
    } else {
        ssbu = JSON.parse(data);
    }
})

commands.push(new Command({
    name: "ssbu",
    regex: /^ssbu (\S+)(?: ([^\n\r]+?))?$/i,
    prefix: ".",
    requirePrefix: true,
    req: () => { return ssbu},
    testString: ".ssbu peach jab",
    log: true,
    points: 1,
    typing: false,
    shortDesc: "returns info on Super Smash Bros. Ultimate moves",
    longDesc: {
        title: `.ssbu __character_name__ __move_name__`,
        description: `returns info on Super Smash Bros. Ultimate moves`,
        fields: [{
            name: `character_name`,
            value: `full or part of a character's name (no spaces)`
        }, {
            name: `**move_name**`,
            value: `name of the move`
        }]
    },
    run: async (message, args) => {
        function simplifyName(s) {
            s = s.toLowerCase();
            s = replaceAll(s, " ", "");
            return s.trim();
        }

        function simplifyMove(s) {
            s = s.toLowerCase();
            s = replaceAll(s, " ", "");
            s = replaceAll(s, "forward", "f");
            s = replaceAll(s, "back", "b");
            s = replaceAll(s, "up", "u");
            s = replaceAll(s, "down", "d");
            s = replaceAll(s, "neutral", "n");
            return s.trim();
        }

        //find character
        let charfound = [];
        let charfoundmid = [];
        let nameinput = simplifyName(args[1]);
        args[2] = args[2] || " ";

        ssbu.forEach(char=>{
            if (simplifyName(char.name) == nameinput) {
                charfound.push(char);
            } else if (simplifyName(char.name).indexOf(nameinput)>-1) {
                charfoundmid.push(char)
            }
        })

        function parseCharList(charfound) {
            if (charfound.length == 1) return getMove(charfound[0], args[2]);
            else if (charfound.length > 1) {
                extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                    var num = parseInt(message.content) - 1;
                    if (num < charfound.length && num > -1) {
                        message.channel.send.apply(message.channel, getMove(charfound[num], args[2])).catch(err);
                        return true;
                    }
                    return false;
                })
                let msg = charfound.map((e, i) => {
                    return `**${i + 1}**. ${e.name}`
                }).join("\n");
                let rich = new Discord.RichEmbed();
                rich.setDescription(msg);
                rich.setTitle("Choose your fighter")
                return ["", rich];
            }
            return false;
        }        

        function getMove(char, move) {
            let poslist = [];
            let simplifiedinput = simplifyMove(move);
            char.moves.forEach(move=>{
                if (!move.movename) return;
                //console.log(simplifyMove(move.movename),simplifiedinput)
                if (simplifyMove(move.movename) == simplifiedinput) {
                    poslist.push(move);
                } else if (simplifyMove(move.movename).indexOf(simplifiedinput)>-1) {
                    poslist.push(move)
                }
            })
            if (poslist.length == 1) return [createMoveMessage(char, poslist[0])];
            else if (poslist.length > 1) {
                let data_array = poslist.map((v, i) => {
                    return [v.movename, [createMoveMessage(char, v)]]
                })
                let rich = new Discord.RichEmbed({
                    title: "Multiple moves found",
                    description: createCustomNumCommand3(message, data_array)
                })
                return ["", { embed: rich }]
            }
            return "`Move not found`";
        }

        function createMoveMessage(char, move) {
            let rich = new Discord.RichEmbed();
            rich.setTitle(char.name)
            let mes = Object.keys(move).filter(key=>{
                if (key == "gifs" || key == "hitbox") return false;
                if (move[key] == "" || move[key] == "--") return false
                return true;
            }).map((key) => {
                return `**${key}**: ${move[key]}`
            }).join("\n");
            rich.setDescription(mes);
            if (move.gifs!=null && move.gifs.length > 0) {
                rich.setImage(move.gifs[0]);
            }
            rich.setFooter("Data from ultimateframedata.com")
            return rich;
        }

        let msg = parseCharList(charfound) || parseCharList(charfoundmid) || "`Character not found`";
        return msg;
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
    regex: /^sts (.+)$/i,
    prefix: ".",
    testString: ".sts apparition",
    req: () => { return sts; },
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    typing: false,
    shortDesc: "returns info on Slay the Spire cards and relics",
    longDesc: `.sts (card_name or relic_name)
returns information on a Slay the Spire card or relic. Matches by substring`,
    run: (message, args) => {
        let results = [];
        sts.forEach((element) => {
            if (element.title.toLowerCase().indexOf(args[1].toLowerCase()) > -1) {
                results.push([element.title,()=>{
                    let rich = new Discord.RichEmbed();
                    rich.setTitle(element.title);
                    rich.setImage(element.image)
                    rich.setDescription(element.description);
                    return rich;
                }]);
            }
        })
        if (results.length < 1) {
            return ["`No results`"];
        } else if (results.length == 1) {
            return results[0][1]();
        } else {
            let rich = new Discord.RichEmbed({
                title: "Multiple results found",
                description: createCustomNumCommand3(message, results)
            })
            return rich;
        }
    }
}))

let osfe = null;
fs.readFile("./data/osfe.json", 'utf8', function (e, data) {
    if (e) {
        return console.error("OSFE data not found");
    } else {
        osfe = JSON.parse(data);
    }
})

commands.push(new Command({
    name: "osfe",
    regex: /^(?:osfe|eden) (.+)$/i,
    prefix: ".",
    testString: ".osfe coldstone",
    req: () => { return osfe; },
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    typing: false,
    shortDesc: "returns info on One Step From Eden spells and artifacts",
    longDesc: `.osfe (spell, artifact, or keyword)
returns information on a One Step From Eden spell, artifact, or keyword. Matches by substring`,
    run: (message, args) => {
        if (args[1].toLowerCase() === "random" || args[1].toLowerCase() === "rand") {
            let rand = Math.floor(osfe.length * Math.random())
            let card = osfe[rand]
            return new Discord.RichEmbed(card);
        }
        let results = [];
        osfe.forEach((element) => {
            if (element.title.toLowerCase().indexOf(args[1].toLowerCase()) > -1) {
                results.push([element.title,()=>{
                    return new Discord.RichEmbed(element);
                }]);
            }
        })
        
        if (results.length < 1) {
            return ["`No results`"];
        } else if (results.length == 1) {
            return results[0][1]();
        } else {
            let rich = new Discord.RichEmbed({
                title: "Multiple results found",
                description: createCustomNumCommand3(message, results)
            })
            return rich;
        }
    }
}))

//https://developer.riotgames.com/docs/lor#data-dragon_set-bundles
let runeterra = [];
fs.readFile("./data/runeterra/data/set1-en_us.json", 'utf8', function (e, data) {
    if (e) {
        return console.error("Legends of Runeterra data not found");
    } else {
        runeterra = runeterra.concat(JSON.parse(data));
    }
})
fs.readFile("./data/runeterra/data/set2-en_us.json", 'utf8', function (e, data) {
    if (e) {
        return console.error("Legends of Runeterra data not found");
    } else {
        runeterra = runeterra.concat(JSON.parse(data));
    }
})

commands.push(new Command({
    name: "lor",
    regex: /^(?:runeterra|rune|lor) (.+)$/i,
    prefix: ".",
    testString: ".lor karma",
    hidden: false,
    requirePrefix: true,
    shortDesc: "return legends of runeterra card info",
    req: () => { return runeterra; },
    longDesc: {
        title: `.runeterra __search_term or random__`,
        description: `returns Legends of Runeterra card`,
        fields: [{
            name: `__search_term or random__`,
            value: `search term for a Legends of Runeterra card name or a random card`
        }]
    },
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) => {
        function createCardEmbed(card) {
            let embed = new Discord.RichEmbed()
            embed.setTitle(card.name)
            let desclines = [];
            if (card.supertype) desclines.push(`**Supertype:** ${card.supertype}`);
            if (card.subtype) desclines.push(`**Subtype:** ${card.subtype}`);
            if (card.rarity) desclines.push(`**Rarity:** ${card.rarity}`);
            if (!card.collectible) desclines.push(`Non-collectible`);
            if (card.region) desclines.push(`**Region:** ${card.region}`);
            if (card.cost) desclines.push(`**Cost:** ${card.cost}`);
            if (card.keywords && card.keywords.length > 0) desclines.push(`${card.keywords.join(", ")}`);
            if (card.attack && card.health) desclines.push(`${card.attack} | ${card.health}`);
            desclines.push("");
            if (card.description) {
                desclines.push(card.description.replace(/<\/.+?>/g, "\u200b**").replace(/(\u200b\*\*){2,}/g, "\u200b**").replace(/<[^\/].*?>/g, "**\u200b").replace(/(\*\*\u200b){2,}/g, "**\u200b"));
            }
            //if (card.descriptionRaw) desclines.push(card.descriptionRaw);
            embed.addField(card.type, desclines.join("\n"));
            /*
            let attach = new Discord.MessageAttachment(`./data/runeterra/${card.assets[0].gameAbsolutePath.replace("http://dd.b.pvp.net/Set1/en_us/","")}`,`${card.cardCode}.png`);
            embed.attachFiles([attach]).setImage(`attachment://${card.cardCode}.png`);
            */
            embed.setImage(card.assets[0].gameAbsolutePath);
            embed.setFooter(card.flavorText);
            return embed;
        }
        if (args[1].toLowerCase() == "random") {
            return createCardEmbed(runeterra[Math.floor(Math.random() * runeterra.length)]);
        }
        let card_list = runeterra.filter(card => {
            return card.name.toLowerCase() == args[1].toLowerCase()
        }).map(card => {
            return [`${card.name} — ${card.cardCode}`, () => createCardEmbed(card)]
        })
        if (card_list.length == 0) {
            card_list = runeterra.filter(card => {
                return card.name.toLowerCase().indexOf(args[1].toLowerCase()) > -1;
            }).map(card => {
                return [`${card.name} — ${card.cardCode}`, () => createCardEmbed(card)]
            })
        }

        if (card_list.length == 1) {
            return card_list[0][1]();
        } else if (card_list.length > 1) {
            return new Discord.RichEmbed({
                title: "Multiple cards found",
                description: createCustomNumCommand3(message, card_list)
            });
        } else {
            return ["`No cards found`"];
        }
    }
}))

commands.push(new Command({
    name: "pokemon",
    regex: /^(?:pokemon|pkmn) (.+)$/i,
    prefix: ".",
    testString: ".pokemon 25",
    hidden: false,
    requirePrefix: true,
    shortDesc: "return info on pokemon, moves, and abilities",
    longDesc: {
        title: `.pokemon __search__`,
        description: `return info on pokemon, moves, and abilities`,
        fields: [{
            name: `__search__`,
            value: `search term for a pokemon name, move, or ability`
        }]
    },
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) => {
        return await Pokemon.search(args[1]);
    }
}))

//todo: .br .gw2api
let coin = null;
rp("https://www.cryptocompare.com/api/data/coinlist/").then(body => {
    try {
        coin = JSON.parse(body);
    } catch (e) {
        console.error("could not parse cryptocompare");
    }
})

commands.push(new Command({
    name: "crypto",
    regex: /^crypto(?: (\d*(?:\.\d+)?))? (\S+)(?: (\w+))?$/i,
    prefix: ".",
    testString: ".crypto 10 btc cad",
    req: () => { return coin; },
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "returns the exchange rate and graph of the price of a cryptocurrency",
    longDesc: `.crypto [amount] (from_symbol) [to_symbol]
returns a 30 hour graph of the price of a cryptocurrency
amount (optional) - the amount of from_symbol currency. Default is 1.
from_symbol - the currency symbol you are exchanging from. ex: BTC
to_symbol (optional) - the currency symbol you are exchanging to. Default is USD.`,
    run: async (message, args) => {
        let amt = 1;
        if (args[1]) amt = parseFloat(args[1]);
        let from = args[2].toUpperCase();
        let to = "USD";
        if (args[3]) to = args[3].toUpperCase();
        let price_prom = rp(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${encodeURIComponent(from)}&tsyms=${encodeURIComponent(to)}`)
        let body = await rp(`https://min-api.cryptocompare.com/data/histominute?fsym=${encodeURIComponent(from)}&tsym=${encodeURIComponent(to)}&limit=144&aggregate=10`)
        let res = JSON.parse(body);
        if (res.Response && res.Response === "Error") {
            return "`" + res.Message + "`";
        }

        let datapoints = res.Data.map(data => {
            return data.close;
        })
        let labels = res.Data.map(data => {
            let thisMoment = moment.tz(data.time * 1000, "America/New_York");
            if (thisMoment.minute() == 0 && thisMoment.hour() % 3 == 0) {
                if (thisMoment.hour() == 0) return thisMoment.format("ddd");
                return thisMoment.format("ha");
            } else {
                return "";
            }
        })

        const configuration = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: datapoints,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    pointRadius: 0
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            callback: (value) => {
                                if (value % 1 == 0) {
                                    return '$' + value
                                } else if (value < .01) {
                                    return '$' + value;
                                }
                                return '$' + value.toFixed(2);
                            },
                            fontStyle: "bold",
                            fontSize: 10
                        }
                    }]
                }
            }
        };
        let rich = new Discord.RichEmbed();

        body = await price_prom;
        res = JSON.parse(body);
        if (res.Response && res.Response === "Error") {
            let msg = res.Message;
            return "`" + msg + "`";
        }
        let fromsym = res.DISPLAY[from][to].FROMSYMBOL;
        if (fromsym == from) fromsym = "";
        let tosym = res.DISPLAY[from][to].TOSYMBOL;
        if (tosym == to) tosym = "";
        let to_amt = amt * res.RAW[from][to].PRICE;
        let pctchange = Math.abs(res.DISPLAY[from][to].CHANGEPCT24HOUR);
        let updown = "";
        if (res.DISPLAY[from][to].CHANGEPCT24HOUR > 0) updown = "▲";
        else if (res.DISPLAY[from][to].CHANGEPCT24HOUR < 0) updown = "▼";
        let image = "";
        if (coin && coin.Data[from]) {
            image = "https://www.cryptocompare.com" + coin.Data[from].ImageUrl
            from += ` (${coin.Data[from].CoinName})`;
        }
        if (coin && coin.Data[to]) to += ` (${coin.Data[to].CoinName})`;
        let msg = `${fromsym} ${amt} ${from} = ${tosym} ${to_amt} ${to} (${updown}${pctchange}%)`;

        let stream = createChartStream(configuration);
        rich.attachFiles([{ attachment: stream, name: `chart.png` }])
        rich.setImage(`attachment://chart.png`)
        rich.setAuthor(msg, image);
        rich.setFooter("Time is in EDT, the only relevant timezone.");

        return rich;
    }
}))

commands.push(new Command({
    name: "price",
    regex: /^price.*$/i,
    prefix: ".",
    testString: ".price",
    hidden: true,
    requirePrefix: true,
    shortDesc: "use .curr for foreign currencies, .stock for stocks, .crypto for cryptocurrency",
    longDesc: {
        title: `.price`,
        description: `use .curr for foreign currencies, .stock for stocks, .crypto for cryptocurrency`
    },
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) => {
        return `\`use .curr for foreign currencies, .stock for stocks, .crypto for cryptocurrency\``
    }
}))

commands.push(new Command({
    name: "curr",
    regex: /^curr (.+)$/i,
    prefix: ".",
    testString: ".curr 10 cad",
    hidden: false,
    requirePrefix: true,
    req: () => { return config.api.datafixer; },
    log: true,
    points: 1,
    shortDesc: "returns the exchange rate and graph of the price of a foreign currency",
    longDesc: `.curr [amount] (from_symbol) [to_symbol]
returns of the price of a foreign currency
amount (optional) - the amount of from_symbol currency. Default is 1.
from_symbol - the currency symbol you are exchanging from. ex: CAD
to_symbol (optional) - the currency symbol you are exchanging to. Default is USD.`,
    run: async (message, args) => {
        let a;
        if (a = /(?:(\d*(?:\.\d+)?) )?(\w+)(?: (\w+))?$/.exec(args[1])) {
            let amt = parseFloat(a[1]) || 1;
            let from = a[2].toUpperCase();
            let to = a[3] ? a[3].toUpperCase() : "USD";
            const response = await rp({
                url: `http://data.fixer.io/api/latest?access_key=60f56846eb49204d79b8398921edb041`,
                json: true
            })
            if (response.error) return "`" + response.error.info + "`";
            if (!response.rates[to] || !response.rates[from]) return "`You have provided one or more invalid Currency Codes. [Required format: currencies=EUR,USD,GBP,...]`"
            let rate = response.rates[to] / response.rates[from];
            return `\`${amt} ${from} = ${Math.round(amt * rate * 1000000) / 1000000} ${to}\``
        }
        return "`Wrong format. .curr help for additional information`"
    }
}))

commands.push(new Command({
    name: "stock",
    regex: /^stock ([\w\d]+)$/i,
    prefix: ".",
    testString: ".stock aapl",
    hidden: false,
    requirePrefix: true,
    req: () => { return config.api.stock; },
    shortDesc: ".returns price and chart of stock symbol",
    longDesc: `.stock (symbol)
returns price and chart of stock symbol`,
    log: true,
    points: 1,
    run: async (message, args) => {
        //https://iexcloud.io/console/usage
        //https://iexcloud.io/docs/api/#historical-prices
        let base = `https://cloud.iexapis.com/stable/`
        let symbol = args[1]
        let token = config.api.stock;

        let response = await rp(`${base}ref-data/us/dates/trade/last/2?token=${token}`)
        response = JSON.parse(response);
        let promprice = rp(`${base}stock/${symbol}/quote?token=${token}`)
        let promlist = [];
        response.forEach(data => {
            promlist.push(rp(`${base}stock/${symbol}/chart/date/${data.date.replace(/-/g, "")}?token=${token}&chartInterval=1`))
        })
        try {
            response = await rp(`${base}stock/${symbol}/intraday-prices?token=${token}&chartInterval=1`)
        } catch (e) {
            if (e.error == "Unknown symbol") return `\`${e.error}\``;
        }
        response = JSON.parse(response);
        let stock_data = response;
        let thisdate = stock_data.length > 0 ? stock_data[0].date : "";
        for (let promnum = 0; promnum < promlist.length; promnum++) {
            response = await promlist[promnum]
            response = JSON.parse(response);
            if (response[0].date == thisdate) {
                continue;
            }
            stock_data = response.concat(stock_data);
        }
        stock_data = stock_data.map((data, index) => {
            return {
                close: data.close,
                index: index,
                time: moment.tz(`${data.date} ${data.minute}`, "YYYY-MM-DD HH:mm", "America/New_York")
            }
        })
        let stock_price = JSON.parse(await promprice);
        let horizontal = []
        let labels = [];
        let datapoints = [];
        let previouspoint = stock_data[0].time;
        let offset = 0;
        function addLabelsForDate(time) {
            let time2 = time.clone().hour(9).minute(30).seconds(0);
            horizontal.push(time2.unix() - offset);
            labels.push({
                tick: time2.unix() - offset,
                label: time2.format("MMM D")
            })
            time2.hour(12).minute(0).seconds(0);
            if (time2.isSameOrAfter(time)) return;
            labels.push({
                tick: time2.unix() - offset,
                label: time2.format("ha")
            })
            time2.hour(14).minute(0).seconds(0);
            if (time2.isSameOrAfter(time)) return;
            labels.push({
                tick: time2.unix() - offset,
                label: time2.format("ha")
            })
        }
        stock_data.forEach((data, ind, arr) => {
            if (previouspoint.date() != data.time.date()) {
                addLabelsForDate(previouspoint)
                offset += data.time.diff(previouspoint, "seconds")
            }
            if (!data.close) return;
            datapoints.push({
                x: data.time.unix() - offset,
                y: data.close
            })
            previouspoint = data.time;
        })
        addLabelsForDate(previouspoint)
        let time2 = previouspoint.clone().hour(3).minute(59).seconds(0);
        if (time2.isSameOrAfter(previouspoint)) {
            labels.push({
                tick: time2.unix() - offset,
                label: "4pm"
            })
        }

        let annotations = horizontal.map(label => {
            return {
                type: "line",
                mode: "vertical",
                scaleID: "x-axis-0",
                value: label,
                borderColor: 'rgba(255, 255, 255, 1)',
                borderWidth: 1
            }
        })
        //https://www.chartjs.org/docs/latest/configuration/
        let configuration = getDefaultConfiguration();
        configuration.type = 'line';
        configuration.data.labels = labels;
        configuration.data.datasets[0].data = datapoints
        configuration.options.annotation.annotations = annotations;
        configuration.options.scales.xAxes[0] = {type: "scatterScale"};
        configuration.options.interaction = {mode: "point"};
        configuration.options.scales.yAxes[0].ticks.callback = (value) => {
            if (value % 1 == 0) {
                return '$' + value
            } else if (value < .01) {
                return '$' + value;
            }
            return '$' + value.toFixed(2);
        }

        let stream = createChartStream(configuration);
        let updown = "";
        if (stock_price.change > 0) updown = "▲";
        else if (stock_price.change < 0) updown = "▼";
        let rich = new Discord.RichEmbed();
        rich.setTitle(escapeMarkdownText(stock_price.companyName));
        rich.setDescription(`${stock_price.symbol} $${stock_price.latestPrice} (${updown}${Math.abs(stock_price.change)}%)`);
        rich.attachFiles([{ attachment: stream, name: `${stock_price.symbol}.png` }])
        rich.setImage(`attachment://${stock_price.symbol}.png`)
        return rich;
    }
}))

function playSound(channel, URL, options = {}) {
    return new Promise((resolve)=>{
        //stop the music
        if (channel.guild.voice != null && channel.guild.voice.connection !=null && channel.guild.voice.connection.dispatcher != null) {
            channel.guild.voice.connection.dispatcher.removeAllListeners('finish');
            channel.guild.voice.connection.dispatcher.end();
        }
        resolve();
    }).then(()=>{
        //join channel
        if (channel.guild.voice != null && channel.guild.voice.connection !=null && channel.guild.voice.connection.channel.equals(channel)) {
            return channel.guild.voice.connection;
        } else {
            return channel.join();    
        }
    }).then((connection)=>{
        //play music
        let setvolume = .3;
        let stream_options = {
            volume: setvolume,
            highWaterMark: 1
        }
        stream_options = {...stream_options, ...options}
        const dispatcher = connection.play(URL, stream_options)
        dispatcher.on('finish', ()=>{
            channel.leave()
        });
        return null;
        //dispatcher.on('end', (reason) => console.log(reason)).on('finish', channel.leave());
    }).catch((e)=>{
        throw e;
    })
}

async function playYoutube(url, channel) {
    //source from ytdl-core-discord
    try {
        let info = await ytdl.getInfo(url);
        let options = {
            highWaterMark: 1<<25
        }
        let format_list = info.formats.filter(f=>{
            return f.audioBitrate;
        }).sort((a,b)=>{
            function score(f) {
                let score = 0;
                if (f.codecs === "opus" && f.container === "webm") score +=1
                return score;
            }
            let score_a = score(a);
            let score_b = score(b);
            if (score_a != score_b) return score_b-score_a;
            else return b.audioBitrate - a.audioBitrate;
        })
        if (format_list.length > 0) {
            const itag = format_list[0].itag;
            if (!format_list[0].url) {
                throw new Error("Missing URL field");
            }
            options = {...options, filter: (f)=>{
                return f.itag == itag;
            }}
            let type;
            if (format_list[0].codecs === "opus" && format_list[0].container === "webm") type = "webm/opus"
            else type = "unknown";
            let stream = ytdl.downloadFromInfo(info, options);
            return [stream,{type}];
        }
        return null;
    } catch (e) {
        return null;
    }
}

async function ytFunc(message,args){
    let id;
    let searched = false;
    let data;
    let ytstream;
    try {
        id = ytdl.getVideoID(args[1])
        ytstream = await playYoutube(id);
        if (ytstream == null) throw e;
    } catch (e) {
        data = await rp({
            url: `https://www.googleapis.com/youtube/v3/search?part=snippet&key=${config.api.youtube}&fields=items(id/videoId,snippet/title)&type=video&maxResults=1&q=${encodeURIComponent(args[1])}`,
            json: true
        })
        if (e.response && e.response.body && e.response.body.error && e.response.body.error.errors[0] && e.response.body.error.errors[0].reason && e.response.body.error.errors[0].reason === "quotaExceeded") {
            return "`Search quota exceeded. Use a full YouTube URL or try searching again tomorrow.`";
        }
        if (data.items.length < 1) return `\`No videos found\``;
        id = data.items[0].id.videoId;
        searched = true;
        ytstream = await playYoutube(id);
    }
    if (ytstream !== null) {
        if (message.member.voice.channel) {
            return await playSound(message.member.voice.channel, ytstream[0], ytstream[1]);
        } else {
            if (searched) {
                return `**${escapeMarkdownText(unescape(data.items[0].snippet.title))}**\nhttps://youtu.be/${data.items[0].id.videoId}`;
            }
            return `\`Not in a voice channel\``;
        }
    }
    return `\`No videos found\``;
}

commands.push(new Command({
    name: "yt",
    regex: /^yt (.+)$/i,
    prefix: ".",
    testString: ".yt DN9YncMIr60",
    hidden: false,
    requirePrefix: true,
    log: true,
    typing: false,
    req: () => { return config.api.youtube; },
    points: 1,
    shortDesc: "plays audio from a YouTube link in a voice channel",
    longDesc: {
        title: `.yt __youtube link, id, or search term__`,
        description: `returns or plays audio from YouTube video to a voice channel`,
        fields: [{
            name: `__youtube link, id, or search term__`,
            value: `can be an entire YouTube URL, just the ID, or a string to search`
        },{
            name: `Examples`,
            value: `**.yt DN9YncMIr60** - plays <https:/\u200b/youtu.be/DN9YncMIr60> in a voice channel
**.yt <https:/\u200b/www.youtube.com/watch?v=DN9YncMIr60>** - same as above
**.yt Tokyo Daylight (Atlus Kozuka Remix)** - same as above or returns the video if not in a voice channel`
        }]
    },
    run: async (message, args) => {
        return ytFunc(message, args)
    }
}))

commands.push(new Command({
    name: "yts",
    regex: /^yts (.+)$/i,
    prefix: ".",
    testString: ".yts blood drain again",
    hidden: false,
    requirePrefix: true,
    req: () => { return config.api.youtube; },
    log: true,
    points: 1,
    typing: true,
    shortDesc: "searches YouTube videos",
    longDesc: `.yts (search_term)
returns list of YouTube videos based on the search term`,
    run: async (message, args) => {
        try {
            ytdl.getURLVideoID(args[1])
            return `\`.yts is for text search only. Use .yt for YouTube URLs.\``
        } catch (e) {
            
        }
        args[1] = encodeURIComponent(args[1]);
        var max = 6;
        let data = await rp({
            url: `https://www.googleapis.com/youtube/v3/search?part=snippet&key=${config.api.youtube}&type=video&maxResults=${max}&q=${args[1]}`,
            json: true
        })
        let rich = new Discord.RichEmbed();
        rich.setTitle("YouTube results");
        rich.setURL("https://www.youtube.com/results?search_query=" + args[1])
        let yt_list = data.items.map(item=>{
            return [`[${escapeMarkdownText(unescape(item.snippet.title))}](https://youtu.be/${item.id.videoId})`,async ()=>{
                const ytstream = await playYoutube(item.id.videoId);
                if (ytstream !== null) {
                    if (message.member.voice.channel) {
                        return await playSound(message.member.voice.channel, ytstream[0], ytstream[1]);
                    }
                    return `**${escapeMarkdownText(unescape(item.snippet.title))}**\nhttps://youtu.be/${item.id.videoId}`;
                }
            }]
        })
        rich.setDescription(createCustomNumCommand3(message, yt_list));
        return rich;
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
    typing: false,
    shortDesc: "returns a link and quote of a past message",
    longDesc: `.quote (message_id or previous_nth_message)
returns a link to and a quote of a past message
message_id - get the id by selecting "copy id" from the settings of the message
previous_nth_message - the number of messages to go back to reach the message you want to quote. 1 is the last message, 2 is the one before, etc`,
    run: async (message, args) => {
        if (parseInt(args[1]) < 200) {
            let num = parseInt(args[1]);
            return await message.channel.messages.fetch({
                limit: num + 1
            }).then(messages => {
                return [messages.array()[num].url, {
                    embed: richQuote(messages.array()[num])
                }]
            }).catch(e => {
                return "`Message not found.`";
            })
        } else {
            async function findQuote(channel, messageid) {
                return await channel.messages.fetch(messageid).then(message2 => {
                    return [message2.url, {
                        embed: richQuote(message2)
                    }]
                }).catch(e => {
                    return null;
                })
            }
            let quote = await findQuote(message.channel, args[1])
            if (!quote) {
                if (message.guild && message.guild.available) {
                    return await Promise.all(
                        message.guild.channels.cache.filter(channel => {
                            return channel.id !== message.channel.id && channel.type == "text"
                        }).map(channel => {
                            return findQuote(channel, args[1]).then(quotefound => {
                                if (quotefound) {
                                    return Promise.reject(quotefound);
                                }
                                return Promise.resolve();
                            })
                        })
                    ).then(e => {
                        return "`Message not found`";
                    }).catch(quotefound => {
                        return quotefound;
                    })
                }
                return "`Message not found`";
            }
            return quote;
        }
    }
}))

commands.push(new Command({
    name: "quotelink",
    regex: /^https:\/\/discord(?:app)?.com\/channels\/(\d{10,})\/(\d{10,})\/(\d{10,})$/,
    prefix: "",
    testString: "https://discordapp.com/channels/155411137339326464/532227798375333909/712016665222709259",
    hidden: true,
    requirePrefix: false,
    log: true,
    points: 1,
    typing: false,
    shortDesc: "returns a quote of a past message from a link",
    longDesc: `returns a quote of a past message from a link`,
    run: async (message, args) => {
        let serverid = args[1];
        let channelid = args[2];
        let msgid = args[3];
        if (message.channel.guild.available && message.channel.guild.id === serverid) {
            let channel = message.channel.guild.channels.resolve(channelid);
            if (channel) {
                try {
                    let thismsg = await channel.messages.fetch(msgid);
                    return richQuote(thismsg)
                } catch (e) {

                }
            }
        }
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
    typing: false,
    req: () => { return config.adminID },
    prerun: (message) => { return message.author.id === config.adminID },
    run: async (message, args) => {
        let output = eval(args[1]);
        if (output.length < 1) output = "`No output`"
        return output;
    }
}))

async function weather(location_name) {
    // TODO: dark sky api support ending 2023-03-31
    let body;
    try {
        body = await rp(`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location_name)}/next7days?unitGroup=us&key=${config.api.visualcrossing}&contentType=json&elements=datetime%2CdatetimeEpoch%2Cname%2Caddress%2CresolvedAddress%2Clatitude%2Clongitude%2Ctempmax%2Ctempmin%2Ctemp%2Cfeelslikemax%2Cfeelslikemin%2Cfeelslike%2Cconditions%2Cdescription%2Cicon`)
    } catch (e) {
        return "`Location not found`";
    }
    //let body = await rp(`http://autocomplete.wunderground.com/aq?query=${encodeURIComponent(location_name)}`)
    let data = JSON.parse(body);
    let locName = data.resolvedAddress;
    let lat = data.latitude;
    let lon = data.longitude;
    body = await rp(`https://api.darksky.net/forecast/${config.api.darksky}/${lat},${lon}?units=auto&exclude=minutely`)
    data = JSON.parse(body);
    let tM;
    (data.flags.units == "us") ? tM = "°F" : tM = "°C";
    let iconNames = ["clear-day", "clear-night", "rain", "snow", "sleet", "wind", "fog", "cloudy", "partly-cloudy-day", "partly-cloudy-night"];
    let iconEmote = [":sunny:", ":crescent_moon:", ":cloud_rain:", ":cloud_snow:", ":cloud_snow:", ":wind_blowing_face:", ":fog:", ":cloud:", ":partly_sunny:", ":cloud:"];
    let rich = new Discord.RichEmbed();
    rich.setTitle("Powered by Dark Sky");
    let summary = data.daily.summary
    if (data.alerts) {
        let alertstring = data.alerts.map((alert) => {
            return `[**ALERT**](${alert.uri}): ${alert.description}`
        }).join("\n")
        summary = summary + "\n\n" + alertstring;
    }
    rich.setDescription(summary.slice(0, 2048));
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
        if (i < data.daily.data.length - 1) dayDesc += `\n${wordWrap(data.daily.data[i].summary, 33)}`;
        else dayDesc += `\n${data.daily.data[i].summary}`;
        rich.addField(`${dayIcon}${dayName}`, dayDesc, true)
    }

    let hourdata = data.hourly.data;

    let temp_datapoints = hourdata.map(hour => {
        return hour.temperature;
    })

    let apparent_temp_datapoints = hourdata.map(hour => {
        return hour.apparentTemperature;
    })

    let labels = hourdata.map(hour => {
        let thisMoment = moment.tz(hour.time * 1000, data.timezone);
        if (thisMoment.minute() === 0 && parseInt(thisMoment.hour()) % 6 == 0) {
            if (thisMoment.hour() != 0) {
                return thisMoment.format("ha");
            } else {
                return thisMoment.format("ddd");
            }
        }
        return "";
    })

    //https://www.chartjs.org/docs/latest/configuration/
    const configuration = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: "Temp",
                data: temp_datapoints,
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                pointRadius: 0
            }, {
                label: "Apparent Temp",
                data: apparent_temp_datapoints,
                borderColor: 'rgba(99, 132, 255, 1)',
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            legend: {
                display: true
            },
            scales: {
                yAxes: [{
                    ticks: {
                        callback: (value) => value + tM
                    }
                }]
            }
        }
    };

    let stream = createChartStream(configuration);
    rich.attachFiles([{ attachment: stream, name: `chart.png` }])
    rich.setImage(`attachment://chart.png`)
    return rich;
}

commands.push(new Command({
    name: "weather",
    regex: /^wea(?:ther)? (\S.*)$/i,
    prefix: ".",
    testString: ".weather nyc",
    hidden: false,
    requirePrefix: true,
    req: () => { return config.api.visualcrossing; },
    log: true,
    points: 1,
    shortDesc: "returns 8 day forecast and chart of the temp for the next 2 days",
    longDesc: `.weather (location)
returns the 8 day forecast and a chart of the temperature for the next 2 days
location - can be several things like the name of a city or a zip code`,
    run: async (message, args) => {
        return await weather(args[1]);
    }
}))

let covid_countries = [];
let covid_states = [];
/*
rp({
    url: "https://covidtracking.com/api/v1/states/info.json",
    json: true
}).then(json => {
    covid_states = json.map(state=>{
        return {
            initial: state.state,
            name: state.name
        }
    })
})

rp({
    url: "https://corona.lmao.ninja/v2/countries",
    json: true
}).then(json => {
    covid_countries = json.map(country=>{
        return {
            initial: [country.countryInfo.iso2,country.countryInfo.iso3],
            name: country.country
        }
    })
})
*/

let covid_provinces = {"Alberta":"AB",
    "British Columbia":"BC",
    "Manitoba":"MB",
    "New Brunswick":"NB",
    "Newfoundland and Labrador":"NL",
    "Northwest Territories":"NT",
    "Nova Scotia":"NS",
    "Nunavut":"NU",
    "Ontario":"ON",
    "Prince Edward Island":"PE",
    "Quebec":"QC",
    "Saskatchewan":"SK",
    "Yukon":"YT",
    "Repatriated Travellers":"RT"};

commands.push(new Command({
    name: "covid",
    regex: /^(?:corona|covid|corona) (.+)$/i,
    prefix: ".",
    testString: "",
    hidden: false,
    requirePrefix: true,
    shortDesc: "returns covid stats for country or state",
    longDesc: {title:`.covid __place__`,
        description: `returns covid-19 counts for area`,
        fields: [{
            name: `place`,
            value: `"all" or country name or state initial/name`
        }]
    },
    log: true,
    points: 1,
    run: async (message, args) =>{
        function parseNovelCOVID(current, history) {
            let active_cases = [];
            let dates = Object.keys(history.cases)
            let date_text = [];
            
            let infected = false;
            for (let i=1;i<dates.length;i++) {
                if (!infected && history.cases[dates[i+1]] > 0) infected = true;
                if (infected) {
                    active_cases.push(Math.max(history.cases[dates[i]]-history.cases[dates[i-1]],0))
                    date_text.push(dates[i])
                }
            }
            /*
            dates.forEach(date=>{
                active_cases.push(history.cases[date]-history.deaths[date]-history.recovered[date])
                date_text.push(date)
            })*/

            let step = parseInt(dates.length / 5);
        
            let labels = date_text.map((date,index) => {
                if (index == date_text.length-1) return moment(date, "M/D/YYYY").format("MMM D");
                if (index > date_text.length-step/2) return "";
                if (index % step == 0) return moment(date, "M/D/YYYY").format("MMM D");
                return "";
            })
        
            const configuration = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: "New cases",
                        data: active_cases,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        pointRadius: 0
                    }]
                },
                options: {
                    legend: {
                        display: true
                    }
                }
            };
        
            let stream = createChartStream(configuration);
            let desc_lines = []
            desc_lines.push(`Total cases: ${current.cases}`)
            desc_lines.push(`Total active: ${current.active}`)
            desc_lines.push(`Total recovered: ${current.recovered}`)
            desc_lines.push(`Total deaths: ${current.deaths}`)
            desc_lines.push(`Yesterday new cases: ${active_cases[active_cases.length-1]}`)
            desc_lines.push(`Yesterday deaths: ${history.deaths[dates[dates.length-1]]-history.deaths[dates[dates.length-2]]}`)
            let rich = new Discord.RichEmbed()
            rich.setDescription(desc_lines.join("\n"));
            rich.setTitle("World")
            rich.attachFiles([{ attachment: stream, name: `chart.png` }])
            rich.setImage(`attachment://chart.png`)
            return rich;
        }
        if (args[1].toLowerCase() === "all" || args[1].toLowerCase() === "world") {
            let current_prom = rp({
                url: "https://corona.lmao.ninja/v2/all",
                json: true
            })
            let history = await rp({
                url: "https://corona.lmao.ninja/v2/historical/all?lastdays=all",
                json: true
            })
            let current = await current_prom;
            let rich = parseNovelCOVID(current,history);
            rich.setTitle("World");
            return rich;
        }
        //prioritize state over country
        let state = covid_states.find(state=>{
            if (state.name.toLowerCase() === args[1].toLowerCase()) return true;
            if (state.initial.toLowerCase() === args[1].toLowerCase()) return true;
            return false;
        })
        if (state !== undefined) {
            let current_prom = rp({
                url: `https://covidtracking.com/api/v1/states/${state.initial.toLowerCase()}/current.json`,
                json:true
            })
            let history = await rp({
                url: `https://covidtracking.com/api/v1/states/${state.initial.toLowerCase()}/daily.json`,
                json:true
            })
            let current = await current_prom;
            let active_cases = [];
            history.sort((a,b)=>{
                return a.date - b.date;
            })
            
            let infected = false;
            let dates = [];
            for (let i=1;i<history.length;i++) {
                if (!infected && history[i+1].positiveIncrease > 0) infected = true;
                if (infected) {
                    active_cases.push(history[i].positiveIncrease)
                    dates.push(history[i].date)
                }
            }

            let step = parseInt((dates.length-1) / 5);

            let labels = dates.map((date,index) => {
                if (index == dates.length-1) return moment(date, "YYYYMMDD").format("MMM D");
                if (index > dates.length-step/2) return "";
                if (index % step == 0) return moment(date, "YYYYMMDD").format("MMM D");
                return "";
            })
            const configuration = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: "New cases",
                        data: active_cases,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        pointRadius: 0
                    }]
                },
                options: {
                    legend: {
                        display: true
                    }
                }
            };
        
            let stream = createChartStream(configuration);
            let desc_lines = []
            desc_lines.push(`Total cases: ${current.positive}`)
            desc_lines.push(`Total active: ${current.positive-current.recovered-current.death}`)
            if (current.recovered !=null) desc_lines.push(`Total recovered: ${current.recovered}`)
            if (current.death !=null) desc_lines.push(`Total deaths: ${current.death}`)
            desc_lines.push(`Yesterday new cases: ${history[history.length-1].positiveIncrease}`)
            desc_lines.push(`Yesterday deaths: ${history[history.length-1].deathIncrease}`)
            let rich = new Discord.RichEmbed()
            rich.setDescription(desc_lines.join("\n"));
            rich.setTitle(state.name)
            rich.attachFiles([{ attachment: stream, name: `chart.png` }])
            rich.setImage(`attachment://chart.png`)
            rich.setTitle(`${state.name}, US`);
            return rich;
        }
        let country = covid_countries.find(country=>{
            if (country.name.toLowerCase() === args[1].toLowerCase()) return true;
            if (country.initial[0] && country.initial[0].toLowerCase() === args[1].toLowerCase()) return true;
            if (country.initial[1] && country.initial[1].toLowerCase() === args[1].toLowerCase()) return true;
            return false;
        })
        if (country !== undefined) {
            let current_prom = rp({
                url: `https://corona.lmao.ninja/v2/countries/${country.initial[0]}`,
                json:true
            })
            let history = await rp({
                url: `https://corona.lmao.ninja/v2/historical/${country.initial[0]}?lastdays=all`,
                json:true
            })
            let current = await current_prom;
            let rich = parseNovelCOVID(current,history.timeline);
            rich.setTitle(country.name);
            return rich;
        }
        let province = Object.keys(covid_provinces).find(country=>{
            if (country.toLowerCase() === args[1].toLowerCase()) return true;
            if (covid_provinces[country] && covid_provinces[country].toLowerCase() === args[1].toLowerCase()) return true;
            return false;
        })
        if (province !== undefined) {
            let current_prom = rp({
                url: `https://api.opencovid.ca/summary?loc=${covid_provinces[province]}`,
                json:true
            })
            let history = await rp({
                url: `https://api.opencovid.ca/timeseries?stat=cases&loc=${covid_provinces[province]}`,
                json:true
            })
            let active_cases = [];
            let dates = [];
            history.cases.forEach(datecase=>{
                active_cases.push(datecase.cases);
                dates.push(datecase.date_report)
            })

            let step = parseInt((dates.length-1) / 5);

            let labels = dates.map((date,index) => {
                if (index == dates.length-1) return moment(date, "DD-MM-YYYY").format("MMM D");
                if (index > dates.length-step/2) return "";
                if (index % step == 0) return moment(date, "DD-MM-YYYY").format("MMM D");
                return "";
            })
        
            const configuration = {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: "New cases",
                        data: active_cases,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        pointRadius: 0
                    }]
                },
                options: {
                    legend: {
                        display: true
                    }
                }
            };
            let current = await current_prom;
            let stream = createChartStream(configuration);
            let desc_lines = []
            desc_lines.push(`Total cases: ${parseInt(current.summary[0].cumulative_cases)}`)
            desc_lines.push(`Active cases: ${parseInt(current.summary[0].active_cases)}`)
            if (current.recovered !=null) desc_lines.push(`Total recovered: ${parseInt(current.summary[0].cumalative_recovered)}`)
            if (current.death !=null) desc_lines.push(`Total deaths: ${parseInt(current.summary[0].cumalative_deaths)}`)
            desc_lines.push(`Yesterday new cases: ${parseInt(current.summary[0].cases)}`)
            desc_lines.push(`Yesterday deaths: ${parseInt(current.summary[0].deaths)}`)
            let rich = new Discord.RichEmbed()
            rich.setDescription(desc_lines.join("\n"));
            rich.setTitle(`${province}, Canada`)
            rich.attachFiles([{ attachment: stream, name: `chart.png` }])
            rich.setImage(`attachment://chart.png`)
            return rich;
        }
        return `\`Place not found\``;
    },
    typing: true,
}))

let poe_stats = {};
rp({
    url: "https://www.pathofexile.com/api/trade/data/stats",
    json: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
    }
}).then(json => {
    poe_stats = json;
})

let poe_leagues = [];
rp({
    url: "https://www.pathofexile.com/api/trade/data/leagues",
    json: true,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
    }
}).then(json => {
    poe_leagues = json.result.map(leag => {
        return leag.id
    });
})

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
returns poe.trade based on item name or stats
can paste item text after copying it from poe. add x at the end of the item text to ignore stats. add f at the end of the item text to search by formose score`,
    func: async (message, args) => {
        return await poesearch(message, args);
    }
}))

async function poesearch(message, args) {
    function getModID(str, label) {
        let list = poe_stats.result.find(list => {
            return list.label === label
        })
        if (!list) return [];
        let mods = list.entries.filter(mod => {
            let compare_str = mod.text.replace(/-?\d+/g, "#").replace(/\+/g, "").replace(/ \(Local\)/g, "");
            return compare_str === str.replace(/-?\d+/g, "#").replace(/\+/g, "");
        })
        if (mods.length < 0) {
            return [];
        } else {
            return mods.map(mod => {
                let arr = mod.text.match(/-?\d+|#/g);
                if (arr) {
                    let is_num = arr.map(s => {
                        if (s == "#") return true;
                        return false
                    })
                    let sum = 0;
                    let count = 0;
                    str.match(/-?\d+|#/g).forEach((s, i) => {
                        if (is_num[i]) {
                            sum += parseInt(s);
                            count++;
                        }
                    })
                    return [mod.id, mod.text, sum / count];
                }
                return [mods[0].id, mods[0].text, null];
            })
        }
    }
    let stmt = sql.prepare("SELECT poeleague FROM users WHERE user_id = ?;")
    let poeleague = stmt.get(message.author.id).poeleague

    if (poe_leagues.indexOf(poeleague) < 0) {
        return setLeague("Update your league", message, async () => {
            let itemsearch = await poesearch(message, args);
            return itemsearch;
        });
    }

    let body = {
        "query": {
            "status": { "option": "online" },
            "term": args[1],
            "stats": [
                { "type": "and", "filters": [] }
            ]
        },
        "sort": { "price": "asc" }
    }
    let rich = new Discord.RichEmbed();
    let desc_list = []
    if (args[1].split("\n").length > 2) {
        let group = args[1].split("\n--------\n");
        group = group.map((e) => {
            return e.split("\n")
        })
        if (group[0][0] === "Rarity: Unique") {
            body.query.term = group[0][group[0].length - 2] + " " + group[0][group[0].length - 1]
            body.query.filters = {
                type_filters: {
                    filters: {
                        rarity: {
                            option: "unique"
                        }
                    }
                }
            }
            desc_list.push(`**Name: ${group[0][group[0].length - 2]} ${group[0][group[0].length - 1]}**`);
            desc_list.push(`**Rarity: Unique**`);
        } else if (group[0][group[0].length - 1] === "Stygian Vise") {
            desc_list.push(`**Name: Stygian Vise**`);
            body.query.term = group[0][group[0].length - 1];
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
            body.query.type = getBase(name);
            desc_list.push(`**Type: ${body.query.type}**`);
        }
        else {
            body.query.term = group[0][group[0].length - 1];
            desc_list.push(`**Name: ${body.query.term}**`);
        }

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
                    let totalresist = 0;
                    let totalhealth = 0;
                    let chaosresist = 0;
                    function addToFilter(type, found) {
                        if (found.length == 1) {
                            let modobj = {
                                id: found[0][0]
                            }
                            let line = `${type} ${found[0][1]}`;
                            if (found[0][2]) {
                                modobj.value = {
                                    min: found[0][2]
                                }
                                line += ` (min: ${found[0][2]})`;
                            }
                            body.query.stats[0].filters.push(modobj)
                            desc_list.push(line);
                        } else if (found.length > 1) {
                            desc_list.push(`Either`);
                            let filters = found.map(mod => {
                                let modobj = {
                                    id: mod[0]
                                }
                                let line = `• ${type} ${mod[1]}`;
                                if (mod[2]) {
                                    modobj.value = {
                                        min: mod[2]
                                    }
                                    line += ` (min: ${mod[2]})`;
                                }
                                desc_list.push(line);
                                return modobj
                            })
                            body.query.stats.push({
                                filters,
                                type: "count",
                                value: {
                                    min: 1
                                }
                            })
                        }
                    }

                    if (group[itemlevel].length === 1) {
                        let e = group[itemlevel][0];
                        let b;
                        if (b = /^([+-]?\d+)% to (Fire|Cold|Lightning) Resistance/.exec(e)) {
                            totalresist += parseInt(b[1]);
                        }
                        else if (b = /^([+-]?\d+)% to (Fire|Cold|Lightning) and (Fire|Cold|Lightning) Resistances/.exec(e)) {
                            totalresist += parseInt(b[1]) * 2;
                        }
                        else if (b = /^([+-]?\d+)% to all Elemental Resistances/.exec(e)) {
                            totalresist += parseInt(b[1]) * 3;
                        }
                        else if (b = /^([+-]?\d+) to maximum Life/.exec(e)) {
                            totalhealth += parseInt(b[1]);
                        }
                        else {
                            if (!formose && (b = /^(.*) \(implicit\)$/.exec(e))) {
                                let found = getModID(b[1], "Implicit");
                                addToFilter("(implicit) ", found)
                            }
                        }
                        itemlevel++;
                    }
                    if (itemlevel < group.length) {
                        group[itemlevel].forEach((e) => {
                            let b;
                            //+?123%? anything
                            if (b = /^([+-]?\d+)% to (Fire|Cold|Lightning) Resistance$/.exec(e)) {
                                totalresist += parseInt(b[1]);
                            }
                            else if (b = /^([+-]?\d+)% to (Fire|Cold|Lightning) and (Fire|Cold|Lightning) Resistances/.exec(e)) {
                                totalresist += parseInt(b[1]) * 2;
                            }
                            else if (b = /^([+-]?\d+)% to all Elemental Resistances/.exec(e)) {
                                totalresist += parseInt(b[1]) * 3;
                            }
                            else if (b = /^([+-]?\d+)% to Chaos Resistance/.exec(e)) {
                                chaosresist += parseInt(b[1]);
                            }
                            else if (b = /^([+-]?\d+) to maximum Life/.exec(e)) {
                                totalhealth += parseInt(b[1]);
                            }
                            else {
                                if (!formose) {
                                    let found = getModID(e, "Explicit");
                                    addToFilter("", found)
                                }
                            }
                        })
                    }

                    if (formose) {
                        if (totalresist + totalhealth > 0) {
                            body.query.stats.push({
                                filters: [{
                                    id: "pseudo.pseudo_total_resistance"
                                }, {
                                    id: "pseudo.pseudo_total_life"
                                }],
                                type: "weight",
                                value: {
                                    min: totalresist + totalhealth + chaosresist
                                }
                            })
                            desc_list.push(`(pseudo) +#% total Resistance`);
                            desc_list.push(`(pseudo) +# total maximum Life`);
                            desc_list.push(`Group total (min: ${totalresist + totalhealth + chaosresist})`);
                        }
                    }
                    else {
                        if (totalresist != 0) {
                            body.query.stats[0].filters.push({
                                id: "pseudo.pseudo_total_elemental_resistance",
                                value: {
                                    min: totalresist
                                }
                            })
                            desc_list.push(`(pseudo) +#% total Elemental Resistance (min: ${totalresist})`);
                        }
                        if (totalhealth != 0) {
                            body.query.stats[0].filters.push({
                                id: "pseudo.pseudo_total_life",
                                value: {
                                    min: totalhealth
                                }
                            })
                            desc_list.push(`(pseudo) (total) +# to maximum Life (min: ${totalhealth})`);
                        }
                    }
                }
            }
        }
    } else {
        desc_list.push(`**Name: ${args[1]}**`);
    }
    rich.setDescription(desc_list.join("\n"));

    let data;
    try {
        data = await rp({
            method: "POST",
            url: `https://www.pathofexile.com/api/trade/search/${encodeURIComponent(poeleague)}`,
            body: body,
            json: true,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
            }
        })
    } catch(e){
        try {
            if (e.error.error.code == 2) {
                if (!(await checkLeague(poeleague))) {
                    return setLeague("Update your league", message, async () => {
                        let itemsearch = await poesearch(message, args);
                        return itemsearch;
                    });
                } else {
                    return "`No results`"
                }
            }
        } catch (e2) {
            throw e;
        }
    }
    rich.setURL(`https://www.pathofexile.com/trade/search/${encodeURIComponent(poeleague)}/${data.id}`);
    rich.setTitle("Results - " + poeleague);
    rich.setFooter('Type "setpoeleague" to change your PoE league')

    if (data.total < 1) {
        rich.setDescription(desc_list.join("\n") + "\n\n**No results found**")
        return rich;
    }

    let hashstring = data.result.slice(0, 6).join(",");
    data = await rp({
        url: `https://www.pathofexile.com/api/trade/fetch/${hashstring}`,
        json: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
        }
    });
    data.result.forEach(ele => {
        let time = moment(ele.listing.indexed).fromNow();
        let status = "offline"
        if (ele.listing.account.online) {
            if (ele.listing.account.online.status) {
                status = ele.listing.account.online.status
            } else {
                status = "online"
            }
        } else {
            status = "offline";
        }
        let desc = `${time}\n${status}`
        if (ele.listing.price) {
            desc = `${ele.listing.price.amount} ${ele.listing.price.currency}\n${desc}`
        }
        rich.addField(escapeMarkdownText(`${ele.item.name} ${ele.item.typeLine}`), escapeMarkdownText(desc), true);
    })
    return rich;
}

commands.push(new Command({
    name: "pt2",
    regex: /^pt2 ([^\r]+?)([ \n]?offline)?(?: ([\d]{1,2}))?$/i,
    prefix: ".",
    testString: ".pt2 tabula rasa",
    hidden: true,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "returns poe.trade based on item name or stats",
    longDesc: `.pt2 (item)
returns poe.trade based on item name or stats`,
    func: async (message, args) => {
        return await poesearch2(message, args);
    }
}))

async function poesearch2(message, args) {
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
        poelinkid = await rp({
            method: 'POST',
            url: "https://poe.trade/search",
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
        }).catch(e => {
            return e.response;
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

        poelinkid = await rp({
            method: 'POST',
            url: "https://poe.trade/search",
            followRedirect: false,
            //proxy:'http://localhost:8888',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formstring
        }).catch(e => {
            return e.response;
        });
    }
    let link = poelinkid.headers.location;
    let body;
    try {
        body = await rp({
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
        return setLeague2("Update your league", message, async () => {
            let itemsearch = await poesearch(message, args);
            return itemsearch;
        });
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
        rich.addField(escapeMarkdownText(title), escapeMarkdownText(desc), true);
    })
    return [link, {
        embed: rich
    }];
}

async function checkLeague(leagueid){
    let data;
    try {
        data = await rp({
            url: "https://www.pathofexile.com/api/trade/data/leagues",
            json: true,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
            }
        });
    } catch (e) {
        throw e;
    }
    poe_leagues = data.result.map(leag => {
        return leag.id;
    });
    if (poe_leagues.indexOf(leagueid) < 0) {
        return false;
    }
    return true;
}

async function setLeague(top, message, callback) {
    /*
    let data;
    try {
        data = await rp({
            url: "https://www.pathofexile.com/api/trade/data/leagues",
            json: true
        });
    } catch (e) {
        return ["`Error loading PoE API`"]
    }
    poe_leagues = data.result.map(leag => {
        return leag.id
    });*/
    let leaguelist = poe_leagues.map(leagueid => {
        return [leagueid, async (thismess) => {
            if (thismess.author.id !== message.author.id) return "";
            let stmt = sql.prepare("INSERT INTO users(user_id,poeleague) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET poeleague=excluded.poeleague;")
            stmt.run(message.author.id, leagueid)
            return await callback();
        }]
    })

    let rich = new Discord.RichEmbed()
        .setTitle(top)
        .setDescription(createCustomNumCommand3(message, leaguelist))
    return rich;
}

async function setLeague2(top, message, callback) {
    let body;
    try {
        body = await rp("http://api.pathofexile.com/leagues?type=main&compact=0");
    } catch (e) {
        return ["`Error loading PoE API`"]
    }
    let data = JSON.parse(body);
    let leaguelist = data.filter((leag) => {
        return leag.rules.every((rule) => {
            return rule.id !== "NoParties";
        })
    }).map(leag => {
        return [leag.id, async (thismess) => {
            if (thismess.author.id !== message.author.id) return "";
            let stmt = sql.prepare("INSERT INTO users(user_id,poeleague) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET poeleague=excluded.poeleague;")
            stmt.run(message.author.id, leag.id)
            return await callback();
        }]
    })

    let rich = new Discord.RichEmbed()
        .setTitle(top)
        .setDescription(createCustomNumCommand3(message, leaguelist))
    return rich;
}

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
    run: async (message, args) => {
        let body;
        try {
            body = await rp("http://api.pathofexile.com/leagues?type=main&compact=0");
        } catch (e) {
            return ["`Error loading PoE API`"]
        }
        let data = JSON.parse(body);
        let leaguelist = [];
        data.forEach((leag) => {
            let istradeleague = leag.rules.every((rule) => {
                return rule.id !== "NoParties";
            })
            if (istradeleague) leaguelist.push([leag.id, (thismess) => {
                if (thismess.author.id !== message.author.id) return false;
                (async () => {
                    let stmt = sql.prepare("INSERT INTO users(user_id,poeleague) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET poeleague=excluded.poeleague;")
                    stmt.run(message.author.id, leag.id)
                    thismess.channel.send(`\`PoE league set to ${leag.id}\``).catch(e => {
                        if (e.code == 50035) {
                            message.channel.send("`Message too large`").catch(err);
                        } else {
                            err(e);
                            message.channel.send("`Error`").catch(err);
                        }
                    });
                })().catch(e => {
                    err(e);
                    message.channel.send("`Error`").catch(err);
                })
                return true;
            }]);
        })

        let msg = createCustomNumCommand(message, leaguelist);
        return msg;
    }
}))

commands.push(new Command({
    name: "poe",
    regex: /^poe (.+)$/i,
    prefix: ".",
    testString: "",
    hidden: false,
    requirePrefix: true,
    shortDesc: "search Path of Exile wiki",
    longDesc: {
        title: `.poe (search)`,
        description: `search poe wiki`,
        fields: []
    },
    log: true,
    points: 1,
    run: async (message, args) => {
        //https://pathofexile.gamepedia.com/api.php
        //https://github.com/ha107642/RedditPoEBot/blob/master/redditbot.py
        async function createItemRich(item_name, url) {
            let response = await rp(`https://pathofexile.gamepedia.com/api.php?action=cargoquery&tables=items&fields=items.html,items.name&where=items.name=${encodeURIComponent(`"${item_name}"`)}&format=json`)
            response = JSON.parse(response);
            if (response.cargoquery.length > 0) {
                let html = unescape(response.cargoquery[0].title.html)

                //<span class=group>
                html = html.replace(/<span [^>]*?class="group.+?>/g, "\n\n")
                    //<br>
                    .replace(/<br>/g, "\n")
                    //&ndash;
                    .replace(/&ndash;/g, "-")
                    //<div>
                    .replace(/<(\w+?).+?>/g, "")
                    //</div>
                    .replace(/<\/(\w+?)>/g, "")
                    //[[File:asdf.png]]
                    .replace(/\[\[File:(.+)\]\]/g, "")
                    //[[:asdf:asdf|asdf]]
                    .replace(/\[\[:\w+:.+?\|(.+?)\]\]/g, "$1")
                    //[[asdf|asdf]]
                    .replace(/\[\[[^\]\r\n]+?\|(.+?)\]\]/g, "$1")
                    //[[asdf]]
                    .replace(/\[\[([^\]\r\n]+?)\]\]/g, "$1")

                let lines = html.split("\n");
                while (lines[0] === "" || lines[0] === item_name) {
                    lines.shift();
                }
                let rich = new Discord.RichEmbed()
                    .setTitle(escapeMarkdownText(item_name))
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
        let items = response[1].map((item_name, index) => {
            return { name: item_name, url: response[3][index] }
        })
        let list = items.map((item) => {
            return [item.name, async () => { return createItemRich(item.name, item.url) }];
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
    run: async (message, args) => {
        let num = parseInt(args[2]) || 0;
        let data = JSON.parse(await rp(`http://api.urbandictionary.com/v0/define?term=${encodeURIComponent(args[1])}`));
        if (data.list[num]) {
            let rich = new Discord.RichEmbed();
            rich.setTitle(escapeMarkdownText(data.list[num].word));
            let desc = escapeMarkdownText(data.list[num].definition.replace(/[\[\]]/g, ""));
            if (data.list[num].example) {
                desc += "\n\n*" + escapeMarkdownText(data.list[num].example.replace(/[\[\]]/g, "")) + "*";
            }
            rich.setDescription(desc.slice(0,2048));
            return rich;
        }
        return "`No results found`";
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
    typing: false,
    shortDesc: "rolls dice",
    longDesc: {
        title: `.roll [(num_dice)d](max_num)[+(add)]`,
        description: `rolls dice between 1 and max_num`,
        fields: [{
            name: `num_dice`,
            value: `number of dice to roll`
        }, {
            name: `max`,
            value: `the max roll`
        }, {
            name: `add`,
            value: `number to add at the end`
        }, {
            name: `Examples`,
            value: `**.roll 6** - rolls a die between 1 to 6 inclusive
**.roll d6** - same as .roll d6
**.roll 10d6** - rolls 10 6-sided dice and adds them together
**.roll 10d6+10** - rolls 10 6-sided dice and then adds 10 to the total`
        }]
    },
    run: async (message, args) => {
        let num_dice = parseInt(args[1]) || 1;
        let max = parseInt(args[2]);
        let add = parseInt(args[3]) || 0;
        if (max < 1) return ["`Dice side must be > 0`"];
        if (num_dice < 1) return ["`Number of dice must be > 0`"];
        if (num_dice > 300) return ["`Number of dice must be <= 300`"];
        let rolls = [];
        for (let n = 0; n < num_dice; n++) {
            rolls.push(Math.floor(Math.random() * max) + 1);
        }
        if (rolls.length === 1 && add === 0) return [`\`${rolls[0]}\``];
        let msg = "`(" + rolls.join(" + ") + ")";
        let total = rolls.reduce((acc, cur) => acc + cur, 0);
        if (add !== 0) {
            total += add;
            if (add > 0) msg += "+" + add;
            else msg += add;
        }
        msg += "`= " + total;
        return msg;
    }
}))

let rss = new RSSManager(bot, sql, config.errorChannelID);
//add typing when using .rss add/test/list
commands.push(new Command({
    name: "rss",
    regex: /^rss (\w+)(?: (.+))?$/i,
    prefix: ".",
    testString: ".rss add https://en-forum.guildwars2.com/categories/game-release-notes/feed.rss",
    hidden: false,
    requirePrefix: true,
    log: true,
    typing: false,
    points: 1,
    shortDesc: "returns posted feeds",
    longDesc: {
        title: `.rss (action) (args)`,
        description: `Subscribing to a feed will allow me to automatically post when updates occur`,
        fields: [{
            name: `rss add (rss_link or any type of steam_page_url)`,
            value: `Subscribes to an RSS feed
**Examples**
__.rss add [https]()://steamcommunity.com/games/389730/__ - subscribes to Tekken 7 steam news
__.rss add [http]()://rss.cnn.com/rss/cnn_topstories.rss__ - subscribes CNN top stories (enjoy the spam)`
        }, {
            name: `rss subs`,
            value: `Lists all subscriptions`
        }, {
            name: `rss news`,
            value: `Lists all recent news from subscriptions`
        }, {
            name: `rss remove (num)`,
            value: `Remove a subscription from this channel. Get the number from ".rss subs"`
        }]
    },
    func: async (message, args) => {
        if (args[1].toLowerCase() === "add") {
            return await rss.add(message, args[2]);
        } else if (args[1].toLowerCase() === "subs" || args[1].toLowerCase() === "list") {
            return await rss.subs(message);
        } else if (args[1].toLowerCase() === "news") {
            return await rss.list(message);
        } else if (args[1].toLowerCase() === "remove" || args[1].toLowerCase() === "rem") {
            return await rss.remove(message, args[2]);
        } else if (args[1].toLowerCase() === "test") {
            return await rss.test(message);
        } else {
            return ["`unknown action`"];
        }
    }
}))

let egs = new EpicStore(bot, sql, config.errorChannelID);
commands.push(new Command({
    name: "egs",
    regex: /^egs (\w+)(?: (.+))?$/i,
    prefix: ".",
    testString: ".egs list",
    hidden: false,
    requirePrefix: true,
    log: true,
    typing: false,
    points: 1,
    shortDesc: "returns list of current free epic game store games",
    longDesc: {
        title: `.egs (action) (args)`,
        description: `returns free epic game store games list or alerts`,
        fields: [{
            name: `.egs on`,
            value: `turns on reminder of new egs games`
        }, {
            name: `.egs off`,
            value: `turns off reminder`
        }, {
            name: `.egs list`,
            value: `returns the current list of free games`
        }]
    },
    func: async (message, args) => {
        if (args[1].toLowerCase() === "on") {
            return await egs.on(message.channel.id);
        } else if (args[1].toLowerCase() === "off") {
            return await egs.off(message.channel.id);
        } else if (args[1].toLowerCase() === "list") {
            return await egs.list();
        } else {
            return ["`unknown action`"];
        }
    }
}))

commands.push(new Command({
    name: "cog",
    regex: /^cog(?: (.+))?$/i,
    prefix: ".",
    testString: ".cog \uD83D\uDE10",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "turns image into a spinning cogwheel",
    longDesc: `.cog (imageurl) or .cog (emoji) or .cog while attaching an image
returns a gif of the image in a spinning cogwheel`,
    run: async (message, args) => {
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
        };
        async function getImage(s) {
            //if (args[1].includes('%')) args[1] = decodeURIComponent(args[1]);
            const emoji_match = args[1].match(/<?(a)?:?(\w{2,32}):(\d{17,19})>?/);
            if (emoji_match) {
                let emoji_object = { animated: Boolean(emoji_match[1]), name: emoji_match[2], id: emoji_match[3] };
                if (emoji_object.animated) return { error: '`Cannot be an animated emoji`' };
                let emoji = new Discord.Emoji(bot, emoji_object);
                return { image: await loadImage(emoji.url) };
            }
            if (message.attachments.size > 0) {
                return { image: await loadImage(message.attachments.first().url) };
            }
            if (args[1].length < 7) {
                let url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/11.3.0/2/72x72/${toCodePoint(args[1])}.png`
                let head = await rp.head(url);
                let validmime = ["image/png", "image/jpeg", "image/bmp", "image/gif"]
                if (validmime.indexOf(head['content-type']) > -1) {
                    return { image: await loadImage(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/11.3.0/2/72x72/${toCodePoint(args[1])}.png`) };
                }
            }
            try {
                let url = new URL(args[1]);
                let head = await rp.head(args[1]);
                let validmime = ["image/png", "image/jpeg", "image/bmp", "image/gif"]
                if (validmime.indexOf(head['content-type']) > -1) {
                    return { image: await loadImage(args[1]) };
                }
            } catch (e) {
            }
            return { error: "`Must be a non-animated emoji, URL, or contain an uploaded image`" };
        };
        let image_obj = await getImage(args[1]);
        if (image_obj.error) return image_obj.error;
        let image = image_obj.image;

        let size = 320
        let transparentcolor = "#fffffc"
        let cogcolor = "#b0c4de"
        const encoder = new GIFEncoder(size, size);
        let stream = encoder.createReadStream()
        encoder.start();
        encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
        encoder.setDelay(1000 / 60 * 2);  // frame delay in ms
        encoder.setQuality(10); // image quality. 10 is default.
        encoder.setTransparent(transparentcolor); //
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = transparentcolor;

        function cog(ctx) {
            ctx.globalCompositeOperation = 'destination-in';
            let cx = 320 / 2,                    // center x
                cy = 320 / 2,                    // center y
                notches = 8,                      // num. of notches
                radiusO = 160,                    // outer radius
                radiusI = 120,                    // inner radius
                taperO = 50,                     // outer taper %
                taperI = 35,                     // inner taper %
                // pre-calculate values for loop
                pi2 = 2 * Math.PI,            // cache 2xPI (360deg)
                angle = pi2 / (notches * 2),    // angle between notches
                taperAI = angle * taperI * 0.005, // inner taper offset (100% = half notch)
                taperAO = angle * taperO * 0.005, // outer taper offset
                a = angle,                  // iterator (angle)
                toggle = false;                  // notch radius level (i/o)
            ctx.beginPath();
            ctx.moveTo(cx + radiusO * Math.cos(taperAO), cy + radiusO * Math.sin(taperAO));
            for (; a <= pi2 + .01; a += angle) {
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
            ctx.globalCompositeOperation = 'source-over';
        }
        function spin(angle) {
            ctx.restore();
            ctx.fillStyle = cogcolor;
            ctx.fillRect(0, 0, 320, 320);
            ctx.fillStyle = transparentcolor;
            ctx.translate(320 / 2, 320 / 2);
            ctx.rotate(angle * Math.PI / 180);
            ctx.translate(-320 / 2, -320 / 2);
            ctx.drawImage(image, 0, 0, 320, 320)
            cog(ctx);
            encoder.addFrame(ctx);
        }

        async function animate(frames) {
            for (let i = 0; i < frames; i++) {
                await spin(360 / frames);
            }
        }

        await animate(40);

        encoder.finish();
        let attach = new Discord.MessageAttachment(stream, "cog.gif");
        return attach;
    }
}))

/*
commands.push(new Command({
    name: "spin",
    regex: /^spin(?: (.+))?$/i,
    prefix: ".",
    testString: ".spin \uD83D\uDE10",
    hidden: false,
    requirePrefix: true,
    log: true,
    points: 1,
    shortDesc: "turns image into a spinning gif",
    longDesc: `.spin (imageurl) or .spin (emoji) or .spin, while attaching an image
returns a gif of the image spinning`,
    run: async (message, args) =>{
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
        };
        async function getImage (s) {
            //if (args[1].includes('%')) args[1] = decodeURIComponent(args[1]);
            const emoji_match = args[1].match(/<?(a)?:?(\w{2,32}):(\d{17,19})>?/);
            if (emoji_match) {
                let emoji_object = { animated: Boolean(emoji_match[1]), name: emoji_match[2], id: emoji_match[3] };
                if (emoji_object.animated) return {error: '`Cannot be an animated emoji`'};
                let emoji = new Discord.Emoji(bot, emoji_object);
                return {image: await loadImage(emoji.url)};
            }
            if (message.attachments.size>0) {
                return {image: await loadImage(message.attachments.first().url)};
            }
            if (args[1].length<7) {
                let url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/11.3.0/2/72x72/${toCodePoint(args[1])}.png`
                let head = await rp.head(url);
                let validmime = ["image/png","image/jpeg","image/bmp","image/gif"]
                if (validmime.indexOf(head['content-type']) > -1) {
                    return {image: await loadImage(`https://cdnjs.cloudflare.com/ajax/libs/twemoji/11.3.0/2/72x72/${toCodePoint(args[1])}.png`)};
                }
            }
            try {
                let url = new URL(args[1]);
                let head = await rp.head(args[1]);
                let validmime = ["image/png","image/jpeg","image/bmp","image/gif"]
                if (validmime.indexOf(head['content-type']) > -1) {
                    return {image: await loadImage(args[1])};
                }
            } catch (e) {
            }
            return {error: "`Must be a non-animated emoji, URL, or contain an uploaded image`"};
        };
        let image_obj = await getImage(args[1]);
        if (image_obj.error) return image_obj.error;
        let image = image_obj.image;
        
        let size = 320;
        let transparentcolor="#fffffc";
        const encoder = new GIFEncoder(size, size);
        let stream = encoder.createReadStream();
        encoder.start();
        encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
        encoder.setDelay(1000/60*2);  // frame delay in ms
        encoder.setQuality(10); // image quality. 10 is default.
        encoder.setTransparent(transparentcolor); //
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = transparentcolor;

        function spin(angle) {
            ctx.restore();
            ctx.fillStyle = transparentcolor;
            ctx.fillRect(0, 0, 320, 320);
            ctx.translate(320/2, 320/2);
            ctx.rotate(angle*Math.PI/180);
            ctx.translate(-320/2, -320/2);
            ctx.drawImage(image,0,0,320,320)
            encoder.addFrame(ctx);
        }

        async function animate(frames) {
            for (let i=0;i<frames;i++) {
                await spin(360/frames);
            }
        }

        await animate(40);

        encoder.finish();
        let attach = new Discord.MessageAttachment(stream, "cog.gif");
        return attach;
    }
}))
*/

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
    run: async (message, args) => {
        return (await translate(args[1], { to: 'en' })).text
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
    typing: false,
    shortDesc: "returns user power level",
    longDesc: `.level
returns user power level`,
    run: (message, args) => {
        let stmt = sql.prepare("SELECT points FROM users WHERE user_id = ?;")
        let points = stmt.get(message.author.id).points
        let level = Math.floor(Math.pow(points, 0.5))
        return `\`Your power level is ${level}.\``;
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
    typing: false,
    shortDesc: "have a trophy",
    longDesc: `.rank
have a trophy`,
    run: (message, args) => {
        let stmt = sql.prepare("SELECT rank FROM (SELECT ROW_NUMBER() OVER (ORDER BY points DESC) rank, user_id FROM users WHERE user_id != ?) WHERE user_id = ?;")
        let rank = stmt.get(config.adminID, message.author.id).rank
        let url = "";
        if (rank < 2) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/a/a4/League_division_S.png";
        } else if (rank < 10) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/c/c3/League_division_A.png";
        } else if (rank < 30) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/6/6b/League_division_B.png";
        } else if (rank < 50) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/4/43/League_division_C.png";
        } else if (rank < 70) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/2/23/League_division_D.png";
        } else if (rank < 100) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/9/9c/League_division_E.png";
        } else {
            url = "https://vignette.wikia.nocookie.net/sonic/images/c/cd/League_division_F.png";
        }
        let attach = new Discord.MessageAttachment(url);
        return attach;
    }
}))

async function getImage(message, args){
    let safe = message.channel.nsfw ? "" : "&safe=active"
    //https://developers.google.com/custom-search/v1/cse/list
    let urlpromise;
    try {
        urlpromise = await rp({
            url: `https://www.googleapis.com/customsearch/v1?key=${config.api.image}&q=${encodeURIComponent(args)}&searchType=image&num=10${safe}`,
            json: true
        })
    } catch (e) {
        if (e.response && e.response.body && e.response.body.error && e.response.body.error.errors[0] && e.response.body.error.errors[0].reason && e.response.body.error.errors[0].reason === "dailyLimitExceeded") {
            return "`Try again tomorrow`";
        }
        throw e;
    }

    let data = urlpromise;
    let validmime = ["image/png", "image/jpeg", "image/bmp", "image/gif"]
    let extension = [".png", ".jpg", ".bmp", ".gif"]
    if (data.items && data.items.length > 0) {
        /*
        let imageitems = data.items.filter(element => {
            return validmime.indexOf(element.mime) > -1;
        })*/
        for (let i = 0; i < data.items.length; i++) {
            let imagedata = data.items[i];
            if (imagedata.image.byteSize < 8388608) {
                try {
                    let head = await rp.head(imagedata.link, { timeout: 1000 })
                    let mimeindex = validmime.indexOf(head["content-type"])
                    if (mimeindex < 0 || head["content-length"] >= 8388608) continue;
                    let attach = new Discord.MessageAttachment(imagedata.link, `${encodeURIComponent(args)}${extension[mimeindex]}`);
                    return attach;
                } catch (e) {
                    //let attach = new Discord.MessageAttachment(imagedata.image.thumbnailLink,`${encodeURIComponent(args[1])}${extension[validmime.indexOf(imagedata.mime)]}`);
                    //return attach;
                }
            } else {
                //let attach = new Discord.MessageAttachment(imagedata.image.thumbnailLink,`${encodeURIComponent(args[1])}${extension[validmime.indexOf(imagedata.mime)]}`);
                //return attach;
            }
        }
    }
    return "`No results found`"
}

commands.push(new Command({
    name: "image",
    regex: /^im(?:age|g) ([^\n\r]+?)$/i,
    prefix: ".",
    testString: ".image cat",
    hidden: false,
    requirePrefix: true,
    hardAsserts: () => { return config.api.image; },
    shortDesc: "returns the first image search result",
    longDesc: `.image (term)
returns the first image result. safesearch is off if the channel is nsfw. add gif to the search if you want gifs`,
    log: true,
    points: 1,
    run: async (message, args) => {
        return getImage(message, args[1])
    }
}))

commands.push(new Command({
    name: "gif",
    regex: /^gif ([^\n\r]+?)$/i,
    prefix: ".",
    testString: ".gif cat",
    hidden: false,
    requirePrefix: true,
    hardAsserts: () => { return config.api.image; },
    shortDesc: "returns the first gif search result",
    longDesc: `.gif (term)
returns the first gif search result. safesearch is off if the channel is nsfw.`,
    log: true,
    points: 1,
    run: async (message, args) => {
        return getImage(message, `${args[1]} gif`)
    }
}))

commands.push(new Command({
    name: "news",
    regex: /^news(?: (.+))?$/i,
    prefix: ".",
    testString: ".news trump",
    hidden: false,
    requirePrefix: true,
    hardAsserts: () => { return config.api.news; },
    shortDesc: "searches news articles",
    longDesc: {
        title: `.news __search_term__`,
        description: `returns news articles containing search term`,
        fields: [{
            name: `search_term`,
            value: `Surround phrases with quotes (") for exact match.
Prepend words or phrases that must appear with a + symbol. Eg: +bitcoin
Prepend words that must not appear with a - symbol. Eg: -bitcoin
Alternatively you can use the AND / OR / NOT keywords, and optionally group these with parenthesis. Eg: crypto AND (ethereum OR litecoin) NOT bitcoin.`
        }, {
            name: `Examples`,
            value: `.news trump - returns news containing "trump"
.news "yang gang" - return news containing the phrase "yang gang"`
        }]
    },
    log: true,
    points: 1,
    func: async (message, args) => {
        //https://newsapi.org/docs/endpoints/everything
        async function smmry(e) {
            let response = JSON.parse(await rp(`http://api.smmry.com/&SM_API_KEY=${config.api.smmry}&SM_WITH_BREAK=true&SM_URL=${e.url}`));
            if (response.sm_api_error) {
                return `\`${response.sm_api_message}\``;
            }
            let summary = response.sm_api_content;
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
        let desc = response.articles.filter((e, i, arr) => {
            return arr.findIndex((that_e) => {
                return that_e.title.toLowerCase() === e.title.toLowerCase();
            }) === i;
        }).map(e => {
            return [`${e.source.name}: **[${escapeMarkdownText(e.title)}](${escapeMarkdownText(e.url)})**`, async () => { return smmry(e) }];
        })


        if (desc.length == 1) {
            return await desc[0][1]()
        } else if (desc.length < 1) {
            return "`No results found`";
        } else {
            let rich = new Discord.RichEmbed()
            rich.setTitle(`Recent News${args[1] ? `: ${escapeMarkdownText(args[1])}` : ""}`);
            rich.setDescription(createCustomNumCommand3(message, desc));
            return rich;
        }
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
    longDesc: {
        title: `.ff14 __character_name__ __server_name_or_data_center__`,
        description: `returns character data`,
        fields: [{
            name: `character_name`,
            value: `The name to search for.`
        }, {
            name: `server_name or data_center`,
            value: `The server or data center which the character resides in. Not required.`
        }]
    },
    log: true,
    points: 1,
    func: async (message, args) => {
        let names = args[1].split(" ");
        if (names.length > 3) return "`Incorrect arguments. Should be .ff14 (character_name) [server_name]`";

        //https://xivapi.com/servers
        //https://xivapi.com/servers/dc
        let server = "";
        let char_name = args[1];
        if (names.length == 3) {
            const servers = ["_dc_Aether", "_dc_Chaos", "_dc_Crystal", "_dc_Elemental", "_dc_Gaia", "_dc_Light", "_dc_Mana", "_dc_Primal", "Adamantoise", "Aegis", "Alexander", "Anima", "Asura", "Atomos", "Bahamut", "Balmung", "Behemoth", "Belias", "Brynhildr", "Cactuar", "Carbuncle", "Cerberus", "Chocobo", "Coeurl", "Diabolos", "Durandal", "Excalibur", "Exodus", "Faerie", "Famfrit", "Fenrir", "Garuda", "Gilgamesh", "Goblin", "Gungnir", "Hades", "Hyperion", "Ifrit", "Ixion", "Jenova", "Kujata", "Lamia", "Leviathan", "Lich", "Louisoix", "Malboro", "Mandragora", "Masamune", "Mateus", "Midgardsormr", "Moogle", "Odin", "Omega", "Pandaemonium", "Phoenix", "Ragnarok", "Ramuh", "Ridill", "Sargatanas", "Shinryu", "Shiva", "Siren", "Tiamat", "Titan", "Tonberry", "Typhon", "Ultima", "Ultros", "Unicorn", "Valefor", "Yojimbo", "Zalera", "Zeromus", "Zodiark", "Spriggan", "Twintania"];
            let matches = servers.filter((server) => {
                return server.toLowerCase().indexOf(names[2].toLowerCase()) > -1;
            })
            if (matches.length == 1) {
                server = matches[0];
                char_name = names[0] + " " + names[1];
            } else if (matches.length > 1) {
                //find server
                return "`Server not found`";
            } else {
                return "`Server not found`";
            }
        }

        //https://xivapi.com/docs/Character#search
        let response = await rp(`https://xivapi.com/character/search?name=${encodeURIComponent(char_name)}&server=${server}`)
        response = JSON.parse(response);

        async function charRich(char) {
            let response = await rp(`https://xivapi.com/character/${char.ID}?data=AC,FC`)
            response = JSON.parse(response);
            /*
            if (response.Info.Character.State == 1) {
                return "`The character will be added to the database. Try again in a few seconds.`";
            } else if (response.Info.Character.State == 3) {
                return "`Character not found`";
            } else if (response.Info.Character.State == 4) {
                throw new Error(`Blacklisted character. ${response}`)
            } else if (response.Info.Character.State == 5) {
                return "`Character is private on lodestone`";
            }
            */
            let char_data = response.Character;
            let rich = new Discord.RichEmbed()
                .setTitle(`${char_data.Name} - ${char_data.Server}`)
                .setImage(char_data.Portrait)
                .setURL(`https://na.finalfantasyxiv.com/lodestone/character/${char.ID}/`)
            let desc_lines = []
            let genders = ["Male", "Female"]
            //https://xivapi.com/race
            let races = ["Hyur", "Elezen", "Lalafell", "Miqo'te", "Roegadyn", "Au Ra", "Hrothgar", "Viera"]
            desc_lines.push(`**${genders[char_data.Gender - 1]} ${races[char_data.Race - 1]}**`)

            if (char_data.ActiveClassJob) {
                //https://xivapi.com/ClassJob
                const jobs = ["Adventurer", "Gladiator", "Pugilist", "Marauder", "Lancer", "Archer", "Conjurer", "Thaumaturge", "Carpenter", "Blacksmith", "Armorer", "Goldsmith", "Leatherworker", "Weaver", "Alchemist", "Culinarian", "Miner", "Botanist", "Fisher", "Paladin", "Monk", "Warrior", "Dragoon", "Bard", "White Mage", "Black Mage", "Arcanist", "Summoner", "Scholar", "Rogue", "Ninja", "Machinist", "Dark Knight", "Astrologian", "Samurai", "Red Mage", "Blue Mage", "Gunbreaker", "Dancer"]
                //const job_data = JSON.parse(await rp(`https://xivapi.com/ClassJob/${char_data.ActiveClassJob.JobID}?columns=NameEnglish`));
                //const job = job_data.NameEnglish;
                desc_lines.push(`Level ${char_data.ActiveClassJob.Level} ${jobs[char_data.ActiveClassJob.JobID]}`);
                //console.log(char_data.ActiveClassJob.JobID)
            }

            if (char_data.GearSet.Gear) {
                const slots = ["Body", "Bracelets", "Earrings", "Feet", "Hands", "Head", "Legs", "MainHand", "Necklace", "OffHand", "Ring1", "Ring2", "Waist"]
                let item_ids = [];
                slots.forEach(slot => {
                    if (char_data.GearSet.Gear[slot]) item_ids.push(char_data.GearSet.Gear[slot].ID);
                })
                let post_body = {
                    "indexes": "item",
                    "columns": "LevelItem,EquipSlotCategory",
                    "body": {
                        "query": {
                            "ids": {
                                "values": item_ids
                            }
                        },
                        "from": 0,
                        "size": 20
                    }
                }
                let results = JSON.parse(await rp.post("https://xivapi.com/search").form(JSON.stringify(post_body))).Results;
                let total = results.reduce((sum, item) => {
                    if (item.EquipSlotCategory.OffHand != -1) {
                        return sum + item.LevelItem;
                    } else {
                        return sum + item.LevelItem * 2;
                    }
                }, 0)
                desc_lines.push(`**Average Item Level**: ${Math.round(total / 13 * 100) / 100}`);
            }
            if (response.FreeCompany) desc_lines.push(`**Free Company**: **[${response.FreeCompany.Name}](https://na.finalfantasyxiv.com/lodestone/freecompany/${response.FreeCompany.ID}/)**`)
            if (response.Achievements) desc_lines.push(`**Achievement Points**: ${response.Achievements.Points}`);
            if (char_data.Minions) desc_lines.push(`**Minions**: ${char_data.Minions.length}`);
            if (char_data.Mounts) desc_lines.push(`**Mounts**: ${char_data.Mounts.length}`);
            if (char_data.Bio) desc_lines.push(`**Character Profile**: ${escapeMarkdownText(char_data.Bio)}`);
            rich.setDescription(desc_lines.join("\n"))
            return rich;
        }

        let char_list = response.Results.map(char => {
            return [`${char.Name} - ${char.Server}`, async () => {
                let typing_prom = bot.api.channels[message.channel.id].typing.post();
                let result_prom = charRich(char);
                await typing_prom;
                return await result_prom;
            }]
        })

        if (char_list.length < 1) {
            return `\`No characters found\``
        } else if (char_list.length == 1) {
            return await char_list[0][1]();
        } else {
            let rich = new Discord.RichEmbed({
                title: "Multiple characters found",
                description: createCustomNumCommand3(message, char_list)
            })
            return rich;
        }
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
    typing: false,
    run: (message, args) => {
        return `\`
2022-12-13
• fixed .weather
• fixed .egs list links

2022-05-28
• time parsing switched to discord local time
• fixed time parsing bug with 2:30pm est
\``
    }
}))

//modified from Discord.Util
function cleanContentWithoutAt(str, message){
    str = str.replace(/<@!?[0-9]+>/g, input => {
        const id = input.replace(/<|!|>|@/g, '');
        if (message.channel.type === 'dm') {
            const user = message.client.users.cache.get(id);
            return user ? `${user.username}` : input;
        }

        const member = message.channel.guild.members.cache.get(id);
        if (member) {
            return `${member.displayName}`;
        } else {
            const user = message.client.users.cache.get(id);
            return user ? `${user.username}` : input;
        }
    })
    .replace(/<#[0-9]+>/g, input => {
        const channel = message.client.channels.cache.get(input.replace(/<|#|>/g, ''));
        return channel ? `${channel.name}` : input;
    })
    .replace(/<@&[0-9]+>/g, input => {
        if (message.channel.type === 'dm') return input;
        const role = message.guild.roles.cache.get(input.replace(/<|@|>|&/g, ''));
        return role ? `${role.name}` : input;
    });
    str = str.replace(/@([^<>@ ]*)/gmsu, (match, target) => {
        if (target.match(/^[&!]?\d+$/)) {
            return `${target}`;
        } else {
            return `\u200b${target}`;
        }
    });
    return str.replace(/@/g, '@\u200b');
}

commands.push(new Command({
    name: "birthday",
    regex: /^birthday( .+)?/i,
    prefix: ".",
    testString: ".birthday",
    hidden: true,
    requirePrefix: true,
    shortDesc: "",
    longDesc: {title:`.birthday`,
        description: `happy birthday!`
    },
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) =>{
        let names = "";
        if (args[1] != undefined) {
            names = args[1];
        }
        let rich = new Discord.RichEmbed();
        rich.setTitle(`Happy Birthday${cleanContentWithoutAt(names,message)}!`)
        rich.setImage("https://cdn.betterttv.net/emote/55b6524154eefd53777b2580/3x")
        return rich;
    },
}))

commands.push(new Command({
    name: "record",
    regex: /^record$/i,
    prefix: ".",
    testString: ".record",
    hidden: true,
    requirePrefix: true,
    shortDesc: "records the next time you speak and uploads the audio file to the channel",
    longDesc: {title:`.record`,
        description: `records the next time you speak and uploads the audio file to the channel`
    },
    log: true,
    req: () => { return config.adminID },
    prerun: (message) => { return message.author.id === config.adminID },
    points: 1,
    typing: false,
    run: async (message, args) =>{
        let channel = message.member.voice.channel;
        return new Promise((resolve)=>{
            //stop the music
            if (channel.guild.voice != null && channel.guild.voice.connection !=null && channel.guild.voice.connection.dispatcher != null) {
                channel.guild.voice.connection.dispatcher.removeAllListeners('finish');
                channel.guild.voice.connection.dispatcher.end();
            }
            resolve();
        }).then(()=>{
            //join channel
            if (channel.guild.voice != null && channel.guild.voice.connection !=null && channel.guild.voice.connection.channel.equals(channel)) {
                return channel.guild.voice.connection;
            } else {
                return channel.join();    
            }
        }).then((connection)=>{
            //record
            
            class Silence extends Readable {
                _read() {
                  this.push(Buffer.from([0xf8, 0xff, 0xfe]));
                }
            }
            connection.play(new Silence(), { type: "opus" })
            
            return sleep(500).then(()=>{
                return connection
            })
        }).then((connection)=>{
            let stream = connection.receiver.createStream(message.author, {end: 'silence', mode: 'pcm'});
            const transcoder = new prism.FFmpeg({
                args: [
                    '-f', 's16le',
                    '-analyzeduration', '0',
                    '-loglevel', '0',
                    '-ar', '48000',
                    '-ac', '2',
                    '-i', '-',
                    '-f', 'mp3'
                ],
            });
            let mp3out = stream.pipe(transcoder).pipe(new PassThrough());
            return new Promise(res=>{
                stream.on("end", ()=>{
                    channel.leave();
                    let attach = new Discord.MessageAttachment(mp3out, `${message.author.id}.mp3`);
                    res(attach);
                })
            })
            //let stream2 = fs.createReadStream('audio.pcm').pipe(transcoder);
            //let stream2 = fs.createReadStream("test2")
            //stream2.on("end", ()=>{console.log("end")})
            //stream2.pipe(fs.createWriteStream('test2.mp3'));
            //stream.on("pause", ()=>{console.log("pause")})
            //stream.on("readable", ()=>{console.log("readable")})
            //stream.on("data", ()=>{console.log("data")})
            //connection.play(stream, {type: 'opus'});
            //let attach = new Discord.MessageAttachment(fs.createReadStream("test2.mp3"), `${message.author}.mp3`);
            //return attach;
        }).catch((e)=>{
            throw e;
        })
    },
}))

commands.push(new Command({
    name: "emotes",
    regex: /^emotes$/i,
    prefix: ".",
    testString: ".emotes",
    hidden: true,
    requirePrefix: true,
    req: () => { return config.adminID },
    shortDesc: "",
    log: true,
    points: 1,
    run: async (message, args) =>{
        let curr_mes = ""
        bot.emojis.cache.each(emoji=>{
            if (curr_mes.length + emoji.toString().length > 1999) {
                message.channel.send(curr_mes);
                curr_mes = "";
            }
            curr_mes += emoji.toString();
        });
        return curr_mes;
    },
    typing: false,
}))

commands.push(new Command({
    name: "test",
    regex: /^test$/i,
    prefix: ".",
    testString: ".test",
    hidden: true,
    requirePrefix: true,
    shortDesc: "",
    longDesc: {title:`.test`,
        description: ``
    },
    req: () => { return config.adminID },
    prerun: (message) => { return message.author.id === config.adminID },
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) =>{/*
        fs.createReadStream('speech_orig.ogg')
        .pipe(new prism.opus.OggDemuxer())
        .pipe(fs.createWriteStream('./audio.pcm'));*/
        const transcoder = new prism.FFmpeg({
            args: [
                '-f', 's16le',
                '-analyzeduration', '0',
                '-loglevel', '0',
                '-ar', '48000',
                '-ac', '2',
                '-i', '-',
                '-f', 'mp3'
            ],
          });
        fs.createReadStream('audio.pcm')
        .pipe(transcoder)
        .pipe(fs.createWriteStream('test.mp3'));
    },
}))

//messages without prefixes

commands.push(new Command({
    name: "alexa play",
    regex: /^alexa play (.+)$/i,
    prefix: "",
    testString: "alexa play despacito",
    hidden: true,
    requirePrefix: false,
    req: () => { return config.api.youtube; },
    log: true,
    points: 1,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) => {
        return `use .yt`;
    }
}))

commands.push(new Command({
    name: "00:00am est",
    regex: /(?:^|[^a-zA-Z0-9])(\d{1,2}):?(\d{2})? ?([ap]m)? ?(est|cst|pst|nzdt|jst|utc|edt|cdt|pdt|gmt)(?:$|[^a-zA-Z0-9])/i,
    prefix: "",
    testString: "blah blah blah 12:30am est blah blah blah",
    hidden: false,
    requirePrefix: false,
    typing: false,
    shortDesc: "converts to different timezones",
    longDesc: `(00:00)[am or pm] (time_zone)
returns the time converted to different time zones. can be anywhere in a message`,
    log: true,
    points: 1,
    run: (message, args) => {
        let fullZones2 = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC"];
        let fullName = convertTZ(args[4]);
        //msg += fullName;
        let inputTime = moment.tz(`${args[1]}${args[2] ?? "00"}${args[3]}`, ["hmma"], fullName).subtract(1, 'days');
        if (!inputTime.isValid()) return;
        if (parseInt(args[1]) < 13 && args[3] === undefined) {
            for (let i = 0; i < 4; i++) {
                if (inputTime.diff(moment()) >= 0) {
                    break;
                }
                inputTime.add(12, 'hours');
            }
        } else {
            for (let i = 0; i < 2; i++) {
                if (inputTime.diff(moment()) >= 0) {
                    break;
                }
                inputTime.add(1, 'days');
            }
        }
        let msg = `<t:${inputTime.unix()}>`;
/*
        msg = msg + fullZones2.map(zone => {
            return inputTime.tz(zone).format('ddd, MMM Do YYYY, h:mma z');
        }).join("\n")

        msg += "`";*/
        return msg;
    }
}))

/*
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
    typing: false,
    prerun: (message, args) => {
        return args[1].toLowerCase() !== "this" && args[1].toLowerCase() !== "that" && args[1].toLowerCase() !== "off";
    },
    run: (message, args) => {
        if (args[1].toLowerCase() === "you" || args[1].toLowerCase() === "u") {
            return "fuck you too";
        }
        return `I think its hilarious u kids talking shit about ${args[1]}. u wouldnt say this shit to ${args[1]} at lan. not only that but ${args[1]} wears the freshest clothes, eats at the chillest restaurants and hangs out with the hottest dudes. yall are pathetic lol`;
    }
}))
*/
/*
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
    typing: false,
    run: (message, args) => {
        return "never";
    }
}))
*/
/*
commands.push(new Command({
    name: "based",
    regex: /^based$/i,
    prefix: "",
    testString: "based",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    typing: false,
    run: async (message, args) => {
        let responses = [];
        responses.push(`"Based"? Are you fucking kidding me? I spent a decent portion of my life writing all of that and your response to me is "Based"? Are you so mentally handicapped that the only word you can comprehend is "Based" - or are you just some fucking asshole who thinks that with such a short response, he can make a statement about how meaningless what was written was? Well, I'll have you know that what I wrote was NOT meaningless, in fact, I even had my written work proof-read by several professors of literature. Don't believe me? I doubt you would, and your response to this will probably be "Based" once again. Do I give a fuck? No, does it look like I give even the slightest fuck about five fucking letters? I bet you took the time to type those five letters too, I bet you sat there and chuckled to yourself for 20 hearty seconds before pressing "send". You're so fucking pathetic. I'm honestly considering directing you to a psychiatrist, but I'm simply far too nice to do something like that. You, however, will go out of your way to make a fool out of someone by responding to a well-thought-out, intelligent, or humorous statement that probably took longer to write than you can last in bed with a chimpanzee. What do I have to say to you? Absolutely nothing. I couldn't be bothered to respond to such a worthless attempt at a response. Do you want "Based" on your gravestone?`)
        responses.push(`Based? Based on what? In your dick? Please shut the fuck up and use words properly you fuckin troglodyte, do you think God gave us a freedom of speech just to spew random words that have no meaning that doesn't even correllate to the topic of the conversation? Like please you always complain about why no one talks to you or no one expresses their opinions on you because you're always spewing random shit like poggers based cringe and when you try to explain what it is and you just say that it's funny like what? What the fuck is funny about that do you think you'll just become a stand-up comedian that will get a standing ovation just because you said "cum" in the stage? HELL NO YOU FUCKIN IDIOT, so please shut the fuck up and use words properly you dumb bitch`)
        return responses[parseInt(Math.random() * responses.length)];
    }
}))
*/
/*
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
    typing: false,
    run: async (message, args) => {
        let thismsgs = await message.channel.messages.fetch({
            limit: 1,
            before: message.id
        })
        let thismsg = thismsgs.first();
        if (thismsg.content == "") return new Discord.MessageAttachment("https://i.kym-cdn.com/photos/images/newsfeed/000/173/576/Wat8.jpg");
        else if (thismsg.author.id === message.author.id) return new Discord.MessageAttachment("https://i.kym-cdn.com/photos/images/newsfeed/000/173/576/Wat8.jpg");
        else return `**${thismsg.content.toUpperCase().replace(/\*\*
            /g, "")}**`;
    }
}))
*/
/*
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
    typing: false,
    run: (message, args) => {
        return "http://www.dhuang8.com/gg/";
    }
}))
*/
//todo volume

commands.push(new Command({
    name: "botlink",
    regex: /^botlink$/i,
    prefix: ".",
    testString: "botlink",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    typing: false,
    req: () => { return config.adminID && config.botlink; },
    prerun: (message) => { return message.author.id === config.adminID },
    run: (message, args) => {
        return `<${config.botlink}>`;
    }
}))

commands.push(new Command({
    name: "gamerday",
    regex: /^gamerday$/i,
    prefix: ".",
    testString: "gamerday",
    hidden: true,
    requirePrefix: true,
    shortDesc: "",
    longDesc: ``,
    typing: false,
    run: (message, args) => {
        return `fuck you`;
    }
}))

commands.push(new Command({
    name: "bad bot",
    regex: /^bad bot$/i,
    prefix: "",
    testString: "bad bot",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    typing: false,
    run: (message, args) => {
        let responses = ["fuck off", "sorry"];
        return responses[parseInt(Math.random() * responses.length)];
    }
}))

commands.push(new Command({
    name: "good bot",
    regex: /^good bot$/i,
    prefix: "",
    testString: "good bot",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    typing: false,
    run: (message, args) => {
        return "`Thank you. Your vote has been recorded.`";
    }
}))

commands.push(new Command({
    name: "hi",
    regex: /^hi$/i,
    prefix: "",
    testString: "hi",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    typing: false,
    run: (message, args) => {
        return "hi";
    }
}))

/*
commands.push(new Command({
    name: "animal",
    regex: /animal/i,
    prefix: "",
    testString: "blah blah blah animal",
    hidden: true,
    typing: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 1,
    typing: false,
    func: (message, args) => {
        let files = fs.readdirSync("animalgifs/");
        let file = files[Math.floor(Math.random() * files.length)]
        return new Discord.MessageAttachment("animalgifs/" + file);
    }
}))
*/
/*
commands.push(new Command({
    name: "im blah",
    regex: /^(?:im|i'm)( \w+)$/i,
    prefix: "",
    testString: "im bored",
    hidden: true,
    requirePrefix: false,
    shortDesc: "return hi blah",
    longDesc: ``,
    log: true,
    typing: false,
    points: 1,
    run: (message, args) => {
        let greetings = ["Hello", "Hi", "Hey", "Greetings"];
        let responses = ["Nice to meet you.", ""];
        if (message.guild.me && message.guild.me.displayName) {
            responses.push(`I'm ${message.guild.me.displayName}.`)
        }
        let response = responses[parseInt(Math.random() * responses.length)];
        let greeting = greetings[parseInt(Math.random() * greetings.length)];
        var msg = `${greeting}${args[1]}. ${response}`;
        return msg;
    }
}))
*/
commands.push(new Command({
    name: "play death stranding",
    regex: /(?:play|like) death stranding/i,
    prefix: "",
    testString: "something something play death stranding something",
    hidden: true,
    requirePrefix: false,
    shortDesc: "",
    longDesc: "",
    log: true,
    points: 1,
    run: (message, args) => {
        return `It's Death Stranding. You don't "play" it and you don't "like" it. It transcends those social constructs you fuckin swine. That's how I know you're not ready for Kojimas Brilliance. Using words like "play" and "like" when talking about Death Stranding. \\*SPITS\\* FUCK YOU. You have no idea what this is really about. The metaphysical meaning, the deep and subtle vicissitudes that Kojima was able to expertly weave into this piece of art that transcends the basic human cognisense. He's a damn near omniscient being and to that its a standing ovation. To anyone with an IQ over 500.`;
    },
    typing: false,
}))

commands.push(new Command({
    name: "exit",
    regex: /^exit$/i,
    prefix: ".",
    testString: "",
    hidden: true,
    requirePrefix: true,
    req: () => { return config.adminID; },
    shortDesc: "",
    longDesc: ``,
    log: true,
    points: 0,
    typing: false,
    prerun: (message) => { return message.author.id === config.adminID },
    run: (message, args) => {
        process.exit();
        return null;
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
    run: async (message, args) =>{
        return null;
    },
    typing: false,
}))
*/
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
    typing: false,
    run: (message, args) => {
        let results = [];
        let mes = commands.filter((cur) => {
            return cur.getVisibility();
        }).map((cur, index) => {
            return [cur.getShortDesc(), ()=>{
                if (typeof cur.getLongDesc() == "string") {
                    return "```" + cur.getLongDesc() + "```" ;
                } else {
                    return new Discord.RichEmbed(cur.getLongDesc());
                }
            }];
        });
        let rich = new Discord.RichEmbed({
            title: "List of commands",
            description: createCustomNumCommand3(message, mes)
        })
        rich.setFooter(`Respond with number or ".(commandname) help" for more info`)
        return rich;
    }
}))
commands.push(new Command({
    name: "update",
    regex: /^update(?: (.+))?$/i,
    requirePrefix: true,
    hidden: true,
    hardAsserts: () => { return config.adminID; },
    shortDesc: "update script",
    longDesc: `.update
updates script`,
    log: true,
    points: 0,
    typing: true,
    prerun: (message) => { return message.author.id === config.adminID },
    run: (message, args) => {
        if (args[1]) {
            return (new Promise((res, rej) => {
                execFile('node', [`update_scripts/${args[1]}/update.js`], (e, stdout, stderr) => {
                    if (e) {
                        rej(e)
                    } else {
                        res(`\`${stdout} ${stderr}\``);
                    }
                })
            }))
        } else {
            return (new Promise((res, rej) => {
                execFile('git', ["pull", "https://github.com/dhuang8/Tall-Bot.git", "v3"], (e, stdout, stderr) => {
                    if (e) {
                        rej(e)
                    } else {
                        res(`\`${stdout} ${stderr}\``);
                    }
                })
            }))
        }
        return null;
    }
}))

commands.push(new Command({
    name: "terminal",
    regex: /^terminal (.*)$/i,
    requirePrefix: true,
    hidden: true,
    hardAsserts: () => { return config.adminID; },
    shortDesc: "run terminal command",
    longDesc: `.terminal
run terminal command`,
    log: true,
    points: 0,
    typing: true,
    prerun: (message) => { return message.author.id === config.adminID },
    run: (message, args) => {
        return (new Promise((res, rej) => {
            let cmdpart = args[1].split(" ")
            execFile(cmdpart[0], cmdpart.slice(1), {cwd: __dirname}, (e, stdout, stderr) => {
                if (e) {
                    rej(e)
                } else {
                    res([`${stdout} ${stderr}`, {code:true, split: true}]);
                }
            })
        }))
    }
}))

commands.push(new Command({
    name: "test",
    regex: /^test$/i,
    requirePrefix: true,
    hidden: true,
    hardAsserts: () => { return config.adminID; },
    shortDesc: "tests commands",
    longDesc: `.test
returns a list of commands. respond with the number to test that command`,
    log: true,
    points: 0,
    typing: false,
    func: (message, args) => {
        if (message.author.id != config.adminID) return false;
        let results = [];
        let mes = "```";
        mes += commands.filter((cur) => {
            return cur.testString !== "";
        }).map((cur, index) => {
            results.push(cur);
            return `${index + 1}. ${cur.name} - "${cur.testString}"`;
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
        return mes;
    }
}))


commands.push(new Command({
    name: "stop",
    regex: /^stop$/i,
    prefix: ".",
    testString: "",
    hidden: true,
    requirePrefix: false,
    shortDesc: "stops the current song playing",
    longDesc: `stop
stops the current song playing`,
    log: true,
    points: 0,
    typing: false,
    prerun: (message, args) => {
        let server = message.channel.guild;
        if (server.voice && server.voice.connection != null) {
            server.voice.connection.disconnect();
            return true;
        }
        return false
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
    readme += commands.filter(cmd => {
        return !cmd.hidden;
    }).map(cmd => {
        let desc = `## ${cmd.name}\n`;
        if (typeof cmd.longDesc === "string") {
            let com_desc = cmd.longDesc.split("\n");
            if (com_desc[0] === cmd.name) com_desc = com_desc.slice(1)
            desc += com_desc.join("\n\n");
        } else {
            desc += cmd.longDesc.description + "\n";
            desc += `### ${cmd.longDesc.title}\n`;
            cmd.longDesc.fields.forEach(field => {
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
        return v.run(message);
    })) return;
});

bot.on('error', console.error);