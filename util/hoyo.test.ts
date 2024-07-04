import {GenshinClient, HsrClient, ZzzClient} from "./hoyo.ts";

test('genshin battleChronicle', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.battleChronicle());
});

test('genshin spiralAbyss', async () => {
    const client = new GenshinClient("1234567890");
    console.log(JSON.stringify(await client.spiralAbyss()));
});

test('genshin codes', async () => {
    const client = new GenshinClient("1234567890");
    console.log((await client.codes())[0]);
});

test('genshin daily', async () => {
    const client = new GenshinClient("1234567890");
    console.log(await client.dailySignIn());
});

test('hsr daily', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.dailySignIn());
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
    console.log(JSON.stringify(await client.memoryOfChaos()));
});

test('hsr memoryOfChaos without userid', async () => {
    const client = new HsrClient({uid: 601621324});
    try {
        console.log(await client.memoryOfChaos(1));
    } catch(e) {
        console.log(e);
    }
});

test('hsr pureFiction', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.pureFiction());
});

test('hsr apoc', async () => {
    const client = new HsrClient("1234567890");
    console.log(JSON.stringify(await client.apocalypticShadow()));
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

test('hsr banners', async () => {
    const client = new HsrClient("1234567890");
    console.log((await client.banners())[0]);
});

test('zzz signin', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.dailyInfo());
});
