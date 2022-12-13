"use strict";
import Command from '../util/Command.js';
import config from '../util/config.js';

export default new Command({
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
        console.log(interaction.options.data[0].value)
		return eval(interaction.options.data[0].value);
	},
});