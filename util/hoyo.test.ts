import {GenshinClient, hoyoRequest, HsrClient} from "./hoyo.ts";

test('genshin battleChronicle', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.battleChronicle());
});

test('genshin spiralAbyss', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.spiralAbyss());
});

test('genshin codes', async () => {
    const client = new GenshinClient("1234567890");
    console.log((await client.codes())[0]);
});

test('hsr info', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.info());
});

test('hsr battleChronicle', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.battleChronicle());
});

test('hsr memoryOfChaos', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.memoryOfChaos());
});

test('hsr pureFiction', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.pureFiction());
});

test('hsr su', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.simulatedUniverse());
});

test('hsr endgame', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.endgameContent());
});

test('hsr codes', async () => {
    const client = new HsrClient("1234567890");
    console.log((await client.codes())[0]);
});

// test('hsr', async () => {
//     const client = new HsrClient("1234567890");
//     console.log(await client.info());
//     console.log(await client.battleChronicle());
//     console.log(await client.challenge());
//     console.log(await client.challengeStory());
// });
