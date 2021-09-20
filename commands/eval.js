"use strict";
const Command = require('../util/Command');
const config = require('../util/config');

module.exports = new Command({
	name: 'eval',
    description: 'evaluates JavaScript code',
    guild: config.guild_id,
    type: "CHAT_INPUT",
    admin: true,
    options: [{
        name: 'eval-string',
        type: 'STRING',
        description: 'string to evaluate',
        required: true,
    }],
	execute(interaction) {
		return eval(interaction.options.data[0].value);
	},
});