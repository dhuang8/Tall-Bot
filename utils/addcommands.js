"use strict";
const Command = require('./Command');
const Discord = require('discord.js');
const request = require('request');
const fs = require('fs');
const moment = require('moment-timezone');
const cheerio = require('cheerio');

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
            let username = message.author.username;
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
        token: null,
        botlink: null
    };

    //create file if it does not exist
    //setTimeout(()=>{
        
    fs.readFile("./config.json", "utf8", (err,data) => {
        if (err && err.code === "ENOENT") {
            fs.writeFile("./config.json", JSON.stringify(config, null, 4), (e) => {
                console.log(e);
            })
        } else {
            config = JSON.parse(data)
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
        regex: /^hs (.+)$/i,
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
            return console.log(e);
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
                        let conditions = conditionstring.map((cur)=>{
                            let b;
                            if (b = /(.+):(.+)/i.exec(cur)) {
                                b[1] = simplifyfield(b[1]);
                                b[2] = simplifyfield(b[2]);
                                return (field, value) => {
                                    if (field.indexOf(b[1])>-1 && value.indexOf(b[2])>-1) {
                                        return true;
                                    }
                                    return false;
                                }
                            } else if (b = /i(\d+)/i.exec(cur)) {
                                b[1] = parseInt(b[1]);
                                return (field, value) => {
                                    if (field.indexOf("startup")>-1 && parseInt(value) === b[1]) {
                                        return true;
                                    }
                                    return false;
                                }
                                //add checks for < and >
                            } else if (b = /(.+)([=])(.+)/i.exec(cur)) {
                                b[1] = simplifyfield(b[1]);
                                b[3] = simplifyfield(b[3]);
                                if (!isNaN(b[3])) {
                                    b[3] = parseInt(b[3]);
                                    return (field, value) => {
                                        if (field.indexOf(b[1])>-1 && parseInt(value) === b[3]) {
                                            return true;
                                        }
                                        return false;
                                    }
                                }                                
                                return (field, value) => {
                                    if (field.indexOf(b[1])>-1 && value.indexOf(b[2])>-1) {
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
    commands.push(new Command({
        name: "test",
        regex: /^test$/i,
        prefix: "",
        testString: "test",
        hidden: true,
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
        name: "runtest",
        regex: /^runtest$/i,
        requirePrefix: true,
        hidden: true,
        shortDesc: "tests commands",
        longDesc: `.runtest
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