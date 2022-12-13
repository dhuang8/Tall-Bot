"use strict";
import {Collection, MessageEmbed} from 'discord.js';
import moment from 'moment-timezone';

class MessageResponse {
    constructor() {
        this.list = new Collection()
    }
    add(channel, run) {
        this.list.set(channel, {
            time: moment().add(2,"hours"),
            run
        })
    }
    /**
     * 
     * @param {*} channel 
     * @param {*} data_array 
     * @param {*} userid 
     * @returns 
     */
    addList(channel, data_array, userid) {
        if (data_array.length == 1) {
            if (typeof data_array[0].response == "function") return data_array[0].response();
            else return data_array[0].response;
        } else if (data_array.length > 1) {
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
        } else {
            return "`No results`";
        }
    }
    removeList() {

    }
    execute(message) {
        return this.list.get(message.channel.id)?.run(message);
    }
}

export default new MessageResponse();