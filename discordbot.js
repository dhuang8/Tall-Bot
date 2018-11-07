"use strict";
const Discord = require('discord.js');
const request = require('request');
const fs = require('fs');
const execFile = require('child_process').execFile;
const testclass = require('./utils/addcommands');
const moment = require('moment-timezone');

let lastPresenceMsg = "";

const bot = new Discord.Client({
    apiRequestMethod: "burst"
});

//create file if it does not exist
//setTimeout(()=>{

let timeouts = [];

var serverVol = {};

let copypasta = [];
let silence = {};
/*
fs.readFile("../copypasta.txt", 'utf8', function (e, data) {
    if (e) {
        return console.log(e);
    }
    copypasta = data.split("\x0d\x0a\x0d\x0a\x20\x0d\x0a\x0d\x0a")
})
*/
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

let t7 = {};
fs.readFile("t7/t7.json", 'utf8', function (e, data) {
    if (e) {
        return console.log(e);
    }
    t7 = JSON.parse(data);
})
/*
fs.readFile("t7/character_misc.json", 'utf8', function (e, data) {
    if (e) {
        return console.log(e);
    }
    data = JSON.parse(data);
    for (var i=0;i<data.length;i++) {
        let obj = data[i];
        fs.readFile("t7/" + obj.local_json, 'utf8', (e2, data2)=>{
            if (e) {
                return console.log(e);
            }
            t7[obj.name] = JSON.parse(data2);
        })
    }
})*/

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

        if (lastPresenceMsg !== msg) bot.channels.get(config.botChannelID).send(`\`${msg}\``).catch(err);
        lastPresenceMsg = msg;
    } catch (e) {
        console.error(e);
        //err(e)
    }
});

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
        bot.channels.get(botChannelID).send(`\`${msg}\``).catch(err);
    } catch (e) {
        err(e)
    }
})

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
        let username = message.author.username;
        /*
        if (message.member !== null && message.member.nickname !== null) {
            username = `${message.member.nickname} (${message.author.username}#${message.author.discriminator})`
        } else username = `${message.author.username}#${message.author.discriminator}`
        */
        //rich.setURL("http://www.google.com");
        //rich.setURL(`https://discordapp.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`);
        rich.setAuthor(username, message.author.displayAvatarURL, `https://discordapp.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`)
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
            //console.log(args);
            loadingMessage.edit.apply(loadingMessage, args).catch(err);
        }).catch((error) => {
            err(error, loadingMessage, "`Error`");
        })
    }).catch(err);
}

let extraCommand = [];
let commandList = [];
commandList = testclass.getCommands(bot)
bot.on('message', (message) => {
    if (commandList.some((v) => {
        return v.run(message)
    })) return;
});