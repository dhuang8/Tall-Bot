import {execute} from "./zzz.ts";
import {mockInteraction} from '../util/mock.js';

test('zzz test', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("critical-node");
    interaction.options.setInteger("phase", 1);
    let response = await execute(interaction);
    console.log(response);
    //expect(response.embeds.length).toBe(1);
});