"use strict";
import Command from '../util/Command.js';
import config from '../util/config.js';

export default new Command({
	name: 'ping',
	description: 'Ping!2',
    type: "CHAT_INPUT",
    guild: config.guild_id,
	execute(options) {
		return 'pong';
	},
});