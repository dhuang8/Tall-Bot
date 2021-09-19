"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fs = require('fs');
const {MessageEmbed} = require('discord.js');
const fetch = require('node-fetch');
const { CanvasRenderService } = require('chartjs-node-canvas');
const moment = require('moment-timezone');
const config = require('../util/config');

moment.tz.setDefault("America/New_York");

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

module.exports = new Command({
	name: 'define',
    description: 'urban dictionary',
    type: "CHAT_INPUT",
    options: [{
        name: 'term',
        type: 'STRING',
        description: 'term to define',
        required: true,
    }],
	async execute(interaction) {
        let data = await fetch(`http://api.urbandictionary.com/v0/define?term=${encodeURIComponent(interaction.options.data[0].value)}`).then(res => res.json());
        if (data.list.length > 0) {
            let rich = new MessageEmbed();
            rich.setTitle(escapeMarkdownText(data.list[0].word));
            let desc = escapeMarkdownText(data.list[0].definition.replace(/[\[\]]/g, ""));
            if (data.list[0].example) {
                desc += "\n\n*" + escapeMarkdownText(data.list[0].example.replace(/[\[\]]/g, "")) + "*";
            }
            rich.setDescription(desc.slice(0,2048));
            return rich;
        }
        return "`No results found`";
    }
})