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
const token = config.token;
const botlink = config.botlink;

let lastPresenceMsg = "";
moment.tz.setDefault("America/New_York");

const bot = new Discord.Client();

let timeouts = [];

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
                    body = JSON.parse(body);
                    reject(body.text);
                } catch (e) {
                    reject(`${response.statusCode} ${body}`)
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
            username = `${message.member.nickname}(${message.author.username}#${message.author.discriminator})`
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
        setvolume = setvolume || .3;
        setstart = setstart || 0;
        //console.log(channel.guild.voiceConnection);

        if (channel.guild.voiceConnection != null && channel.guild.voiceConnection.player != null && channel.guild.voiceConnection.player.streams != null) {
            if (channel.guild.voiceConnection.channel.equals(channel)) {
                //console.log(111)
                //console.log(channel.guild.voiceConnection.player.streams.first());
                //console.log(channel.guild.voiceConnection.player.prism.transcoder);
                channel.guild.voiceConnection.player.streams.first().dispatcher.removeAllListeners('end');
                channel.guild.voiceConnection.player.streams.first().dispatcher.end();

                const dispatcher = channel.guild.voiceConnection.playStream(URL, {
                    seek: setstart,
                    volume: setvolume
                });
                dispatcher.on('end', () => {
                    channel.leave();
                });
            } else {
                //console.log(222)
                channel.guild.voiceConnection.player.streams.first().dispatcher.removeAllListeners('end');
                channel.guild.voiceConnection.player.streams.first().dispatcher.end();

                channel.join().then(connnection => {
                    const dispatcher = connnection.playStream(URL, {
                        seek: setstart,
                        volume: setvolume
                    });
                    dispatcher.once('end', () => {
                        channel.leave();
                    });
                })
            }
        } else {
            //console.log(333)
            channel.join().then(connnection => {
                const dispatcher = connnection.playStream(URL, {
                    seek: setstart,
                    volume: setvolume
                });
                dispatcher.once('end', () => {
                    channel.leave();
                });
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
            loadingMessage.edit.apply(loadingMessage,args).catch(err);
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
            let msg = `\`${moment().format('h:mma')} ${message.author.username} (${message.author.id}) said ${message.content} in ${message.channel.type} channel ${(message.channel.name ? `${message.channel.name} (${message.channel.id})` : message.channel.id)}${((message.channel.guild && message.channel.guild.name) ? ` in guild ${message.channel.guild.name}` : "")}\``;
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
        let msg = fullZones.map((v) => {
            inputTime.tz(v).format('ddd, MMM Do YYYY, h:mma z')
        }).join("\n");
        msg = "`" + msg + "`";
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
            console.log($);

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
            rich.setTimestamp(time);
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
        b = /(\d{1,2}(?::\d{2})? ?[ap]m) (est|cst|pst|nzdt|jst|utc)/i.exec(timestring);
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
        let chartpromise = requestpromise(`https://min-api.cryptocompare.com/data/histominute?fsym=${encodeURIComponent(from)}&tsym=${encodeURIComponent(to)}&limit=2000&aggregate=10`)
            .then(body => {
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
                    let curDay = moment.tz(res.Data[0].time * 1000, "America/New_York").day();
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
                    }
                    //console.log(x_data,res.Data[0].time,res.Data[res.Data.length - 1].time)
                    chart_url += "&chd=e:" + extendedEncode(x_data, res.Data[0].time, res.Data[res.Data.length - 1].time) + "," + extendedEncode(y_data, low, high);
                    chart_url += "&chxr=0," + res.Data[0].time + "," + res.Data[res.Data.length - 1].time + "|1," + low + "," + high;
                    chart_url += "&chxl=0:|" + day_string.join("|");
                    chart_url += "&chxp=0," + time_string.join(",");
                    //chart_url += "&chds=" + res.Data[0].time + "," + res.Data[res.Data.length - 1].time + "," + low + "," + high;
                    return chart_url;
                    //console.log(chart_url)
                    //let rich = new Discord.RichEmbed();
                    //rich.setImage(chart_url);
                    //message.channel.send(chart_url,{embed:rich}).catch(err);
                } catch (e) {
                    err(e);
                }
            })


        requestpromise(`https://min-api.cryptocompare.com/data/price?fsym=${encodeURIComponent(from)}&tsyms=${encodeURIComponent(to)}`)
            .then(body => {
                try {
                    let res = JSON.parse(body);
                    if (res.Response && res.Response === "Error") {
                        let msg = res.Message;
                        message.channel.send(`\`${msg}\``).catch(err);
                        return;
                    }
                    let to_amt = amt * parseFloat(res[to]);
                    let rich = new Discord.RichEmbed();
                    let image = "";
                    console.log(coin);
                    if (coin && coin.Data[from]) {
                        image = "https://www.cryptocompare.com" + coin.Data[from].ImageUrl
                        from += ` (${coin.Data[from].CoinName})`;
                    }
                    if (coin && coin.Data[to]) to += ` (${coin.Data[to].CoinName})`;
                    let msg = `${amt} ${from} = ${to_amt} ${to}`;
                    //rich.setDescription(msg)
                    //rich.setFooter(msg,image)
                    rich.setAuthor(msg, image);
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
//yts (search_term) [num_results]
commandList.push((message) => {
    let a = /^\.?yts ([^\n\r]+?)(?: ([\d]{1,2}))?$/i.exec(message.content);
    if (a) {
        a[1] = encodeURIComponent(a[1]);
        var max = 6;
        if (a[2] && parseInt(a[2]) > 0 && parseInt(a[2]) < 51) max = parseInt(a[2]);
        var rp = requestpromise('https://www.googleapis.com/youtube/v3/search?part=snippet&key='+config.api.youtube+'&type=video&maxResults=' + max + '&q=' + a[1])
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
                            let stream = ytdl("https://www.youtube.com/watch?v=" + data.items[num - 1].id.videoId, {
                                filter: 'audioonly'
                            });
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
commandList.push((message) => {
    let a = /^\.weather (\S.*)$/i.exec(message.content);
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
            return requestpromise('https://api.darksky.net/forecast/'+darksky+'/' + data.RESULTS[i].lat + "," + data.RESULTS[i].lon + "?units=auto&exclude=minutely,hourly").then(body => {
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
                return rich;
            })
        })

        message.channel.send("`Loading...`").then(loadingMessage => {
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
})
//.pt (search_term) [online] [num_results]
commandList.push((message) => {
    let a = /^\.?pt ([^\r]+?)([ \n]?online)?(?: ([\d]{1,2}))?$/i.exec(message.content);
    if (a) {
        function poesearch(a, message) {
            let lm = message.channel.send("`Loading...`")
            let online = "";
            if (a[2] && a[2].toLowerCase() == " online") online = "x";
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
                if (group[0][0] === "Rarity: Unique") {
                    form.name = group[0][group[0].length - 2] + " " + group[0][group[0].length - 1];
                    form.rarity = "unique";
                    desc_list.push(`**Name: ${group[0][group[0].length-2]} ${group[0][group[0].length-1]}**`);
                    desc_list.push(`**Rarity: Unique**`);
                }
                //TODO rare
                //switch form to a string
                let formstring = Object.keys(form).map((e) => {
                    return `${e}=${encodeURIComponent(form[e])}`
                }).join("&");

                if (group[group.length - 1][group[group.length - 1].length - 1] !== "x") {
                    let itemlevel = group.findIndex((e) => {
                        return e[0].match(/Item Level: (\d+)/g)
                    });
                    if (itemlevel > -1) {
                        itemlevel++;
                        if (group[itemlevel][0] !== "Unidentified") {
                            let group_count = 0;
                            if (group[itemlevel].length === 1) {
                                group[itemlevel][0].replace(/^(\+?)(\d+)(%?.+)$/, (m, p1, p2, p3) => {
                                    formstring += `&mod_name=${replaceAll("%28implicit%29+"+encodeURIComponent(p1+"#"+p3),"%20","+")}&mod_min=${p2}&mod_max=`;
                                    desc_list.push(`(implicit) ${p1}#${p3} (min: ${p2})`);
                                    group_count++;
                                });
                                itemlevel++;
                            }
                            group[itemlevel].forEach((e) => {
                                e.replace(/^(\+?)(\d+)(%?.+)$/, (m, p1, p2, p3) => {
                                    formstring += `&mod_name=${replaceAll(encodeURIComponent(p1+"#"+p3),"%20","+")}&mod_min=${p2}&mod_max=`;
                                    desc_list.push(`${p1}#${p3} (min: ${p2})`);
                                    group_count++;
                                });
                            })
                            formstring += "&group_type=And&group_min=&group_max=&group_count=" + group_count;
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
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                    }
                }).then((body) => {
                    let regex = /<tbody[\s\S]+?data-buyout=\"([^\r\n]+)\"[\s\S]+?data-name=\"([^\r\n]+)\"[\s\S]+?<td class="item-cell">[\s\S]+?(?:<span class="label success corrupted">(corrupted)<\/span>[\s\S]+?)?<span class=\"found-time-ago\">([0-9a-zA-Z ]*?)<\/span>[\s\S]+?(?:<span class="success label">(online)<\/span>[^\r\n]+)?<\/tbody>/g;
                    let a = regex.exec(body);
                    if (a) {
                        let rich = new Discord.RichEmbed();
                        rich.setTitle("Results - " + poeleague[message.author.id]);
                        rich.setDescription(desc_list.join("\n"));
                        rich.setURL(link);
                        rich.setFooter('Type "setpoeleague" to change your PoE league')
                        let msg = "";
                        while (a && count > 0) {
                            let title = "";
                            let desc = "";
                            title += htmldecode(a[2]);
                            if (a[3]) title += " (" + a[3] + ")"
                            msg += " : " + a[1];
                            desc = a[1];
                            if (a[4] && a[4].length > 0) desc += "\n" + a[4]
                            if (a[5]) desc += "\n" + a[5]
                            msg += "\n"
                            count--;
                            a = regex.exec(body)
                            rich.addField(title, desc, true)
                        }
                        msg += link
                        return [link, {
                            embed: rich
                        }];
                    } else {
                        let msg = `\`No search results found - ${poeleague[message.author.id]}\`\n${link}`;
                        return [msg];
                    }
                });
            })
            lm.then((loadingMsg) => {
                rp2.catch((e) => {
                    err(e, loadingMsg, "`Error loading poe.trade`");
                })
            })
            Promise.all([lm, rp2]).then((things) => {
                things[0].edit.apply(things[0], things[1]).catch(err);
            })
        }
        if (poeleague[message.author.id]) poesearch(a, message);
        else {
            let loadingmessage = message.channel.send("`Loading league list`");
            let rp = requestpromise("http://api.pathofexile.com/leagues?type=main&compact=0");
            loadingmessage.then((loadingMessage) => {
                rp.catch((e) => {
                    err(e, loadingMessage, "`Error loading PoE API`");
                })
            })
            Promise.all([loadingmessage, rp]).then((things) => {
                try {
                    let msg = message.author + "`It seems like you haven't set your league yet. Respond with the number to set your league.` ```";
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
    let a = /^\.roll (\d+)d(\d+)(\+\d+)?$/i.exec(message.content);
    if (a) {
        let num_dice = parseInt(a[1]);
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
//(0:00 am est)
commandList.push((message) => {
    let a = /(\d{1,2}(?::\d{2})? ?[ap]m) (est|cst|pst|nzdt|jst|utc)/i.exec(message.content);
    if (a) {
        //var msg = '`test ' + a[1];
        let shortZones = ["est", "cst", "pst", "nzdt", "jst", "utc"];
        let fullZones = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC"];
        let fullName = fullZones[shortZones.indexOf(a[2])];
        //msg += fullName;
        let inputTime = moment.tz(a[1], "h:mma", fullName).subtract(1, 'days');
        if (!inputTime.isValid()) return;
        if (inputTime.diff(moment()) < 0) {
            inputTime.add(1, 'days');
        }
        if (inputTime.diff(moment()) < 0) {
            inputTime.add(1, 'days');
        }
        let msg = "`" + inputTime.fromNow();
        for (let i = 0; i < fullZones.length; i++) {
            msg += "\n" + inputTime.tz(fullZones[i]).format('ddd, MMM Do YYYY, h:mma z');
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
    let a = /^(whens|when's|when is|when are).+$/.exec(message.content);
    if (a) {
        var responses = ["never" /*,"soon™"*/ ]
        var msg = responses[Math.floor(Math.random() * responses.length)];
        message.channel.send(msg).catch(err);
        return true;
    }
})
//wat
commandList.push((message) => {
    let a = /^(what|wat)\??$/.exec(message.content)
    if (a) {
        message.channel.fetchMessages({
            limit: 1,
            before: message.id
        }).then(theMsgs => {
            //console.log(theMsgs);
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
    let a = /^\.?searchmeme ([^\n\r]+?)$/.exec(message.content.toLowerCase());
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
//meme (num)
commandList.push((message) => {
    let a = /^\.?meme ([\d]+?)$/.exec(message.content);
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
    let a = /^botlink$/.exec(message.content.toLowerCase());
    if (a) {
        if (message.author.id !== adminID) return;
        var msg = `<${botlink}>`;
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
        let attach = new Discord.Attachment("/var/www/html/animalgifs/" + Math.floor(Math.random() * 61 + 1) + ".gif");
        message.channel.send(attach).catch(err);
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
        if (server.voiceConnection != null /* && server.voiceConnection.player!=null && server.voiceConnection.player.streams !=null && server.voiceConnection.player.streams.first().dispatcher !=null*/ ) {
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