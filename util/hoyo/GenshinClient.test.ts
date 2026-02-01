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

test('genshin event', async () => {
    const client = new GenshinClient("1234567890");
    console.log(JSON.stringify(await client.actCalendar()));
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

test('genshin news', async () => {
    console.log(await GenshinClient.news());
});

test('genshin timers', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.getTimers());
})

// test('genshin redeem', async () => {
//     const client = new GenshinClient("1234567890");
//     console.log((await client.redeem('RNIF6H9394K8')));
// });

// test('genshin test2', async () => {
//     const client = new GenshinClient("1234567890");
//     console.log((await client.test2()));
// });