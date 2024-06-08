import {GenshinClient, HsrClient} from "./hoyo";

test('genshin', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.battleChronicle());
    console.log(await client.spiralAbyss());
});

test('hsr', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.info());
    console.log(await client.battleChronicle());
    console.log(await client.challenge());
    console.log(await client.challengeStory());
});
