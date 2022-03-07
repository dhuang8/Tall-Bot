"use strict";
import Command from '../util/Command.js';
import config from '../util/config.js';
import {execFile} from 'child_process';

export default new Command({
	name: 'update',
    description: 'updates the bot from github',
    guild: config.guild_id,
    type: "CHAT_INPUT",
    admin: true,
    options: [],
	async execute(interaction) {
        return (new Promise((res, rej) => {
            execFile('git', ["pull", "https://github.com/dhuang8/Tall-Bot.git", "v4"], (e, stdout, stderr) => {
                if (e) {
                    rej(e)
                } else {
                    res(`\`${stdout} ${stderr}\``);
                }
            })
        }))
	},
});