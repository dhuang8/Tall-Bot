"use strict";
const {Collection, MessageEmbed} = require('discord.js');
const moment = require('moment-timezone');

class MessageResponse {
    constructor() {
        console.log("created embed list")
        this.list = new Collection()
    }
    add(channel, run) {
        this.list.set(channel, {
            time: moment().add(2,"hours"),
            run
        })
    }
    //returns embed
    addList(channel, data_array, userid) {
        let mes = data_array.map((cur, index) => {
            return `${index + 1}. ${cur.title}`;
        }).join("\n");
        let embed = new MessageEmbed();
        embed.setDescription(mes);
        embed.setFooter("Respond with number");
        let run = (msg) => {

            if (userid != null && userid != msg.author.id) return null;
            if (/\d+/.test(msg.content)) {
                let num = parseInt(msg.content)-1
                if (num < data_array.length) {
                    if (typeof data_array[num].response == "function") return data_array[num].response();
                    else return data_array[num].response;
                }
            }
            return null;
        }
        this.add(channel, run)
        return embed;
    }
    removeList() {

    }
    execute(message){
        return this.list.get(message.channel.id)?.run(message);
    }
}

module.exports = new MessageResponse();