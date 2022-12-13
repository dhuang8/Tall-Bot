import config from '../util/config.js';
import { Configuration, OpenAIApi } from "openai";
import Command from '../util/Command.js';

const configuration = new Configuration({
    apiKey: config.api.openai,
});
const openai = new OpenAIApi(configuration);

export default new Command({
	name: 'ai',
	description: 'Use AI to write stuff',
    type: "CHAT_INPUT",
    guild: config.guild_id,
    options: [{
        name: 'prompt',
        type: 'STRING',
        description: 'prompt',
        required: true,
    }],
	async execute(interaction) {
        try {
            const response = await openai.createCompletion({
                model: "text-davinci-003",
                //model: "text-babbage-001",
                prompt: interaction.options.data[0].value,
                max_tokens: 2048 - interaction.options.data[0].value.length*5,
                temperature: 0.5,
                n: 1
            });
            return response.data.choices[0].text.slice(0,2000);
        } catch (e) {
            console.log(e.data.error)
        }
	},
});