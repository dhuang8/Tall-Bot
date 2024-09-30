import { Hi3Client } from '../util/hoyo/Hi3Client.ts';
import { HoyoNews } from '../util/hoyo/hoyo-news.ts';

class Hi3News extends HoyoNews {
    constructor() {
        super("Hi3 News", "hi3_news")
    }
    async getNews() {
        return Hi3Client.news();
    }
}

export default new Hi3News();
