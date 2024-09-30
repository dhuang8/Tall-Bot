import { HoyoNews } from '../../util/hoyo/hoyo-news.ts';
import { GenshinClient } from '../../util/hoyo/GenshinClient.ts';

class GenshinNews extends HoyoNews {
    constructor() {
        super("Genshin News", "genshin_news")
    }
    async getNews() {
        return GenshinClient.news();
    }
}

export default new GenshinNews();
