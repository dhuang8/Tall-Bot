"use strict";
const Command = require('../util/Command');
const config = require('../util/config');
const execFile = require('child_process').execFile;

module.exports = new Command({
	name: 'update',
    description: 'updates the bot from github',
    guild: config.guild_id,
    type: "CHAT_INPUT",
    admin: true,
    options: [],
	async execute(interaction) {
        return (new Promise((res, rej) => {
            execFile('git', ["pull", "https://github.com/dhuang8/Tall-Bot", "v4"], (e, stdout, stderr) => {
                if (e) {
                    rej(e)
                } else {
                    res(`\`${stdout} ${stderr}\``);
                }
            })
        }))
	},
});