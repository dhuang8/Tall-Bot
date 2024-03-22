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
    let response = await execute(interaction);
    expect(response.embeds.length).toBe(1);
});

test('hsr info', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("info");
    let response = await execute(interaction);
    expect(response.embeds.length).toBe(1);
    console.log(response.embeds[0]);
});

test('hsr daily', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("daily");
    let response = await execute(interaction);
    expect(response).toBeDefined();
});

test('hsr test', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "321"}
    interaction.options.setSubcommand("test");
    let response = await execute(interaction);
    expect(response).toBeDefined();
});

test('hsr moc', async () => {
    const interaction = new mockInteraction();
    interaction.user = {id: "1234567890"};
    interaction.options.setSubcommand("moc");
    let response = await execute(interaction);
    expect(response.embeds.length).toBeGreaterThan(0);
});

test('hsr pf', async () => {
    const interaction = new mockInteraction();
    interaction.user = {id: "1234567890"};
    interaction.options.setSubcommand("pure-fiction");
    let response = await execute(interaction);
    expect(response.embeds.length).toBeGreaterThan(0);
});

test('hsr support-char', async () => {
    const uid = 600043161;
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("support-char");
    interaction.options.setInteger("uid", uid);
    let response = await execute(interaction);
    // console.log(response.embeds[1].data.fields);
    // console.log(JSON.stringify(response, null, 4));o
    expect(response.embeds.length).toBe(4);
}, 10000);
test('hsr redeem', async () => {
    const interaction = new mockInteraction()
    interaction.user = {id: "1234567890"}
    interaction.options.setSubcommand("redeem");
    interaction.options.setString("code", "GENSHINGIFT");
    let response = await execute(interaction);
    console.log(response);
    //expect(response.embeds.length).toBe(1);
});