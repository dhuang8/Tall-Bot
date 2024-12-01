import { HsrClient } from './HsrClient.ts';

test('hsr daily', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.dailySignIn());
});

test('hsr daily info', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.dailyInfo());
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
    const client = new HsrClient("601621324");
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

test('hsr events', async () => {
    const client = new HsrClient("1234567890");
    console.log(await client.actCalendar());
});

test('hsr codes', async () => {
    const client = new HsrClient("1234567890");
    console.log((await client.codes())[0]);
});

test('hsr banners', async () => {
    const client = new HsrClient("1234567890");
    console.log((await client.banners())[0]);
});

test('hsr news', async () => {
    console.log(await HsrClient.news());
});

test('hsr codes', async () => {
    const client = new HsrClient("1234567890");
    console.log((await client.redeem('FeixiaoFiles')));
});