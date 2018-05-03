"use strict";
const Discord = require('discord.js');
const request = require('request');
const fs = require('fs');
const moment = require('moment-timezone');
//const cloudscraper = require('cloudscraper');
const ytdl = require('ytdl-core');
const cheerio = require('cheerio');
const config = JSON.parse(fs.readFileSync("./config.json"));

const adminID = config.adminID;
const botChannelID = config.botChannelID;
const errorChannelID = config.errorChannelID;
const secretChannelID = config.secretChannelID;
const apikey = config.api;
const token = config.token;
const botlink = config.botlink;

let lastPresenceMsg = "";
moment.tz.setDefault("America/New_York");

const bot = new Discord.Client();

let timeouts = [];

var serverVol = {};

let copypasta = [];
fs.readFile("../copypasta.txt", 'utf8', function (e, data) {
    if (e) {
        return console.log(e);
    }
    copypasta = data.split("\x0d\x0a\x0d\x0a\x20\x0d\x0a\x0d\x0a")
})

let gw2key = {};
fs.readFile("gw2key.json", 'utf8', function (e, data) {
    if (e) {
        return console.log(e);
    }
    gw2key = JSON.parse(data);
})

let poeleague = {};
fs.readFile("poeleague.json", 'utf8', function (e, data) {
    if (e) {
        return console.log(e);
    }
    poeleague = JSON.parse(data);
})

let sts = {};
fs.readFile("sts/items.json", 'utf8', function (e, data) {
    if (e) {
        return console.log(e);
    }
    sts = JSON.parse(data);
})

var CustomCommand = function (regex, callback) {
    this.regex = regex;
    this.callback = callback;
    this.important = false;
}

CustomCommand.prototype.onMessage = function (message) {
    var a;
    if (a = this.regex.exec(message.content)) {
        return this.callback(message);
    }
    return false;
}

//start richembeds with a random color
let save = Discord.RichEmbed;
//let save = Discord.MessageEmbed;
Discord.RichEmbed = function (data) {
    let rich = new save(data);
    return rich.setColor("RANDOM"); //parseInt(Math.random() * 16777216));
}

bot.on('ready', () => {
    console.log('ready');
    bot.channels.get(errorChannelID).send(`\`${process.platform} ready\``).catch(bot.err)
});

function err(error, loadingMessage, content) {
    bot.channels.get(errorChannelID).send(error.stack, {
        code: true,
        split: true
    }).catch(function (e) {
        //bot.channels.get(errorChannelID).sendMessage(`\`${error.stack}\``).catch(function(e){
        console.log(error.stack);
        console.log(e.stack);
        console.log("maybe missing bot channel");
    })
    if (loadingMessage != null) loadingMessage.edit(content).catch(err)
}

var requestpromise = function (link) {
    return new Promise((resolve, reject) => {
        request(link, function (error, response, body) {
            if (error) reject(error);
            if (response.statusCode < 200 || response.statusCode >= 300) {
                try {
                    let data = JSON.parse(body);
                    reject (new Error(body));
                } catch (e) {
                    reject(new Error(`${response.statusCode} ${body}`))
                }
            }
            //if (response.statusCode < 200 || response.statusCode >= 300) reject(response)
            resolve(body);
        })
    })
}

let coin = {};
requestpromise("https://www.cryptocompare.com/api/data/coinlist/")
    .then(body => {
        try {
            coin = JSON.parse(body);
        } catch (e) {
            console.log(e);
        }
    })

var requestpromiseheader = function (link) {
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

var datetimeparser = function (string) {

}

bot.on('presenceUpdate', function (oldUser, newUser) {
    try {
        //if (oldUser.presence.equals(newUser.presence)) return;
        let msg = "";
        //if (oldUser.status !== newUser.status) msg+=oldUser.status + "ↁE + newUser.status;
        //console.log(newUser);
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
            //console.log(oldUser);
            //console.log(newUser);
        }

        msg = moment().format('h:mma') + " " + newUser.user.username + " (" + newUser.id + ")" + msg;

        if (lastPresenceMsg !== msg) bot.channels.get(botChannelID).send(`\`${msg}\``).catch(err);
        lastPresenceMsg = msg
    } catch (e) {
        err(e)
    }
});

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
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

function richQuote(message) {
    try {
        let rich = new Discord.RichEmbed();
        let username;
        if (message.member !== null && message.member.nickname !== null) {
            username = `${message.member.nickname} (${message.author.username}#${message.author.discriminator})`
        } else username = `${message.author.username}#${message.author.discriminator}`
        rich.setAuthor(username, message.author.displayAvatarURL)
        rich.setDescription(message.content);
        rich.setTimestamp(message.createdAt)
        return rich;
    } catch (e) {
        throw e;
    }
}



function playSound(channel, URL, setvolume, setstart, setduration) {
    try {
        setvolume = setvolume || serverVol[channel.guild] / 100 || .2;
        setstart = setstart || 0;
        //console.log(channel.guild.voiceConnection);

        let leave = function () {
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
                })
            }
            //not in a voice channel
        } else {
            channel.join().then(connnection => {
                const dispatcher = connnection.playStream(URL, {
                    seek: setstart,
                    volume: setvolume
                }).on('end', leave);
            })
        }
    } catch (e) {
        throw e;
    }
}

function combineMessAndProm(lm, rp) {
    return lm.then((loadingMessage) => {
        rp.then((args) => {
            console.log(args);
            loadingMessage.edit.apply(loadingMessage, args).catch(err);
        }).catch((error) => {
            err(error, loadingMessage, "`Error`");
        })
    }).catch(err);
}

let extraCommand = [];
let commandList = [];
//return true if message is from bot
commandList.push((message) => {
    return message.author.id === bot.user.id
});
//log message if it comes from a text channel that the admin is not a part of
commandList.push((message) => {
    if (!message.channel.members || !message.channel.members.get(adminID)) {
        try {
            let msg = `\`${moment().format('h:mma')} ${message.author.username} (${message.author.id}):\` ${message.cleanContent} \`\n${message.channel.type} channel ${(message.channel.name ? `${message.channel.name} (${message.channel.id})` : message.channel.id)}${((message.channel.guild && message.channel.guild.name) ? ` in guild ${message.channel.guild.name}` : "")}\``;
            bot.channels.get(secretChannelID).send(msg).catch(err);
        } catch (e) {
            err(e);
        }
    }
});
//remove messages from bot and error channels
commandList.push((message) => {
    if (message.channel.id === botChannelID || message.channel.id === errorChannelID) {
        message.delete().catch(err);
        return true;
    }
});
//extra custom commands
commandList.push((message) => {
    if (extraCommand[message.channel.id] != null) {
        return extraCommand[message.channel.id].onMessage(message);
    }
});
//ping
commandList.push((message) => {
    if (message.content === 'ping') {
        message.channel.send('pong');
        return true;
    }
});
//time
commandList.push((message) => {
    let a = /^\.?time$/i.exec(message.content);
    if (a) {
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
});
//k
commandList.push((message) => {
    let a = /^k$/i.exec(message.content);
    if (a) {
        let msg = `You fucking do that every damn time I try to talk to you about anything even if it's not important you just say K and to be honest it makes me feel rejected and unheard like nothing would be better that that bullshit who the fuck just says k after you tell them something important I just don't understand how you think that's ok and I swear to god you're probably just gonna say k to this but when you do you'll know that you're slowly killing me inside`;
        message.channel.send(msg).catch(err);
        return true;
    }
});
//.sv (search term)
commandList.push((message) => {
    let a = /^\.sv (.*)$/i.exec(message.content);
    if (a) {
        let lm = message.channel.send("`Loading...`");
        let rp = requestpromise({
            url: "https://shadowverse-portal.com/cards?card_name=" + encodeURIComponent(a[1]),
            headers: {
                "Accept-Language": "en-us"
            }
        }).then((body) => {
            let $ = cheerio.load(body);

            let list = [];

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
                return ["No results"];
            } else if (list.length == 1) {
                return ["", {
                    embed: list[0][1]
                }];
            } else {
                let msg = "```" + list.map((v, i) => {
                    return `${i + 1}. ${v[0]}`
                }).join("\n") + "```";
                //message.channel.sendMessage(msg).catch(err);

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
                return [msg];
            }
        });
        combineMessAndProm(lm, rp);
        return true;
    }
});
//.remindme ("message") (num) (sec/min/hour/etc)
//or .remindme ("message") (date)
commandList.push((message) => {
    let a = /^\.remindme "(.*)" (.+)$/i.exec(message.content);
    if (a) {
        let reminder = a[1];
        let timestring = a[2];
        //.remindme ("message") (num) (sec/min/hour/etc)
        let b = /^(\d+) (\w+)$/i.exec(timestring);
        if (b) {
            let num = parseInt(b[1])
            let time = moment().add(num, b[2])
            if (!time.isValid()) return;
            let now = moment();
            let rich = Discord.RichEmbed();
            rich.setTitle(reminder);
            rich.setDescription("Setting reminder to");
            rich.setTimestamp(time.toDate());
            let timeoutid = timeouts.length;
            timeouts[timeoutid] = bot.setTimeout(() => {
                message.reply(`reminder: ${reminder}`, {
                    embed: richQuote(message)
                });
            }, time - now)
            message.reply(timeoutid, {
                embed: rich
            });
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
            let now = moment();
            let rich = Discord.RichEmbed();
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

            //.remindme ("message") (date)
        } else {
            let time = moment.utc(new Date(timestring));
            if (!time.isValid()) return;
            let now = moment();
            let rich = Discord.RichEmbed();
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
        return true;
    }
})
//.cancelremindme (id)
commandList.push((message) => {
    let a = /^\.cancelremindme (\d+)$/i.exec(message.content)
    if (a) {
        if (timeouts[a[1]] != null) {
            message.reply("clearing timeout");
            bot.clearTimeout(timeouts[a[1]]);
            return true;
        }
    }
})
//.ygo (card_name)
commandList.push((message) => {
    let a = /^\.ygo (.+)$/i.exec(message.content)
    if (a) {
        requestpromise("https://www.ygohub.com/api/all_cards").then((data1) => {
            try {
                data1 = JSON.parse(data1)
            } catch (e) {
                err(e);
            }
            if (data1.status == "success") {
                let results = [];

                function card(name) {
                    return requestpromise(`https://www.ygohub.com/api/card_info?name=${encodeURIComponent(name)}`).then((data) => {
                        try {
                            data = JSON.parse(data)
                            if (data.status == "success") {
                                let rich = new Discord.RichEmbed();
                                rich.setImage(data.card.image_path)
                                rich.setTitle(name)
                                rich.setURL(`http://yugioh.wikia.com/wiki/${encodeURIComponent(name)}`)
                                if (data.card.pendulum_text) {
                                    let pendulum_text = "**"
                                    if (data.card.pendulum_left) pendulum_text += data.card.pendulum_left + ":arrow_backward:"
                                    if (data.card.pendulum_right) pendulum_text += "  " + ":arrow_forward:" + data.card.pendulum_right
                                    pendulum_text += "**\n";
                                    pendulum_text += data.card.pendulum_text;
                                    rich.addField("Pendulum", pendulum_text);
                                }
                                let text = "";
                                if (data.card.property) {
                                    text += "**" + data.card.property + "**";
                                    text += "\n";
                                }
                                if (data.card.attribute) {
                                    text += data.card.attribute;
                                    text += "\n";
                                }
                                if (data.card.stars) {
                                    text += data.card.stars + ":star: ".repeat(data.card.stars)
                                    text += "\n";
                                }
                                if (data.card.link_markers) {
                                    let ascii_arrows = {
                                        Top: ":arrow_up:",
                                        Bottom: ":arrow_down:",
                                        Left: ":arrow_left:",
                                        Right: ":arrow_right:",
                                        "Top-Left": ":arrow_upper_left:",
                                        "Top-Right": ":arrow_upper_right:",
                                        "Bottom-Left": ":arrow_lower_left:",
                                        "Bottom-Right": ":arrow_lower_right:"
                                    };
                                    for (let i = 0; i < data.card.link_markers.length; i++) {
                                        text += ascii_arrows[data.card.link_markers[i]] + " ";
                                    }
                                    text += "\n";
                                }
                                if (data.card.species) {
                                    if (data.card.monster_types) {
                                        data.card.monster_types.unshift(data.card.species);
                                        text += "**[" + data.card.monster_types.join("/") + "]**"
                                    } else {
                                        text += data.card.species
                                    }
                                    text += "\n";
                                }
                                if (data.card.materials) {
                                    text += data.card.materials;
                                    text += "\n";
                                }
                                text += data.card.text;
                                let stats = "";
                                if (data.card.attack) {
                                    stats += "ATK/" + data.card.attack
                                }
                                if (data.card.defense) {
                                    stats += " DEF/" + data.card.defense
                                }
                                if (data.card.link_number) {
                                    stats += " LINK – " + data.card.link_number
                                }
                                if (stats != "") text += "\n**" + stats + "**";
                                rich.addField(data.card.type, text);
                                if (data.card.legality && data.card.legality.TCG && data.card.legality.TCG.Advanced) rich.addField("Status", data.card.legality.TCG.Advanced);
                                let price_text = "";
                                if (data.card.price_avg) price_text += "**Average: **" + data.card.price_avg + "\n";
                                if (data.card.price_low) price_text += "**Low: **" + data.card.price_low + "\n";
                                if (data.card.price_high) price_text += "**High: **" + data.card.price_high + "\n";
                                if (price_text != "") rich.addField("Price", price_text);
                                return message.channel.send("", {
                                    embed: rich
                                });
                            }
                            return message.channel.send("`Error`");
                        } catch (e) {
                            err(e);
                        }
                    })
                }

                for (let i = 0; i < data1.cards.length; i++) {
                    let search = a[1].toLowerCase();
                    if (data1.cards[i].toLowerCase().indexOf(search) > -1) {
                        results.push(data1.cards[i]);
                        if (results.length > 11) break;
                    }
                }
                if (results.length < 1) {
                    message.channel.send("`No results.`").catch(err);
                } else if (results.length == 1) {
                    card(results[0])
                } else {
                    let msg = "```" + results.map((v, i) => {
                        return `${i + 1}. ${v}`
                    }).join("\n") + "```";
                    //message.channel.sendMessage(msg).catch(err);

                    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message) => {
                        var num = parseInt(message.content) - 1;
                        if (num < results.length && num > -1) {
                            card(results[num])
                            return true;
                        }
                        return false;
                    })
                    message.channel.send(msg);
                }
            } else {
                message.channel.send("`Could not load card list`");
            }
        })
        return true;
    }
})
//.hs (search_term)
commandList.push((message) => {
    let a = /^\.hs (.+)$/i.exec(message.content)
    if (a) {
        (async ()=>{
            try {
                let season = a[2] || 7;
                let body = await requestpromise({
                    url: "https://omgvamp-hearthstone-v1.p.mashape.com/cards/search/" + encodeURIComponent(a[1]),
                    headers: {
                        "X-Mashape-Key": apikey.hearthstone
                    }
                })
                let results = JSON.parse(body);
                function cardRich (card) {
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
                if (results.length<1) {
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
                    message.channel.send(msg);
                }
            } catch (e) {
                try {
                    let response = JSON.parse(e.message);
                    message.channel.send("`" + response.error + " " + response.message + "`");
                } catch (e) {
                    message.channel.send("`" + e.message + "`");
                }
                err(e);
            }
        })()
        return true;
        /*
        let results = [];
        for (let i = 0; i < sts.length; i++) {
            if (sts[i].title.toLowerCase().indexOf(a[1].toLowerCase()) > -1) {
                results.push(sts[i]);
            }
        }
        if (results.length < 1) {
            message.channel.send("No results");
        } else if (results.length == 1) {
            let rich = new Discord.RichEmbed();
            rich.setTitle(results[0].title);
            rich.setImage(results[0].image)
            rich.setDescription(results[0].description);
            message.channel.send("", { embed: rich });
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
            message.channel.send(msg);
        }
        return true;
        */
    }
})
//.sts (search_term)
commandList.push((message) => {
    let a = /^\.sts (.+)$/i.exec(message.content)
    if (a) {
        let results = [];
        for (let i = 0; i < sts.length; i++) {
            if (sts[i].title.toLowerCase().indexOf(a[1].toLowerCase()) > -1) {
                results.push(sts[i]);
            }
        }
        if (results.length < 1) {
            message.channel.send("No results");
        } else if (results.length == 1) {
            let rich = new Discord.RichEmbed();
            rich.setTitle(results[0].title);
            rich.setImage(results[0].image)
            rich.setDescription(results[0].description);
            message.channel.send("", { embed: rich });
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
            message.channel.send(msg);
        }
        return true;
    }
})
//.br (battlerite_name) [season_number]
commandList.push((message) => {
    let a = /^\.br (\S+)(?: (\d{1,2}))?$/i.exec(message.content)
    if (a) {
        (async () => {
            try {
                let season = a[2] || 7;
                let body = await requestpromise({
                    url: "https://api.dc01.gamelockerapp.com/shards/global/players?filter[playerNames]=" + encodeURIComponent(a[1]),
                    headers: {
                        Authorization: "Bearer " + apikey.battlerite,
                        Accept: "application/vnd.api+json"
                    }
                })
                let data = JSON.parse(body);
                
                if (data.data.length < 1) return message.channel.send("`Player name not found`");
                let player = data.data[0];
                let id_names = [];
                id_names[player.id] = player.attributes.name;


                function IdToName(ids) {
                    let promise_list = [];
                    for (let i = 0; i < ids.length; i += 6) {
                        let chunk = ids.slice(i, i + 6)
                        promise_list.push(
                            requestpromise({
                                url: "https://api.dc01.gamelockerapp.com/shards/global/players?filter[playerIds]=" + chunk.join(","),
                                headers: {
                                    Authorization: "Bearer " + apikey.battlerite,
                                    Accept: "application/vnd.api+json"
                                }
                            }).then((body) => {
                                let data = JSON.parse(body);
                                for (var i = 0; i < data.data.length; i++) {
                                    let player = data.data[i];
                                    id_names[player.id] = player.attributes.name
                                }
                                return;
                            })
                        )
                    }
                    return Promise.all(promise_list);
                }

                body = await requestpromise({
                    //934603120233869312
                    url: "https://api.dc01.gamelockerapp.com/shards/global/teams?tag[season]=" + season + "&tag[playerIds]=" + player.id,
                    headers: {
                        Authorization: "Bearer " + apikey.battlerite,
                        Accept: "application/vnd.api+json"
                    }
                })

                let team_data = JSON.parse(body).data;
                let teams = [[], [], []];
                for (let i = 0; i < team_data.length; i++) {
                    let team = team_data[i].attributes;
                    if (team.stats.placementGamesLeft == 0 || team.stats.members.length == 1) teams[team.stats.members.length - 1].push(team);
                }
                function teamCompare(a, b) {
                    if (a.stats.placementGamesLeft == 0 && b.stats.placementGamesLeft == 0) {
                        if (a.stats.league != b.stats.league) return b.stats.league - a.stats.league;
                        if (a.stats.division != b.stats.division) return a.stats.division - b.stats.division;
                        //if (a.stats.division_rating != b.stats.division_rating) return b.stats.division_rating-a.stats.division_rating;
                        return b.stats.division_rating - a.stats.division_rating;
                    }
                    return a.stats.placementGamesLeft - b.stats.placementGamesLeft;
                }
                teams[1] = teams[1].sort(teamCompare).slice(0, 5)
                teams[2] = teams[2].sort(teamCompare).slice(0, 5)
                let ids = [];
                for (let i = 0; i < teams.length; i++) {
                    for (let j = 0; j < teams[i].length; j++) {
                        for (let k = 0; k < teams[i][j].stats.members.length; k++) {
                            if (typeof (id_names[teams[i][j].stats.members[k]]) == "undefined") {
                                ids.push(teams[i][j].stats.members[k])
                                id_names[teams[i][j].stats.members[k]] = teams[i][j].stats.members[k];
                            }
                        }
                    }
                }
                await IdToName(ids);
                for (let i = 0; i < teams.length; i++) {
                    for (let j = 0; j < teams[i].length; j++) {
                        teams[i][j].stats.members = teams[i][j].stats.members.map(x => id_names[x])
                    }
                }
                function toDivisionString(league, division, placement_games) {
                    if (placement_games > 0) return "Placement: " + placement_games + " remaining";
                    let return_string = "";
                    let league_string = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Champion", "Grand Champion"];
                    if (league > -1 && league < league_string.length) {
                        return_string = league_string[league];
                    }
                    if (division > 0 && division < 6) return_string += " " + division;
                    else if (division > 0 && division < 6) return_string += " " + division;
                    return return_string;
                }
                let rich = new Discord.RichEmbed();
                rich.setTitle(player.attributes.name)
                rich.setDescription(`Level ${player.attributes.stats[26]}`)
                let stats = teams[0][0].stats;
                let field_val = toDivisionString(stats.league, stats.division, stats.placementGamesLeft);
                if (stats.placementGamesLeft < 1) field_val += " (Best: " + toDivisionString(stats.topLeague, stats.topDivision, stats.placementGamesLeft) + ")";

                rich.addField("Solo", field_val)

                function teamsToString(teams) {
                    let field_val = "";
                    for (let i = 0; i < teams.length; i++) {
                        let stats = teams[i].stats;
                        if (teams[i].name) field_val += `__**${teams[i].name}**__ **(${stats.members.join(", ")})**`
                        else field_val += `**${stats.members.join(", ")}**`
                        field_val += "\n" + toDivisionString(stats.league, stats.division, stats.placementGamesLeft)
                        if (stats.placementGamesLeft < 1) field_val += " (Best: " + toDivisionString(stats.topLeague, stats.topDivision, stats.placementGamesLeft) + ")";
                        field_val +="\n\n";
                    }
                    return field_val
                }

                if (teams[1].length>0) rich.addField("2v2", teamsToString(teams[1]))
                if (teams[2].length>0) rich.addField("3v3", teamsToString(teams[2]));
                
                
                message.channel.send("", { embed: rich })
            } catch (e) {
                message.channel.send("`Error`")
                err(e);
            }            
        })();
        return true;
    }
})
//.gw2api key (key)
commandList.push((message) => {
    let a = /^\.gw2api key ([0-9A-F-]+)$/i.exec(message.content);
    if (a) {
        gw2key[message.author.id] = a[1];
        fs.truncate("gw2key.json", 0, function () {
            fs.writeFile("gw2key.json", JSON.stringify(gw2key), function (error) {
                if (error) {
                    err(error);
                }
                message.channel.send("`Key added`").catch(err);
                return true;
            });
        });
    }
})
//.gw2api search (term)
commandList.push((message) => {
    let a = /^\.gw2api search ([^\n\r]+)$/i.exec(message.content);
    if (a) {
        //if (message.author.id !== adminID) return;
        if (!gw2key[message.author.id]) return message.channel.send("This user has no api key. Get your key at https://account.arena.net/applications and then use \".gw2api key (api key)\" to add your key.").catch(err)
        let key = gw2key[message.author.id]
        let itemname = [];
        let itemlist = [];

        let messagepromise = message.channel.send("`Loading...`")
        let bankpromise = requestpromise("https://api.guildwars2.com/v2/account/bank?access_token=" + key)
            .then(body => {
                try {
                    let data = JSON.parse(body);
                    if (data.text && data.text == "Invalid key") reject(data.text);
                    itemlist.push({
                        name: "Bank",
                        inventory: data
                    });
                } catch (e) {
                    console.log(e);
                }
                return;
            })
        let materialpromise = requestpromise("https://api.guildwars2.com/v2/account/materials?access_token=" + key)
            .then(body => {
                try {
                    let data = JSON.parse(body);
                    itemlist.push({
                        name: "Material Storage",
                        inventory: data
                    });
                } catch (e) {
                    console.log(e);
                }
                return;
            })
        let characterpromise = requestpromise("https://api.guildwars2.com/v2/characters?page=0&page_size=200&access_token=" + key)
            .then(body => {
                try {
                    let data = JSON.parse(body);
                    for (var i = 0; i < data.length; i++) {
                        var inv = [];
                        for (var j = 0; j < data[i].bags.length; j++) {
                            if (data[i].bags[j]) inv = inv.concat(data[i].bags[j].inventory);

                        }
                        //console.log(inv);
                        itemlist.push({
                            name: data[i].name,
                            inventory: inv
                        });
                    }
                } catch (e) {
                    console.log(e);
                }
                return;
            })
        let idsearch = requestpromise("http://dhuang8.com/gw2/itemidsearch.php?q=" + encodeURIComponent(a[1])).then((body) => {
            try {
                let data = JSON.parse(body);
                itemname = data;
            } catch (e) {
                console.log(e);
            }
            return;
        })

        Promise.all([bankpromise, materialpromise, characterpromise, idsearch]).then(() => {
            let matchedinventory = [];
            let promiselist = [];
            for (let i = 0; i < itemlist.length; i++) {
                matchedinventory[i] = [];
                for (let j = 0; j < itemlist[i].inventory.length; j++) {
                    if (itemlist[i].inventory[j] && itemname[itemlist[i].inventory[j].id]) {
                        matchedinventory[i].push({
                            c: itemlist[i].inventory[j].count,
                            name: itemname[itemlist[i].inventory[j].id]
                        })
                        //console.log("match");
                    }
                }
            }
            //console.log(matchedinventory);
            let msg = "`";
            let linecount = 0;
            let rich = new Discord.RichEmbed();
            let is_empty = true;
            for (let i = 0; i < matchedinventory.length; i++) {
                if (matchedinventory[i].length > 0) {
                    is_empty = false;
                    let val = ""
                    msg += itemlist[i].name + "\n";
                    for (let j = 0; j < matchedinventory[i].length; j++) {
                        msg += matchedinventory[i][j].c + " " + matchedinventory[i][j].name + "\n";
                        val += matchedinventory[i][j].c + " " + matchedinventory[i][j].name + "\n";
                        linecount++;
                    }
                    try {
                        rich.addField(itemlist[i].name, val)
                    } catch (e) {
                        messagepromise.then(loading_message => {
                            err(e, loading_message, "`Too many results. Narrow the search term.`");
                        })
                    };

                }
            }
            msg += "`";
            //console.log(msg);
            messagepromise.then(loading_message => {
                if (!is_empty) loading_message.edit("", {
                    embed: rich
                }).catch(e => {
                    err(e, loading_message, "`Too many results`");
                })
                else loading_message.edit("`No results`").catch(err)
            })
            //message.channel.sendMessage(msg).catch(err);
        }).catch((d) => {
            console.log(d);
            messagepromise.then(loading_message => {
                loading_message.edit(`\`${d}\``).catch(err)
            })
        })
        return true;
    }
})
//.price [amt] (fromsym) [tosym]
commandList.push((message) => {
    let a = /^\.price(?: (\d*(?:\.\d+)?))? (\S+)(?: (\w+))?$/i.exec(message.content);
    if (a) {
        let amt = 1;
        if (a[1]) amt = parseFloat(a[1]);
        let from = a[2].toUpperCase();
        let to = "USD";
        if (a[3]) to = a[3].toUpperCase();
        let chartpromise = requestpromise(`https://min-api.cryptocompare.com/data/histominute?fsym=${encodeURIComponent(from)}&tsym=${encodeURIComponent(to)}&limit=144&aggregate=10`).then(body => {
            try {
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
                        //time_string.push((res.Data[i].time-res.Data[0].time)/(res.Data[res.Data.length - 1].time-res.Data[0].time)*100);
                    }
                }

                /*let curDay = moment.tz(res.Data[0].time * 1000, "America/New_York").day();
                let weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                let day_string = [];
                let time_string = [];
                for (let i = 0; i < res.Data.length; i++) {
                    if (res.Data[i].close < low) low = res.Data[i].close;
                    if (res.Data[i].close > high) high = res.Data[i].close;
                    x_data.push(res.Data[i].time);
                    y_data.push(res.Data[i].close);
                    let day = moment.tz(res.Data[i].time * 1000, "America/New_York").day();
                    if (day != curDay) {
                        curDay = day;
                        day_string.push(weekdays[day]);
                        time_string.push(res.Data[i].time);
                        //time_string.push((res.Data[i].time-res.Data[0].time)/(res.Data[res.Data.length - 1].time-res.Data[0].time)*100);
                    }
                }*/
                //console.log(x_data,res.Data[0].time,res.Data[res.Data.length - 1].time)
                chart_url += "&chd=e:" + extendedEncode(x_data, res.Data[0].time, res.Data[res.Data.length - 1].time) + "," + extendedEncode(y_data, low, high);
                chart_url += "&chxr=0," + res.Data[0].time + "," + res.Data[res.Data.length - 1].time + "|1," + low + "," + high;
                chart_url += "&chxl=0:|" + hour_string.join("|");
                chart_url += "&chxp=0," + time_string.join(",");

                //add y ticks
                chart_url += "&chxs=0,,10,0,lt";

                //chart_url += "&chds=" + res.Data[0].time + "," + res.Data[res.Data.length - 1].time + "," + low + "," + high;
                //console.log(chart_url)
                return chart_url;
                //let rich = new Discord.RichEmbed();
                //rich.setImage(chart_url);
                //message.channel.send(chart_url,{embed:rich}).catch(err);
            } catch (e) {
                err(e);
            }
        })


        requestpromise(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${encodeURIComponent(from)}&tsyms=${encodeURIComponent(to)}`).then(body => {
            try {
                let res = JSON.parse(body);
                if (res.Response && res.Response === "Error") {
                    let msg = res.Message;
                    message.channel.send(`\`${msg}\``).catch(err);
                    return;
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
                chartpromise.then(chart_url => {
                    rich.setImage(chart_url);
                    message.channel.send("", {
                        embed: rich
                    }).catch(err);
                })
            } catch (e) {
                err(e);
            }
        })
        return true;
    }
})
//yt (www.youtube.com/watch)
commandList.push((message) => {
    let a = /^\.?(?:yt|YT|Yt) (?:([a-zA-Z0-9_-]{11})|(?:https?:\/\/)?(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:[^\/\s]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11}))\S*(?: (\d{1,6}))?(?: (\d{1,6}))?(?: (\d{1,3}))?$/.exec(message.content);
    if (a) {
        try {
            let voiceChannel = message.member.voiceChannel;
            if (!voiceChannel) {
                return message.reply(`Please be in a voice channel first!`).catch(err);
            }
            let stream = ytdl("https://www.youtube.com/watch?v=" + (a[1] || a[2]), {
                filter: 'audioonly'
            });
            playSound(voiceChannel, stream, a[3], a[4], a[5]);
        } catch (e) {
            err(e);
            message.channel.send("`Error`");
        };
        return true;
    }
})
//.yts (search_term) [num_results]
commandList.push((message) => {
    let a = /^\.?yts ([^\n\r]+?)(?: ([\d]{1,2}))?$/i.exec(message.content);
    if (a) {
        a[1] = encodeURIComponent(a[1]);
        var max = 6;
        if (a[2] && parseInt(a[2]) > 0 && parseInt(a[2]) < 51) max = parseInt(a[2]);
        var rp = requestpromise('https://www.googleapis.com/youtube/v3/search?part=snippet&key=' + apikey.youtube + '&type=video&maxResults=' + max + '&q=' + a[1])
        message.channel.send("`Loading...`").then(loadingMessage => {
            rp.then(body => {
                let data = JSON.parse(body);
                let msg = "";
                let rich = new Discord.RichEmbed();
                rich.setTitle("YouTube results");
                rich.setURL("https://www.youtube.com/results?search_query=" + a[1])
                for (var i = 0; i < data.items.length; i++) {
                    rich.addField(i + 1, `[${data.items[i].snippet.title}](https://youtu.be/${data.items[i].id.videoId})`, false);
                    msg += `${i + 1} <https://youtu.be/${data.items[i].id.videoId}> ${data.items[i].snippet.title}\n`;
                }
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
                                message.reply(`Please be in a voice channel first!`).catch(err);
                                return false;
                            }
                            let stream = ytdl("https://www.youtube.com/watch?v=" + data.items[num - 1].id.videoId
                                //, {                                filter: 'audioonly'                            }
                            );
                            playSound(voiceChannel, stream);
                            return true;
                        } catch (e) {
                            err(e);
                            message.channel.send("`Error`");
                        }
                    }
                    return false;
                })
            }).catch(error => {
                err(error, loadingMessage, "`Error`");
            })
        }).catch(err)
        return true;
    }
})
//.quote (message_id)
commandList.push((message) => {
    let a = /^\.quote (\d+)$/i.exec(message.content);
    if (a) {
        try {
            if (parseInt(a[1]) < 200) {
                let num = parseInt(a[1]);
                message.channel.fetchMessages({
                    limit: num + 1
                }).then(messages => {
                    message.channel.send(`\`${messages.array()[num].id}\``, {
                        embed: richQuote(messages.array()[num])
                    }).catch(err)
                }).catch(e => {
                    message.channel.send("`Quote not found.`").catch(err)
                    //err(e);
                })
            } else {
                message.channel.fetchMessage(a[1]).then(message2 => {
                    message.channel.send("", {
                        embed: richQuote(message2)
                    }).catch(err)
                }).catch(e => {
                    message.channel.send("`Quote not found.`").catch(err)
                    //err(e);
                })
            }
            return true;
        } catch (e) {
            err(e);
        }
    }
})
//eval
commandList.push((message) => {
    let a = /^\.eval ([\s\S]+)$/.exec(message.content);
    if (a) {
        if (message.author.id !== adminID) return;
        try {
            let output = eval(a[1])
            message.channel.send(output).catch(err);
            return true;
        } catch (e) {
            err(e);
        }
    }
})
//.weather (location)
function weather (content, channel) {
    let a = /^\.weather (\S.*)$/i.exec(content);
    if (a) {
        var rp = requestpromise(`http:/` + `/autocomplete.wunderground.com/aq?query=${encodeURIComponent(a[1])}`).then(body => {
            let data = JSON.parse(body);
            for (var i = 0; i < data.RESULTS.length; i++) {
                if (data.RESULTS[i].lat != "-9999.000000") break;
            }
            if (i == data.RESULTS.length) return "Location not found";
            let locName = data.RESULTS[i].name;
            let lat = data.RESULTS[i].lat;
            let lon = data.RESULTS[i].lon;
            return requestpromise('https://api.darksky.net/forecast/' + apikey.darksky + '/' + data.RESULTS[i].lat + "," + data.RESULTS[i].lon + "?units=auto&exclude=minutely").then(body => {
                let data = JSON.parse(body);
                let tM = "°C";
                if (data.flags.units == "us") tM = "°F";
                let iconNames = ["clear-day", "clear-night", "rain", "snow", "sleet", "wind", "fog", "cloudy", "partly-cloudy-day", "partly-cloudy-night"];
                let iconEmote = [":sunny:", ":crescent_moon:", ":cloud_rain:", ":cloud_snow:", ":cloud_snow:", ":wind_blowing_face:", ":fog:", ":cloud:", ":partly_sunny:", ":cloud:"];
                let rich = new Discord.RichEmbed();
                rich.setTitle("Powered by Dark Sky");
                rich.setDescription(data.daily.summary);
                rich.setURL("https://darksky.net/poweredby/");
                rich.setAuthor(locName, "", `https://darksky.net/forecast/${lat},${lon}`);
                //rich.setTitle(locName);
                //rich.setDescription(data.daily.summary);
                //rich.setURL(`https:/`+`/darksky.net/forecast/${lat},${lon}`);
                //rich.setAuthor("Powered by Dark Sky","","https://darksky.net/poweredby/");
                let iconIndex;

                let curTime = moment.tz(data.currently.time * 1000, data.timezone).format('h:ma');
                rich.addField(`${(iconIndex = iconNames.indexOf(data.currently.icon)) > -1 ? iconEmote[iconIndex] : ""}Now`, `${curTime}\n**${data.currently.temperature}${tM}**\nFeels like **${data.currently.apparentTemperature}${tM}**\n${data.currently.summary}`, true)
                for (let i = 0; i < data.daily.data.length; i++) {
                    let dayIcon = (iconIndex = iconNames.indexOf(data.daily.data[i].icon)) > -1 ? iconEmote[iconIndex] : "";
                    let dayName = moment.tz(data.daily.data[i].time * 1000, data.daily.data[i].timezone).format('dddd');

                    let timeLow = moment.tz(data.daily.data[i].temperatureMinTime * 1000, data.timezone).format('h:mma');
                    let timeHigh = moment.tz(data.daily.data[i].temperatureMaxTime * 1000, data.timezone).format('h:mma');

                    let dayDesc = `\n**${data.daily.data[i].temperatureMin}${tM}**/**${data.daily.data[i].temperatureMax}${tM}**`;
                    dayDesc += `\nFeels like **${data.daily.data[i].apparentTemperatureMin}${tM}**/**${data.daily.data[i].apparentTemperatureMax}${tM}**`;
                    dayDesc += `\n${data.daily.data[i].summary}`;
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
                return rich;
            })
        })

        channel.send("`Loading...`").then(loadingMessage => {
            rp.then(output => {
                if (typeof output == "string") loadingMessage.edit(output);
                else loadingMessage.edit("", {
                    embed: output
                });
            })
                .catch(error => {
                    err(error, loadingMessage, "`Error`");
                })
        }).catch(err)
        return true;
    }
}
commandList.push((message) => {
    return weather(message.content, message.channel);
})
//.pt (search_term) [online] [num_results]
commandList.push((message) => {
    let a = /^\.?pt ([^\r]+?)([ \n]?offline)?(?: ([\d]{1,2}))?$/i.exec(message.content);
    if (a) {
        function poesearch(a, message) {
            let lm = message.channel.send("`Loading...`").catch(err);
            let online = "x";
            if (a[2] && a[2].toLowerCase() == " offline") online = "";
            let count = 6;
            if (a[3] && parseInt(a[3]) < 21 && parseInt(a[3]) > 0) count = parseInt(a[3])
            let rp3;
            let desc_list = [];
            if (a[1].split("\n").length < 3) {
                rp3 = requestpromiseheader({
                    method: 'POST',
                    url: "http://poe.trade/search",
                    followRedirect: false,
                    //proxy:'http://localhost:8888',
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    form: {
                        league: poeleague[message.author.id],
                        name: a[1],
                        online: online,
                        buyout: "x"
                    }
                })
            } else {
                //parse multiline
                let form = {
                    league: poeleague[message.author.id],
                    online: online,
                    buyout: "x",
                    capquality: "x"
                }
                let group = a[1].split("\n--------\n");
                group.forEach((e, i, aa) => {
                    aa[i] = e.split("\n")
                })
                //console.log(group);
                if (group[0][0] === "Rarity: Unique") {
                    form.name = group[0][group[0].length - 2] + " " + group[0][group[0].length - 1];
                    form.rarity = "unique";
                    desc_list.push(`**Name: ${group[0][group[0].length - 2]} ${group[0][group[0].length - 1]}**`);
                    desc_list.push(`**Rarity: Unique**`);
                } else if (group[0][group[0].length - 1] === "Stygian Vise") {
                    desc_list.push(`**Name: Stygian Vise**`);
                    form.name = group[0][group[0].length - 1];
                } else if (group[0][0] === "Rarity: Rare") {
                    //$("#base").parent().find(".chosen-drop .chosen-results").children().each((i,e)=>{if ($(e).attr("class")=="group-result"){curr=$(e).text();a[curr]=[]} else {a[curr].push($(e).text())}})
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
                                else if (b = /^(\+)(\d+)( to maximum Life)/.exec(e)) {
                                    totalhealth += parseInt(b[2]);
                                }
                                else if (b = /^(\+?)(\d+(?:\.\d+)?)(%?.+)$/.exec(e)) {
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
                                    desc_list.push(`Group total (min: ${totalresist + totalhealth})`);
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
                rp3 = requestpromiseheader({
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
            let rp2 = rp3.then((res) => {
                let link = res.headers.location;
                return requestpromise({
                    method: 'POST',
                    url: link,
                    //proxy: 'http://localhost:8888',
                    followRedirect: false,
                    method: "post",
                    body: "sort=price_in_chaos&bare=true",
                    gzip: true,
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "Accept-Encoding": "gzip"
                    }
                }).then((body) => {
                    //console.log(body.substr(0,10));
                    let $ = cheerio.load(body);
                    //console.log(body);
                    let rich = new Discord.RichEmbed();
                    rich.setTitle("Results - " + poeleague[message.author.id]);
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
                        //console.log(title)
                        let desc = $(e).attr("data-buyout");
                        desc += "\n" + $(e).find(".found-time-ago").text().trim();
                        desc += "\n" + $(e).find(".bottom-row .success.label").text().trim();
                        rich.addField(title, desc, true)
                    })
                    return [link, {
                        embed: rich
                    }];
                }).catch((e) => {
                    setLeague("Update your league", lm, message);
                    return;
                    //err(e, loadingMsg, "`Error loading poe.trade`");
                })
            })
            Promise.all([lm, rp2]).then((things) => {
                things[0].edit.apply(things[0], things[1]).catch(err);
            })
        }
        function setLeague(top, loadingmessage, message, checked) {
            let rp = requestpromise("http://api.pathofexile.com/leagues?type=main&compact=0");
            loadingmessage.then((loadingMessage) => {
                rp.catch((e) => {
                    err(e, loadingMessage, "`Error loading PoE API`");
                })
            })
            Promise.all([loadingmessage, rp]).then((things) => {
                try {
                    let msg = top + " ```";
                    let data2 = JSON.parse(things[1]);
                    let data = [];
                    for (let i = 0; i < data2.length; i++) {
                        let solo = false;
                        for (let j = 0; j < data2[i].rules.length; j++) {
                            if (data2[i].rules[j].id === 24) {
                                solo = true;
                                break;
                            }
                        }
                        if (!solo) data.push(data2[i]);
                    }
                    if (!checked) {
                        if (data.indexOf(poeleague[message.author.id]) > -1) {
                            return things[0].edit("`Error loading poe.trade`");
                        }
                    }
                    for (let i = 0; i < data.length; i++) {
                        msg += "" + (i + 1) + ". " + data[i].id + "\n";
                    }
                    msg += "```";
                    extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message2) => {
                        if (message2.author.id !== message.author.id) return false;
                        var num = parseInt(message2.content) - 1;
                        if (num < data.length && num > -1) {
                            poeleague[message.author.id] = data[num].id;
                            fs.truncate("poeleague.json", 0, function () {
                                fs.writeFile("poeleague.json", JSON.stringify(poeleague), function (err) {
                                    if (err) {
                                        return console.log("Error writing file: " + err);
                                    }
                                    //message2.channel.sendMessage(`\`PoE league is set to ${data[num].id}\``).catch(err);
                                    poesearch(a, message)
                                });
                            });
                            return true;
                        }
                        return false;
                    })
                    things[0].edit(msg);
                } catch (e) {
                    err(e);
                }
            })
        }
        if (poeleague[message.author.id]) {
            poesearch(a, message);
        } else {
            let loadingmessage = message.channel.send("`Loading league list`");
            let msg = message.author + "`It seems like you haven't set your league yet. Respond with the number to set your league.` ```";
            setLeague(msg, loadingmessage, message, true);
        }
        return true;
    }
})
//.pt
commandList.push((message) => {
    let a = /^\.?pt$/i.exec(message.content);
    if (a) {
        var msg = "`.pt (search term) [online] [num of results]`";
        message.channel.send(msg).catch(err);
        return true;
    }
})
//.roll (max_roll)
commandList.push((message) => {
    let a = /^\.roll (\d+)$/i.exec(message.content);
    if (a) {
        if (parseInt(a[1]) > 0) {
            var msg = "`" + (Math.floor(Math.random() * parseInt(a[1])) + 1) + "`";
            message.channel.send(msg).catch(err);
            return true;
        }
    }
})
//.roll (#d#)
commandList.push((message) => {
    let a = /^\.roll (\d+)?d(\d+)(\+\d+)?$/i.exec(message.content);
    if (a) {
        let num_dice = parseInt(a[1]) || 1;
        let dice_side = parseInt(a[2]);
        if (num_dice > 0 && num_dice < 1000 && dice_side > 0) {
            let msg = "`(";
            let rolls = [];
            //var msg = "`" + (Math.floor(Math.random() * parseInt(a[2])) + 1) + "`";
            for (let n = 0; n < num_dice; n++) {
                rolls.push(Math.floor(Math.random() * dice_side) + 1);
            }
            msg += rolls.join(" + ") + ")";
            let total = rolls.reduce((acc, cur) => acc + cur, 0);
            if (a[3]) {
                total += parseInt(a[3]);
                msg += " + " + parseInt(a[3]);
            }
            msg += "`= " + total;
            message.channel.send(msg).catch(err);
            return true;
        }
    }
})
//(00:00 am est)
commandList.push((message) => {
    //
    let a = /(\d{1,2}(?::\d{2})? ?(?:[ap]m)?) ?(est|cst|pst|nzdt|jst|utc|edt|cdt|pdt)/i.exec(message.content);
    if (a) {
        //var msg = '`test ' + a[1];
        let shortZones = ["est", "cst", "pst", "nzdt", "jst", "utc", "edt", "cdt", "pdt"];
        let fullZones = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC", "America/New_York", "America/Chicago", "America/Los_Angeles"];
        let fullZones2 = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC"];
        let fullName = fullZones[shortZones.indexOf(a[2].toLowerCase())];
        //msg += fullName;
        let inputTime = moment.tz(a[1], "h:mma", fullName).subtract(1, 'days');
        if (!inputTime.isValid()) return;
        if (inputTime.diff(moment()) < 0) {
            inputTime.add(1, 'days');
        }
        if (inputTime.diff(moment()) < 0) {
            inputTime.add(1, 'days');
        }
        let msg = "`" + inputTime.valueOf() + "\n" + inputTime.fromNow();
        for (let i = 0; i < fullZones2.length; i++) {
            msg += "\n" + inputTime.tz(fullZones2[i]).format('ddd, MMM Do YYYY, h:mma z');
        }
        msg += "`";
        message.channel.send(msg).catch(err);
        return true;
    }
})
//fuck (you|u) (something)
commandList.push((message) => {
    let a = /^fuck (?:you |u )?(\S+)$/i.exec(message.content);
    if (a) {
        if (a[1].toLowerCase() === "you" || a[1].toLowerCase() === "u" || a[1].toLowerCase() === "this" || a[1].toLowerCase() === "that") return;
        let subject = a[1];
        message.channel.send(`I think its hilarious u kids talking shit about ${subject}. u wouldnt say this shit to ${subject} at lan. not only that but ${subject} wears the freshest clothes, eats at the chillest restaurants and hangs out with the hottest dudes. yall are pathetic lol`);
        return true;
    }
})
//whens (something)
commandList.push((message) => {
    let a = /^(whens|when's|when is|when are).+$/i.exec(message.content);
    if (a) {
        var responses = ["never" /*,"soon™"*/]
        var msg = responses[Math.floor(Math.random() * responses.length)];
        message.channel.send(msg).catch(err);
        return true;
    }
})
//wat
commandList.push((message) => {
    let a = /^(what|wat)\??$/i.exec(message.content)
    if (a) {
        message.channel.fetchMessages({
            limit: 1,
            before: message.id
        }).then(theMsgs => {
            console.log(theMsgs);
            message.channel.send(theMsgs.first().content.toUpperCase()).catch(err);
        }).catch(err);
        return true;
    }
})
//jonio
commandList.push((message) => {
    if (message.content.toLowerCase() == "jonio") {
        let msg = "http://www.dhuang8.com/gg/";
        message.channel.send(msg).catch(err);
        return true;
    }
})
//.addmeme (copy_pasta)
commandList.push((message) => {
    let a = /^\.?addmeme ([\s\S]+)$/.exec(message.content);
    if (a) {
        fs.appendFileSync("../copypasta.txt", "\x0d\x0a\x0d\x0a\x20\x0d\x0a\x0d\x0a" + a[1], 'utf8')
        copypasta.push(a[1]);
        let msg = "added meme " + (copypasta.length - 1);
        message.channel.send(msg).catch(err);
        return true;
    }
})
//.searchmeme (search_term)
commandList.push((message) => {
    let a = /^\.?searchmeme ([^\n\r]+?)$/i.exec(message.content.toLowerCase());
    if (a) {
        var copylist = [];
        for (var n = 0; n < copypasta.length; n++) {
            if (copypasta[n].indexOf(a[1]) > -1) {
                copylist.push(n);
            }
        }
        var msg = "`None found`";
        if (copylist.length === 1) {
            msg = copylist[0] + "\n";
            msg += copypasta[copylist[0]];
        } else if (copylist.length > 1) {
            msg = "`Multiple memes found: ";
            for (var m = 0; m < copylist.length; m++) {
                msg += copylist[m] + " ";
            }
            msg += "`";
        }
        message.channel.send(msg).catch(err);
        return true;
    }
})
//.volume (num)
commandList.push((message) => {
    let a = /^\.?(?:volume|setvolume|vol) (\d{1,3})$/i.exec(message.content);
    if (a) {
        if (a[1] && parseInt(a[1]) > 0 && parseInt(a[1]) < 101) {
            serverVol[message.channel.guild] = a[1];
            let msg = "`Default server volume set to " + serverVol[message.channel.guild] + "`";
            message.channel.send(msg).catch(err);
            if (message.channel.guild.voiceConnection != null && message.channel.guild.voiceConnection.dispatcher != null) {
                message.channel.guild.voiceConnection.dispatcher.setVolume(serverVol[message.channel.guild] / 100);
            }
        } else {
            let msg = "`" + a[1] + " is not a valid parameter.`";
            message.channel.send(msg).catch(err);
        }
        return true;
    }
})
//.volume
commandList.push((message) => {
    let a = /^\.?(?:volume|setvolume|vol)$/i.exec(message.content);
    if (a) {
        let vol = serverVol[message.guild] || 20;
        let msg = "`Default server volume set to " + vol + "`";
        message.channel.send(msg).catch(err);
        return true;
    }
})
//i miss the old ___
//I miss the old qt, straight from the go qt, chop up the soul qt, set on his goals qt, I hate the new qt, the bad mood qt, the always rude qt, spaz in the news qt, I miss the sweet qt, chop up the beats qt, I got to say at that time I'd like to meet qt, see, I invented qt, it wasn't any qts, and now I look and look around there's so many qts, I used to love qt, I used to love qt, I even had the pink polo I thought I was qt, what if qt made a song about qt called 'I miss the old qt' Man, that'd be so qt. That's all it was qt, we still love qt, and I love you like qt loves qt.
//meme (num)
commandList.push((message) => {
    let a = /^\.?meme ([\d]+?)$/i.exec(message.content);
    if (a) {
        a[1] = parseInt(a[1]);
        var msg = "";
        if (a[1] >= copypasta.length) msg = "`Max meme number is " + (copypasta.length - 1) + "`";
        else msg = copypasta[a[1]];
        message.channel.send(msg).catch(err);
        return true;
    }
})
//meme
commandList.push((message) => {
    if (message.content.toLowerCase().indexOf("meme") > -1) {
        var msg = copypasta[Math.floor(Math.random() * copypasta.length)];
        message.channel.send(msg).catch(err);
        return true;
    }
})
//botlink
commandList.push((message) => {
    let a = /^botlink$/i.exec(message.content.toLowerCase());
    if (a) {
        if (message.author.id !== adminID) return;
        var msg = `<${botlink}>`;
        message.channel.send(msg).catch(err);
        return true;
    }
})
//bad bot
commandList.push((message) => {
    let a = /(^| )(bad|dumb|stupid|shit) bot($| |\.)/i.exec(message.content);
    if (a) {
        let msg = "sorry";
        message.channel.send(msg).catch(err);
        return true;
    }
})
//dat boi
commandList.push((message) => {
    if (message.content.toLowerCase().indexOf("dat boi") > -1) {
        var msg = "✋🐸✋🐸✋🐸✋🐸 o *** waddup 👋 here 🚲 come dat bଠi🚲🚲 right🚲🚲th 🐸 ere✋✋✁Edat 🐸 boi ✔🐸 ✔if dat boi 🐸 ƽai so 💯 i sai so 💯 thats what im talking about right there 🚲 o *** (chorus: ଠ sʰᶦᵁE mMMMMᎷМ💯 ✋✋O0Оଠ�E�OO�E�OОଠଠOoooᵒᵒᵒᵒᵒᵒᵒᵒᵒ✋ ✁E✁E✁E💯 🐸🐸🐸 👋👋 waddup";
        message.channel.send(msg).catch(err);
        return true;
    }
})
//animal
commandList.push((message) => {
    if (message.content.toLowerCase().indexOf("animal") > -1) {
        //upload animal
        //sendFiles(channelID, ["html/animalgifs/"+Math.floor(Math.random()*61+1)+".gif"]);
        let attach = new Discord.Attachment("animalgifs/" + Math.floor(Math.random() * 61 + 1) + ".gif");
        message.channel.send(attach).catch(err);
        return true;
    }
})
//im (whatever)
commandList.push((message) => {
    let a = /(?:^|(?:\.|,) )(?:\w+ )?(?:im|i'm)((?: \w+){1})(?:\.|$)/i.exec(message.content.toLowerCase());
    if (a) {
        let greetings = ["Hello", "Hi", "Hey"]
        let responses = ["Nice to see you.", ""]
        if (message.guild.me.nickname) {
            responses.push(`I'm ${message.guild.me.nickname}`)
        }
        let response = responses[parseInt(Math.random() * responses.length)];
        let greeting = greetings[parseInt(Math.random() * greetings.length)];
        var msg = `${greeting}${a[1]}. ${response}`;
        message.channel.send(msg).catch(err);
        return true;
    }
})
//setpoeleague
commandList.push((message) => {
    if (message.content.toLowerCase() == "setpoeleague") {
        let loadingmessage = message.channel.send("`Loading league list`");
        let rp = requestpromise("http://api.pathofexile.com/leagues?type=main&compact=0");
        loadingmessage.then((loadingMessage) => {
            rp.catch((e) => {
                err(e, loadingMessage, "`Error`");
            })
        })
        Promise.all([loadingmessage, rp]).then((things) => {
            try {
                let msg = "```";
                let data2 = JSON.parse(things[1]);
                let data = [];
                for (let i = 0; i < data2.length; i++) {
                    let solo = false;
                    for (let j = 0; j < data2[i].rules.length; j++) {
                        if (data2[i].rules[j].id === 24) {
                            solo = true;
                            break;
                        }
                    }
                    if (!solo) data.push(data2[i]);
                }

                for (let i = 0; i < data.length; i++) {
                    msg += "" + (i + 1) + ". " + data[i].id + "\n";
                }
                msg += "```";
                extraCommand[message.channel.id] = new CustomCommand(/^(\d+)$/, (message2) => {
                    if (message2.author.id !== message.author.id) return false;
                    var num = parseInt(message2.content) - 1;
                    if (num < data.length && num > -1) {
                        poeleague[message.author.id] = data[num].id;
                        fs.truncate("poeleague.json", 0, function () {
                            fs.writeFile("poeleague.json", JSON.stringify(poeleague), function (err) {
                                if (err) {
                                    return console.log("Error writing file: " + err);
                                }
                                message2.channel.send(`\`PoE league is set to ${data[num].id}\``).catch(err);
                            });
                        });
                        return true;
                    }
                    return false;
                })
                things[0].edit(msg);
            } catch (e) {
                err(e);
            }
        })
        return true;
    }
})
//stop
commandList.push((message) => {
    let a = /stop/i.exec(message.content);
    if (a) {
        let server = message.channel.guild;
        if (server.voiceConnection != null /* && server.voiceConnection.player!=null && server.voiceConnection.player.streams !=null && server.voiceConnection.player.streams.first().dispatcher !=null*/) {
            //server.voiceConnection.player.streams.first().dispatcher.removeAllListeners('end');
            //server.voiceConnection.player.streams.first().dispatcher.end();
            server.voiceConnection.disconnect();
            return true;
        }
    }
})

bot.on('message', (message) => {
    if (commandList.some((v) => {
        return v(message)
    })) return;
});
bot.login(token);