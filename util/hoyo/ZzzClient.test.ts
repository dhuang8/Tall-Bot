import { ZzzClient } from './ZzzClient.ts';

test('zzz battleChronicle', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.battleChronicle());
});

test('zzz dailyInfo', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.dailyInfo());
});

test('zzz dailySignIn', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.dailySignIn());
});