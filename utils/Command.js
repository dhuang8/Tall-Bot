"use strict";
const Discord = require('discord.js');
const discordbot = require('../discordbot');

class Command {
    constructor(options) {
        if (!options || !options.name) throw new Error("missing options, name, regex, or function");
        this.name = options.name;
        this.prefix = (typeof options.prefix=="string")? options.prefix:".";
        //require prefix
        this.requirePrefix = options.requirePrefix || false;
        this.shortDesc = options.shortDesc || "";
        this.longDesc = options.longDesc || "";
        this.testString = options.testString || ""
        //won't run if one is false
        if (options.softAsserts) {
            if (!Array.isArray(options.softAsserts)) {
                this.softAsserts = [options.softAsserts];
            } else {
                this.softAsserts = options.softAsserts;
            }
        } else {
            this.softAsserts = [];
        }
        
        //same as softasserts but also will not show up in help if 1 is false
        if (options.hardAsserts) {
            if (!Array.isArray(options.hardAsserts)) {
                this.hardAsserts = [options.hardAsserts];
            } else {
                this.hardAsserts = options.hardAsserts;
            }
        } else {
            this.hardAsserts = [];
        }

        this.func = options.func || (()=>{return true;});
        this.regex = options.regex || null;
        this.hidden = options.hidden || false;
        this.log = options.log || !this.hidden;
        this.points = options.points || (options.requirePrefix?1:0);
    }

    _testHardRequirements() {
        return this._testRequirements(this.hardAsserts);
    }

    _testSoftRequirements() {
        return this._testRequirements(this.softAsserts);
    }

    _testRequirements(asserts) {
        for (let i=0;i<asserts.length;i++) {
            if (typeof asserts[i] == "function" && !asserts[i]()) return false;
            else if (!asserts[i]) return false;
        }
        return true;
    }

    _run(message) {
        let args;
        let messageString = message.content;
        let curlybracket;
        function parseMess(messageString){
            if (this.requirePrefix && messageString[0] !== this.prefix) return false;
            else if (messageString.indexOf(this.prefix) == 0) messageString = messageString.slice(this.prefix.length);
            if (this._testHardRequirements() && this._testSoftRequirements()) {
                if (this.regex == null || (args = this.regex.exec(messageString))) {
                    if (this.log && discordbot.config && discordbot.config.botChannelID) {
                        let msg = "`" + message.author.tag + ":` " + message.cleanContent
                        discordbot.bot.channels.get(discordbot.config.botChannelID).send(msg);
                    }
                    return this.func(message, args);
                }
                else if (!this.hidden && this.name===messageString.toLowerCase()) {
                    if (typeof this.getLongDesc() == "string"){
                        message.channel.send("```" + this.getLongDesc() + "```");
                    } else {
                        message.channel.send("",{embed: new Discord.RichEmbed(this.getLongDesc())});
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