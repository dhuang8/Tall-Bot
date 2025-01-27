import { ZzzClient } from './ZzzClient.ts';

test('zzz battleChronicle', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.battleChronicle());
});

test('zzz deadass', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.deadass());
});

test('zzz dailyInfo', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.dailyInfo());
});

test('zzz dailySignIn', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.dailySignIn());
});

test('zzz getTimers', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.getTimers());
});

test('zzz character', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.getCharacter(1251));
});

test('zzz event', async () => {
    const client = new ZzzClient("1234567890");
    console.log(await client.actCalendar());
});