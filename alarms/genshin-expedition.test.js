import config from '../config.json';
import genshinExpedition from './genshin-expedition.ts';

test('import', async () => {
    const alarm = (await import(`./genshin-expedition.ts`)).default;
    console.log(alarm.id);
});

test('execute by user id', async () => {
    await genshinExpedition.executeByUserId(config.user_id);
});