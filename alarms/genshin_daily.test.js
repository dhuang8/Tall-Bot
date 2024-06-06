test('import', async () => {
    const alarm = (await import(`./genshin_daily.js`)).default(null);
    console.log(alarm.id);
    alarm.kill();
});

test('execute', async () => {
    const alarm = (await import(`./genshin_daily.js`)).default(null);
    await alarm.execute("113060802252054528")
    alarm.kill();
});