import { ZzzClient } from '../../util/hoyo/ZzzClient.ts';
import { HoyoNews } from '../../util/hoyo/hoyo-news.ts';

class ZzzNews extends HoyoNews {
    constructor() {
        super("ZZZ News", "zzz_news")
    }
    async getNews() {
        return ZzzClient.news();
    }
}

export default new ZzzNews();
