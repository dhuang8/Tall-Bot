"use strict";
const Command = require('../util/Command');
const config = require('../util/config');
const execFileSync = require('child_process').execFileSync;

module.exports = new Command({
	name: 'update',
    description: 'updates the bot from github',
    guild: config.guild_id,
    type: "CHAT_INPUT",
    admin: true,
    options: [],
	execute(interaction) {
        return execFileSync('git', ["pull", "https://github.com/dhuang8/Tall-Bot.git", "v4"])
	},
});