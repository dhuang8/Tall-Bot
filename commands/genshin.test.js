import {execute} from "./genshin.js";
import {mockInteraction} from '../util/mock.js';

test('genshin info', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("info");
    let response = await execute(interaction);
    console.log(response.embeds);
    expect(response.embeds.length).toBe(1);
});

test('genshin spiral abyss', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("spiral-abyss");
    let response = await execute(interaction);
    console.log(response.embeds);
    expect(response.embeds.length).toBe(2);
});