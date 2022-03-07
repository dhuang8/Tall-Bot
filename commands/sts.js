"use strict";
import Command from '../util/Command.js';
import MessageResponse from '../util/MessageResponse.js';
import fs from 'fs';
import {MessageEmbed} from 'discord.js';

let sts;
try {
    sts = JSON.parse(fs.readFileSync("./data/sts.json", 'utf8'));
} catch (e) {
    console.error(e);
    console.error("Slay the Spire data not found");
}

export default new Command({
	name: 'sts',
    description: 'returns Slay the Spire card and relic info',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search or random',
        required: true,
    }],
	async execute(interaction) {
        let results = sts.filter(element=>{
            return element.title.toLowerCase().indexOf(interaction.options.data[0].value.toLowerCase()) > -1;
        }).map(element=>{
            return {
                title: element.title,
                response: ()=>{
                    let rich = new MessageEmbed();
                    rich.setTitle(element.title);
                    rich.setImage(element.image)
                    rich.setDescription(element.description);
                    return rich;
                }
            }
        })
        if (results.length < 1) {
            return "`No results`";
        } else if (results.length == 1) {
            return results[0].response();
        } else {
            let rich = MessageResponse.addList(interaction.channelId, results);
            rich.setTitle("Multiple results found")
            return rich;
        }
    }
})