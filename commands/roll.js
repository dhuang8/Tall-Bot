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

let coin = null;
(async()=>{
    coin = await fetch(`https://www.cryptocompare.com/api/data/coinlist/`).then(res => res.json());
})();

module.exports = new Command({
	name: 'roll',
    description: 'rolls dice',
    type: "CHAT_INPUT",
    options: [{
        name: 'dice',
        type: 'STRING',
        description: 'number or dnd format (ex: 2d6+4)',
        required: true,
    }],
	async execute(interaction) {
        let args = interaction.options.data[0].value.match(/(?:(\d*)d)?(\d+)([+-]\d+)?/);
        if (!args) return "`Wrong format`";
        let num_dice = parseInt(args[1]) || 1;
        let max = parseInt(args[2]);
        let add = parseInt(args[3]) || 0;
        if (max < 1) return "`Dice side must be > 0`";
        if (num_dice < 1) return "`Number of dice must be > 0`";
        if (num_dice > 300) return "`Number of dice must be <= 300`";
        let rolls = [];
        for (let n = 0; n < num_dice; n++) {
            rolls.push(Math.floor(Math.random() * max) + 1);
        }
        if (rolls.length === 1 && add === 0) return `\`${rolls[0]}\``;
        let msg = "`(" + rolls.join(" + ") + ")";
        let total = rolls.reduce((acc, cur) => acc + cur, 0);
        if (add !== 0) {
            total += add;
            if (add > 0) msg += "+" + add;
            else msg += add;
        }
        msg += "`= " + total;
        return msg;
    }
})