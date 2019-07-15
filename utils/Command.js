"use strict";
const Discord = require('discord.js');
const discordbot = require('../discordbot');


function err(error, message) {
    if (discordbot.config.errorChannelID) {
        let messageString = "";
        if (message) {
            messageString = message.author.tag + ": " + message.cleanContent;
        }
        discordbot.bot.channels.get(discordbot.config.errorChannelID).send(`${messageString}\n${error.stack}`, {
            code: true,
            split: true,
            reply: discordbot.config.adminID || null
        }).catch(function (e) {
            console.error(error.stack);
            console.error(e.stack);
            console.error("maybe missing bot channel");
        })
    } else {
        console.error(error);
    }
}

class Command {
    constructor(options) {
        if (!options || !options.name) throw new Error("missing options, name, regex, or function");
        this.name = options.name;
        this.prefix = (typeof options.prefix=="string")? options.prefix:".";
        //require prefix
        this.requirePrefix = options.requirePrefix || false;
        this.shortDesc = options.shortDesc || "";
        this.longDesc = options.longDesc || "";
        this.testString = options.testString || "";
        this.hidden = options.hidden || false;
        if ("typing" in options) this.typing = options.typing;
        else this.typing = !this.hidden;
        
        //won't run if one is false
        options.prerun = options.prerun || options.softAsserts;
        if (options.prerun) {
            if (!Array.isArray(options.prerun)) {
                this.softAsserts = [options.prerun];
            } else {
                this.softAsserts = options.prerun;
            }
        } else {
            this.softAsserts = [];
        }
        
        //same as softasserts but also will not show up in help if 1 is false
        options.req = options.req || options.hardAsserts;
        if (options.req) {
            if (!Array.isArray(options.req)) {
                this.hardAsserts = [options.req];
            } else {
                this.hardAsserts = options.req;
            }
        } else {
            this.hardAsserts = [];
        }

        this.func = options.run || options.func || (()=>{return null;});
        this.regex = options.regex || null;
        this.log = options.log || false;
        this.points = options.points || 0;
    }

    _testHardRequirements() {
        return this._testRequirements(this.hardAsserts);
    }

    _testSoftRequirements(message, args) {
        try {
            return this.softAsserts.every((testfunc)=>{
                if (typeof testfunc == "function" && !testfunc(message, args)) return false;
                else if (!testfunc) return false;
                return true;
            })
        } catch (e) {
            err(e);
            return false;
        }
    }

    _testRequirements(asserts) {
        try {
            for (let i=0;i<asserts.length;i++) {
                if (typeof asserts[i] == "function" && !asserts[i]()) return false;
                else if (!asserts[i]) return false;
            }
            return true;
        } catch (e) {
            err(e)
            return false;
        }
    }

    _run(message) {

        let args;
        let messageString = message.content;
        let curlybracket;
        function parseMess(messageString){
            if (this.requirePrefix && messageString[0] !== this.prefix) return false;
            else if (messageString.indexOf(this.prefix) == 0) messageString = messageString.slice(this.prefix.length);
            if (this.regex) args = this.regex.exec(messageString)
            if (this._testHardRequirements()) {
                //tests for ".command help"
                if (!this.hidden && `${this.name} help`===messageString.toLowerCase()) {
                    if (typeof this.getLongDesc() == "string"){
                        message.channel.send("```" + this.getLongDesc() + "```").catch(err);
                    } else {
                        message.channel.send("",{embed: new Discord.RichEmbed(this.getLongDesc())}).catch(err);
                    }
                    return true;
                }
                else if ((this.regex == null || (args = this.regex.exec(messageString))) && this._testSoftRequirements(message, args)) {
                    if (this.log && discordbot.config && discordbot.config.botChannelID) {
                        let msg = "`" + message.author.tag + ":` " + message.cleanContent
                        discordbot.bot.channels.get(discordbot.config.botChannelID).send(msg);
                    }
                    let thiscom = this;
                    //let start = new Date();
                    (async ()=>{
                        let typing_prom;
                        let fulfilled = false;
                        if (thiscom.typing) {
                            message.channel.startTyping();
                            /*
                            typing_prom = discordbot.bot.api.channels[message.channel.id].typing.post().then(()=>{
                                fulfilled = true;
                            });
                            */
                        }
                        let return_mes = await this.func(message, args);
                        if (typing_prom) {
                            //console.log("fulfilled?", fulfilled);
                            await typing_prom;
                        }
                        return return_mes;
                    })().then(params=>{
                        if (params == null) {
                            return;
                        } else if (!Array.isArray(params)) {
                            params = [params];
                        }
                        if (thiscom.typing) {
                            message.channel.stopTyping();
                        }
                        message.channel.send.apply(message.channel, params)/*.then(()=>{
                            let end = new Date();
                            console.log(end-start)
                        })*/.catch(e=>{
                            if (thiscom.typing) {
                                message.channel.stopTyping();
                            }
                            if (e.code == 50035) {
                                err(e, message);
                                message.channel.send("`Error`").catch(err);
                            } else {
                                err(e, message);
                                message.channel.send("`Error`").catch(err);
                            }
                        });
                    }).catch(e=>{
                        if (thiscom.typing) {
                            message.channel.stopTyping();
                        }
                        err(e, message);
                        message.channel.send("`Error`").catch(err);
                    }).finally(()=>{
                        //message.channel.stopTyping()
                    })
                    return true;
                //tests for ".command" if not captured by command parser
                } else if (!this.hidden && this.name===messageString.toLowerCase()) {
                    if (typeof this.getLongDesc() == "string"){
                        message.channel.send("```" + this.getLongDesc() + "```").catch(err);
                    } else {
                        message.channel.send("",{embed: new Discord.RichEmbed(this.getLongDesc())}).catch(err);
                    }
                    return true;
                } 
            }
            return false;
        }
        if (curlybracket=/{(.+)}/.exec(messageString)) {
            return parseMess.call(this,messageString) || parseMess.call(this,curlybracket[1]);
        } else {
            return parseMess.call(this,messageString);
        }
    }

    run(message) {
        let check = this._run(message);
        if (check && this.points > 0) {
            let stmt = discordbot.sql.prepare("INSERT INTO users(user_id,points) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET points=points + excluded.points;")
            stmt.run(message.author.id, this.points)
        }
        return check
    }

    getVisibility() {
        if (this.hidden || !this._testHardRequirements()) return false;
        return true;
    }

    getShortDesc() {
        return `__**${this.prefix}${this.name}**__ - ${this.shortDesc}`;
    }

    getLongDesc() {
        return this.longDesc;
    }

    toString() {
        return "lol";
    }
}
module.exports = Command;