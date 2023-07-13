import {execute} from "./hsr.js";
import {mockInteraction} from '../util/mock.js';

test('hsr set', async () => {
    const cookie = "cookie"
    const uid = 123456789;
    const interaction = new mockInteraction()
    interaction.user = {id: "123456789"}
    interaction.options.setSubcommand("set");
    interaction.options.setString("cookie", cookie);
    interaction.options.setInteger("uid", uid);
    //let response = await execute(interaction);
    //expect(response.embeds.length).toBe(1);
});

test('hsr info', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("info");
    let response = await execute(interaction);
    expect(response.embeds.length).toBe(1);
});

test('hsr redeem2', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("redeem2");
    interaction.options.setString("code", "somecode");
    let response = await execute(interaction);
    console.log(response)
    expect(response).toBeDefined();
});

test('hsr daily', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("daily");
    let response = await execute(interaction);
    console.log(response)
    expect(response).toBeDefined();
});
