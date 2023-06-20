"use strict";
import Command from '../util/Command.js';
import MessageResponse from '../util/MessageResponse.js';
import fs from 'fs';
import {MessageEmbed} from 'discord.js';
import fetch from 'node-fetch';
import moment from 'moment-timezone';
import config from '../util/config.js';

moment.tz.setDefault("America/New_York");

export default new Command({
	name: 'hsr',
    description: 'trailblazer power',
    type: 'CHAT_INPUT',
    options: [{
        name: 'trailblazer-power',
        type: 'INTEGER',
        description: 'current trailblazer power',
        required: true,
    }],
	async execute(interaction) {
        let d = new Date();
        let mins = (180-interaction.options.data[0].value)*6;
        return `<t:${parseInt(new Date(d.getTime() + mins*60*1000).getTime()/1000)}>`;
    }
})