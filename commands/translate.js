"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fs = require('fs');
const {MessageEmbed} = require('discord.js');
const fetch = require('node-fetch');
const { CanvasRenderService } = require('chartjs-node-canvas');
const moment = require('moment-timezone');
const config = require('../util/config');
const translate = require('@vitalets/google-translate-api');

moment.tz.setDefault("America/New_York");

module.exports = new Command({
	name: 'translate',
    description: 'translate a string to english',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'string to translate',
        required: true,
    }],
	async execute(interaction) {
        return (await translate(interaction.options.data[0].value, { to: 'en' })).text
    }
})