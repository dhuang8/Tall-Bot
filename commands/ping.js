"use strict";
const Command = require('../util/Command');
const config = require('../util/config');

module.exports = new Command({
	name: 'ping',
	description: 'Ping!2',
    type: "CHAT_INPUT",
    guild: config.guild_id,
	execute(options) {
		return 'pong';
	},
});