"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const {MessageEmbed, Message} = require('discord.js');
const fetch = require('node-fetch');
const unescape = require('unescape');

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

module.exports = new Command({
	name: 'poewiki',
    description: 'search path of exile wiki',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search',
        required: true,
    }],
	async execute(interaction) {
        async function createItemRich(item_name, url) {
            let response = await fetch(`https://pathofexile.gamepedia.com/api.php?action=cargoquery&tables=items&fields=items.html,items.name&where=items.name=${encodeURIComponent(`"${item_name}"`)}&format=json`).then(res => res.json());
            if (response.cargoquery.length > 0) {
                let html = unescape(response.cargoquery[0].title.html)

                //<span class=group>
                html = html.replace(/<span [^>]*?class="group.+?>/g, "\n\n")
                    //<br>
                    .replace(/<br>/g, "\n")
                    //&ndash;
                    .replace(/&ndash;/g, "-")
                    //<div>
                    .replace(/<(\w+?).+?>/g, "")
                    //</div>
                    .replace(/<\/(\w+?)>/g, "")
                    //[[File:asdf.png]]
                    .replace(/\[\[File:(.+)\]\]/g, "")
                    //[[:asdf:asdf|asdf]]
                    .replace(/\[\[:\w+:.+?\|(.+?)\]\]/g, "$1")
                    //[[asdf|asdf]]
                    .replace(/\[\[[^\]\r\n]+?\|(.+?)\]\]/g, "$1")
                    //[[asdf]]
                    .replace(/\[\[([^\]\r\n]+?)\]\]/g, "$1")

                let lines = html.split("\n");
                while (lines[0] === "" || lines[0] === item_name) {
                    lines.shift();
                }
                let rich = new MessageEmbed()
                    .setTitle(escapeMarkdownText(item_name))
                    .setURL(url)
                    .setDescription(lines.join("\n"));
                return rich;
            } else {
                return `**__${item_name}__**\n${url}`;
            }
        }
        //https://pathofexile.gamepedia.com/api.php
        let response = await fetch(`https://pathofexile.gamepedia.com/api.php?action=opensearch&search=${encodeURIComponent(interaction.options.data[0].value)}&format=json`).then(res => res.json());
        //convert to {name, url}
        let list = response[1].map((item_name, index) => {
            return {
                title: item_name, 
                response: async () => { return await createItemRich(item_name, response[3][index]) }
            };
        })
        switch (list.length) {
            case 0:
                return `\`No results found\``;
            case 1:
                return await list[0].response();
            default:
                let rich = MessageResponse.addList(interaction.channel.id, list);
                rich.setTitle("Multiple items found")
                return rich;
        }
    }
})