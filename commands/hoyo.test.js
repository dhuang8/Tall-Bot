import {execute} from "./hoyo.ts";
import {mockInteraction} from '../util/mock.js';

test('timers', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("timers");
    let response = await execute(interaction);
    console.log(response.embeds);
    expect(response.embeds.length).toBe(1);
});