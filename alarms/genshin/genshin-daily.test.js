import config from '../../config.json';

test('import', async () => {
    const alarm = (await import(`./genshin-daily.ts`)).default;
    console.log(alarm.id);
});

test('execute', async () => {
    const alarm = (await import(`./genshin-daily.ts`)).default;
    await alarm.execute("1234567890")
});

test('execute by user id', async () => {
    const alarm = (await import(`./genshin-daily.ts`)).default;
    await alarm.executeByUserId("1234567890");
});