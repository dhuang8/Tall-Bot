import { Hi3Client } from './Hi3Client.ts';

test('hi3 news', async () => {
    console.log(await Hi3Client.news());
});