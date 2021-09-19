"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fs = require('fs');
const {MessageEmbed} = require('discord.js');
const fetch = require('node-fetch');
const { CanvasRenderService } = require('chartjs-node-canvas');
const moment = require('moment-timezone');
const config = require('../util/config');
const {escapeMarkdownText} = require('../util/functions');

moment.tz.setDefault("America/New_York");

let coin = null;
(async()=>{
    coin = await fetch(`https://www.cryptocompare.com/api/data/coinlist/`).then(res => res.json());
})();

module.exports = new Command({
	name: 'poewiki',
    description: 'search path of exile wiki',
    type: 2,
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search or random',
        required: true,
    }],
	async execute(interaction) {
    }
})