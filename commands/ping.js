"use strict";
const Command = require('../util/Command');

module.exports = new Command({
	name: 'ping',
	description: 'Ping!2',
    type: "CHAT_INPUT",
	execute(options) {
		return 'pong';
	},
});