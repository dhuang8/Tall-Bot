import sql from '../SQLite.js';
import { hoyoPost } from './HoyoClient.ts';
import { getPosts } from './HoyoClient.ts';
import { User } from './HoyoClient.ts';


export class Hi3Client {
    user_id: string;
    uid: number;
    cookie: string;

    constructor(user_id: string) {
        const user = sql.prepare<string, User>("SELECT hsr_cookie, hi3_uid from users WHERE user_id = ?").get(user_id);
        if (user == null) throw new Error("`Missing user`");
        if (user.hi3_uid == null) throw new Error("`Missing uid`");
        if (user.hsr_cookie == null) throw new Error("`Missing cookie`");
        this.user_id = user_id;
        this.uid = user.hi3_uid;
        this.cookie = user.hsr_cookie;
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-public-api.hoyolab.com/event/mani/sign?lang=en-us`, this.cookie, {
            act_id: "e202110291205111"
        });
        return response;
    }

    static async news() {
        return getPosts(147839994, '');
    }
}
