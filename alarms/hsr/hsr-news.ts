import { HsrClient } from '../../util/hoyo/HsrClient.ts';
import { HoyoNews } from '../../util/hoyo/hoyo-news.ts';

class HsrNews extends HoyoNews {
    constructor() {
        super("HSR News", "hsr_news")
    }
    async getNews() {
        return HsrClient.news();
    }
}

export default new HsrNews();
