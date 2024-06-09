test('import', async () => {
    const alarm = (await import(`./genshin-daily.ts`)).default(null);
    console.log(alarm.id);
    alarm.kill();
});

test('execute', async () => {
    const alarm = (await import(`./genshin-daily.ts`)).default(null);
    await alarm.execute("113060802252054528")
    alarm.kill();
});