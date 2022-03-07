"use strict";
import Command from '../util/Command.js';
import translate from '@vitalets/google-translate-api';

export default new Command({
	name: 'translate',
    description: 'translate a string to english',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'string to translate',
        required: true,
    }],
	async execute(interaction) {
        return (await translate(interaction.options.data[0].value, { to: 'en' })).text
    }
})