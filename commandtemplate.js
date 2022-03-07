"use strict";
import Command from '../util/Command.js';
import MessageResponse from '../util/MessageResponse.js';
import fs from 'fs';
import {MessageEmbed} from 'discord.js';
import fetch from 'node-fetch';
import { CanvasRenderService } from 'chartjs-node-canvas';
import moment from 'moment-timezone';
import config from '../util/config.js';
const {escapeMarkdownText} = require('../util/functions');

moment.tz.setDefault("America/New_York");

let coin = null;
(async()=>{
    coin = await fetch(`https://www.cryptocompare.com/api/data/coinlist/`).then(res => res.json());
})();

export default new Command({
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