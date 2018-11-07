"use strict";
const Command = require('./Command');
const Discord = require('discord.js');
const request = require('request');
const fs = require('fs');
const moment = require('moment-timezone');
const cheerio = require('cheerio');
const ytdl = require('ytdl-core');

exports.getCommands = (bot) => {
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
                console.log(error.stack);
                console.log(e.stack);
                console.log("maybe missing bot channel");
            })
            if (loadingMessage != null) loadingMessage.edit(content).catch(err)
        } else {
            console.log(error);
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
                    console.log(1, error,response,body);
                    reject(e);
                }
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
        this.time = moment().add(10, "seconds");
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

    let config = {
        adminID: null,
        botChannelID: null,
        errorChannelID: null,
        secretChannelID: null,
        api: {
            youtube:null,
            darksky:null,
            battlerite:null,
            hearthstone:null
        },
        token: null
    };
        
    fs.readFile("./config.json", "utf8", (err,data) => {
        if (err && err.code === "ENOENT") {
            fs.writeFile("./config.json", JSON.stringify(config, null, 4), (e) => {
                console.error(e);
            })
            console.error("paste discord token in config.json and restart");
        } else {
            config = JSON.parse(data);

bot.on('ready', () => {
    console.log('ready');
    bot.channels.get(config.errorChannelID).send(`\`${process.platform} ready\``).catch(bot.err)
});
            bot.login(config.token);
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
        func: (message, args)=>{
            return message.author.bot;
        }
    }))
    commands.push(new Command({
        name: "log outside messages",
        hidden: true,
        hardAsserts: ()=>{return config.adminID && config.secretChannelID},
        func: (message, args)=>{
            if (!message.channel.members || !message.channel.members.get(config.adminID)) {
                try {
                    let msg = `\`${moment().format('h:mma')} ${message.author.username} (${message.author.id}):\` ${message.cleanContent} \`\n${message.channel.type} channel ${(message.channel.name ? `${message.channel.name} (${message.channel.id})` : message.channel.id)}${((message.channel.guild && message.channel.guild.name) ? ` in guild ${message.channel.guild.name}(${message.channel.guild.id})` : "")}\``;
                    bot.channels.get(config.secretChannelID).send(msg).catch(err);
                } catch (e) {
                    err(e);
                } finally {
                    return false;
                }
            }
        }
    }))
    commands.push(new Command({
        name: "remove messages in bot and error channels",
        hidden: true,
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
        func: (message, args)=>{
            if (extraCommand[message.channel.id] != null) {
            return extraCommand[message.channel.id].onMessage(message);
        }
        }
    }))
    commands.push(new Command({
        name: "ping",
        regex: /ping/,
        testString: "ping",
        shortDesc: "returns pings",
        longDesc: "returns the average of the last 3 pings",
        func: (message, args)=>{
            message.channel.send(bot.ping).catch(err);
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
        func: (message, args)=>{
            message.channel.send("^").catch(err);
            return true;
        }
    }))
    commands.push(new Command({
        name: "k",
        regex: /^k$/,
        testString: "k",
        shortDesc: "responds with some long message",
        longDesc: "responds with \"You fucking do that every damn time I try to talk to you about anything even if it's not important you just say K and to be honest it makes me feel rejected and unheard like nothing would be better that that bullshit who the fuck just says k after you tell them something important I just don't understand how you think that's ok and I swear to god you're probably just gonna say k to this but when you do you'll know that you're slowly killing me inside\"",
        prefix: "",
        hidden: true,
        func: (message, args)=>{
            let msg = `You fucking do that every damn time I try to talk to you about anything even if it's not important you just say K and to be honest it makes me feel rejected and unheard like nothing would be better that that bullshit who the fuck just says k after you tell them something important I just don't understand how you think that's ok and I swear to god you're probably just gonna say k to this but when you do you'll know that you're slowly killing me inside`;
            message.channel.send(msg).catch(err);
            return true;
        }
    }))
    commands.push(new Command({
        name: "time",
        regex: /^time$/,
        testString: "time",
        shortDesc: "responds with the time at several time zones",
        longDesc: "responds with the time in UTC, CST, EST, PST, NZST, and JST",
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
        requirePrefix: true,
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
                console.log(e);
                err(e);
            })
        }
    }))

    let timeouts=[];
    commands.push(new Command({
        name: "remindme",
        regex: /^remindme "(.*)" (.+)$/i,
        requirePrefix: true,
        testString: '.remindme "this is a test message" 5 seconds',
        shortDesc: "sends a reminder at a later time",
        longDesc: `.remindme "(message)" (num) (sec/min/hour/etc)
sends a reminder after specified time. the number is the id.

.remindme "(message)" (00:00am est)
sends a reminder at specified time. the number is the id.

.remindme "(message)" (datestring)
sends a reminder at specified date. datestring is any string accepted for making a new Date object in JS. the number is the id.`,
        func: (message, args)=>{
            let reminder = args[1];
            let timestring = args[2];
            function createReminder(time) {
                let rich = Discord.RichEmbed();
                let now = moment();
                rich.setTitle(reminder);
                rich.setDescription("Setting reminder to");
                rich.setTimestamp(time);
                let timeoutid = timeouts.length;
                timeouts[timeoutid] = bot.setTimeout(function () {
                    message.reply(`reminder: ${reminder}`, {
                        embed: richQuote(message)
                    });
                }, time - now)
                message.reply(timeoutid, {
                    embed: rich
                });
            }
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
                createReminder(time);
            } else {
                let time = moment.utc(new Date(timestring));
                if (!time.isValid()) return false;
                createReminder(time);
            }
            return true;
        }
    }))
    commands.push(new Command({
        name: "cancelremindme",
        regex: /^cancelremindme (\d+)$/i,
        requirePrefix: true,
        shortDesc: "cancels a remindme reminder",
        longDesc: `.cancelremindme (id)
cancels a remindme reminder with id`,
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
        testString: ".ygo nirvana high paladin",
        requirePrefix: true,
        shortDesc: "returns yu-gi-oh card data",
        longDesc: `.ygo (card name)
returns yu-gi-oh card data. must use full name`,
        func: (message, args)=>{
            (async ()=>{
                let body;
                try {
                    body = await requestpromise(`http://www.ygo-api.com/api/Cards/${encodeURIComponent(args[1])}`)
                } catch (e) {
                    message.channel.send("`Card not found. Card name must be complete.`").catch(err);
                    return;
                }                
                let data = JSON.parse(body);
                let rich = new Discord.RichEmbed();
                rich.setTitle(data.name);
                data.description = replaceAll(data.description,"<br>","\n");
                rich.setDescription(data.description);
                rich.setImage(`http://www.ygo-api.com${encodeURI(data.imageUrl)}`);
                message.channel.send("",{embed:rich}).catch(err);
            })().catch(e=>{
                message.channel.send("`Error`").catch(err);
                err(e);
            })
            return true;
        }
    }))
    commands.push(new Command({
        name: "hs",
        regex: /^hs (\S+)$/i,
        requirePrefix: true,
        testString: ".hs open the waygate",
        shortDesc: "returns hearthstone card data",
        longDesc: `.hs (card name)
returns hearthstone card data`,
        hardAsserts: ()=>{return config.api.hearthstone;},
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

    let t7 = null;        
    fs.readFile("t7/t7.json", 'utf8', function (e, data) {
        if (e) {
            console.log("Tekken 7 data not found");
        }
        t7 = JSON.parse(data);
    })

    commands.push(new Command({
        name: "t7",
        regex: /^t7 (\S+) ([^\n\r]+?)$/i,
        requirePrefix: true,
        hardAsserts: ()=>{return t7;},
        testString: ".t7 ali b24",
        shortDesc: "returns information about a tekken 7 character's move",
        longDesc: `.t7 (character_name) (move)
returns information about a tekken 7 character's move`,
        func: (message, args)=>{
            (async ()=>{

                function simplifyMove(s) {
                    s = s.toLowerCase();
                    s = replaceAll(s, " ", "");
                    s = replaceAll(s, "\\/", "");
                    s = replaceAll(s, ",", "");
                    s = replaceAll(s, "(\\D)\\+(\\d)", "$1$2");
                    s = replaceAll(s, "(\\D)\\+(\\D)", "$1$2");
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
                Object.keys(t7).forEach((v, i)=>{
                    let charindex = v.indexOf(args[1]);
                    if (charindex===0) charfound.push(v);
                    else if(charindex>0) charfoundmid.push(v);
                })

                function parseCharList(charfound) {
                    if (charfound.length ==1) return [getMove(charfound[0], args[2])];
                    else if (charfound.length>1) {
                        extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                            var num = parseInt(message.content) - 1;
                            if (num < charfound.length && num > -1) {
                                message.channel.send(getMove(charfound[num], args[2]));
                                return true;
                            }
                            return false;
                        })
                        let msg = "```" + charfound.map((e, i)=>{
                            return `${i+1}. ${t7[e].name}`
                        }).join("\n") + "```";;
                        return [msg];
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
                        let conditionstring = move.split("&");
                        //returns a function that returns true if given field matches current field and satisfies value comparison
                        function parseConditionArgs(fieldname, comparison, valuestring) {
                            let numfields = ["damage","startupframe","blockframe","hitframe","counterhitframe","post-techframes","speed","damage"]

                            //compares the field value to the given value
                            function comparefunc(value,comparison,valuestring,isnumfield) {
                                if (comparison=="<" && isnumfield && !isNaN(valuestring)) {
                                    return parseInt(value) < parseInt(valuestring);
                                } else if (comparison==">" && isnumfield && !isNaN(valuestring)){
                                    return parseInt(value) > parseInt(valuestring);
                                } else if (comparison=="=" && isnumfield && !isNaN(valuestring)){
                                    return parseInt(value) = parseInt(valuestring);
                                } else if (comparison=="<"){
                                    return value.endsWith(valuestring);
                                } else if (comparison=="="){
                                    return value == valuestring;
                                } else if (comparison==">"){
                                    return value.startsWith(valuestring);
                                } else if (comparison==":"){
                                    return value.indexOf(valuestring) > -1;
                                }
                            }
                            return (field, value) => {
                                let isnumfield = false;
                                if (numfields.indexOf(field) > -1) {
                                    if (isNaN(valuestring)) return false;
                                    isnumfield = true;
                                }
                                if (field.indexOf(fieldname)>-1 && comparefunc(value,comparison,valuestring,isnumfield)) {
                                    return true;
                                }
                                return false;
                            }
                        }

                        let conditions = [];

                        let conditions = conditionstring.map((cur)=>{
                            let b;
                            if (b = /(.+)([:=<>])(.+)/i.exec(cur)) {
                                b[1] = simplifyfield(b[1]);
                                b[3] = simplifyfield(b[3]);
                                return parseConditionArgs(b[1],b[2],b[3]);
                            } else if (b = /i(\d+)/i.exec(cur)) {
                                b[1] = parseInt(b[1]);
                                return (field, value) => {
                                    if (field.indexOf("startup")>-1 && parseInt(value) === b[1]) {
                                        return true;
                                    }
                                    return false;
                                }
                            } else {
                                return ()=>{return false}
                            }
                        })
                        Object.entries(char.moves).forEach((entry)=>{
                            entry[1].forEach((moveobj) => {
                                let match = conditions.every((cur)=>{
                                    return Object.entries(moveobj).some((field)=>{
                                        return cur(simplifyfield(field[0]), simplifyfield(field[1]))
                                    })

                                })

                                if (match) {
                                    console.log(moveobj)
                                    poslist.push(moveobj)
                                };
                                
                            })
                        })
                    }

                    if (poslist.length === 1) {
                        return [createMoveMessage(char, poslist[0])];
                    } else if (poslist.length > 1) {
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
                    } else {
                        return ["`Move not found`"];
                    }
                }

                function createMoveMessage(char, move) {
                    let gfycatlink = move.gfycat || "";
                    let mes = `__**${char.name}**__\n`
                    mes += Object.keys(move).filter((v) => {
                        return v!="gfycat";
                    }).map((key)=>{
                        return `**${key}**: ${move[key]}`
                    }).join("\n");
                    mes += gfycatlink;
                    return mes;
                }

                let msg = parseCharList(charfound) || parseCharList(charfoundmid) || "`Character not found`"
                return [msg];
            })().then(params=>{
                message.channel.send.apply(message.channel, params).catch(err);
            }).catch(e=>{
                err(e);
                message.channel.send("`Error`").catch(err);
            })
            return true;
        }
    }))
    
    let sts = null;        
    fs.readFile("sts/items.json", 'utf8', function (e, data) {
        if (e) {
            return console.log(e);
        }
        sts = JSON.parse(data);
    })

    commands.push(new Command({
        name: "sts",
        regex: /^sts (\S+)$/i,
        prefix: ".",
        testString: ".sts apparition",
        hardAsserts: ()=>{return sts;},
        hidden: false,
        requirePrefix: true,
        shortDesc: "returns information on a Slay the Spire card or relic",
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
            console.log(e);
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
        shortDesc: "returns the exchange rate and a 30 hour graph of the price of a foreign currency or cryptocurrency",
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
            console.log(e);
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
        shortDesc: "returns list of YouTube videos based on the search term",
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
                let msg = "";
                let rich = new Discord.RichEmbed();
                rich.setTitle("YouTube results");
                rich.setURL("https://www.youtube.com/results?search_query=" + args[1])
                for (var i = 0; i < data.items.length; i++) {
                    rich.addField(i + 1, `[${data.items[i].snippet.title}](https://youtu.be/${data.items[i].id.videoId})`, false);
                    msg += `${i + 1} <https://youtu.be/${data.items[i].id.videoId}> ${data.items[i].snippet.title}\n`;
                }
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
                                message.reply(`get in a voice channel`).catch(err);
                                return false;
                            }
                            let stream = ytdl("https://www.youtube.com/watch?v=" + data.items[num - 1].id.videoId, {                                    
                                filter: 'audioonly',
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
        shortDesc: "returns a link to and a quote of a past message",
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
        shortDesc: "",
        longDesc: ``,
        func: (message, args) =>{
            if (message.author.id !== adminID) return false;
            (async()=>{
                let output = eval(a[1]);
                if (output.length<0) output = "`No output`"
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

    commands.push(new Command({
        name: "weather",
        regex: /^weather (\S.*)$/i,
        prefix: ".",
        testString: ".weather nyc",
        hidden: false,
        requirePrefix: true,
        hardAsserts: ()=>{return config.api.darksky;},
        shortDesc: "returns the 8 day forecast and a chart of the temperature for the next 2 days",
        longDesc: `.weather (location)
returns the 8 day forecast and a chart of the temperature for the next 2 days
location - can be several things like the name of a city or a zip code`,
        func: (message, args) =>{
            (async()=>{
                //todo
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
        name: "nothing",
        regex: /^nothing$/i,
        prefix: ".",
        testString: "",
        hidden: true,
        requirePrefix: true,
        hardAsserts: ()=>{return;},
        shortDesc: "",
        longDesc: ``,
        func: (message, args) =>{
            (async()=>{
                //todo
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
                console.log(e)
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
        func: (message, args)=>{
            let results = [];
            let mes = "```";
            mes += commands.filter((cur)=>{
                return cur.getVisibility();
            }).map((cur, index)=>{
                results.push("```" + cur.getLongDesc() + "```");
                return `${index+1}. ${cur.getShortDesc()}`;
            }).join("\n");
            mes += "```";
            extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                var num = parseInt(message.content) - 1;
                if (num < results.length && num > -1) {
                    message.channel.send(results[num]).catch(err);
                    return true;
                }
                return false;
            })
            message.channel.send(mes).catch(err);
            return true;
        }
    }))
    commands.push(new Command({
        name: "test",
        regex: /^test$/i,
        requirePrefix: true,
        hidden: true,
        shortDesc: "tests commands",
        longDesc: `.test
returns a list of commands. respond with the number to test that command`,
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
    return commands;
}