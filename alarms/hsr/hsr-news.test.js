import { HsrNews } from './hsr-news.ts';

test('execute by user id', async () => {
    let alarm = new HsrNews();
    await alarm.execute();
});