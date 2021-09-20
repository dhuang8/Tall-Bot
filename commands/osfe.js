"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fs = require('fs');
const {MessageEmbed} = require('discord.js');

let osfe;
try {
    osfe = JSON.parse(fs.readFileSync("./data/osfe.json", 'utf8'));
} catch (e) {
    console.error(e);
    console.error("One Step From Eden data not found");
}

module.exports = new Command({
	name: 'osfe',
    description: 'returns One Step From Eden spell, artifact, or keyword',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search or random',
        required: true,
    }],
	async execute(interaction) {
        let results = osfe.filter(element=>{
            return element.title.toLowerCase().indexOf(interaction.options.data[0].value.toLowerCase()) > -1;
        }).map(element=>{
            return {
                title: element.title,
                response: ()=>{
                    let rich = new MessageEmbed(element);
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