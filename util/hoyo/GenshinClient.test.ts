import { GenshinClient } from './GenshinClient.ts';

test('genshin battleChronicle', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.battleChronicle());
});

test('genshin spiralAbyss', async () => {
    const client = new GenshinClient("1234567890");
    console.log(JSON.stringify(await client.spiralAbyss()));
});

test('genshin it', async () => {
    const client = new GenshinClient("1234567890");
    console.log(JSON.stringify(await client.imaginariumTheater()));
});

test('genshin codes', async () => {
    const client = new GenshinClient("1234567890");
    console.log((await client.codes())[0]);
});

test('genshin daily', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.dailySignIn());
});

test('genshin dailyinfo', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.dailyInfo());
});

test('genshin redeem', async () => {
    const client = new GenshinClient("1234567890");
    console.log((await client.redeem('RNIF6H9394K8')));
});