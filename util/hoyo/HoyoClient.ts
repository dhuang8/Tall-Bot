import crypto from "crypto";
import sql from "../SQLite.js";
import { request } from "../functions.js";
import { MessageCreateOptions } from "discord.js";

export interface Post {
    title: string,
    description: string,
    created: number,
    id: number,
    url: string,
    images: string[]
}

export interface Resource {
    name: string,
    current: number,
    max: number,
    done: boolean,
    recovery_time: number
};

export interface HoyoEvent {
    name: string,
    done: boolean,
    start_time: number,
    recovery_time: number,
    current?: number,
    max?: number,
    started?: boolean
};

export interface User {
    hsr_cookie: string;
    genshin_uid: number;
    hsr_uid: number;
    hi3_uid: number;
    zzz_uid: number;
};

interface Config {
    discord_id: string;
    root_url: string;
}

export interface HoyoClient extends Config {
    uid: number;
    cookie: string;
}

export abstract class HoyoClient {

    constructor(config: Config) {
        this.discord_id = config.discord_id;
        const user = sql.prepare<string, User>("SELECT hsr_cookie, genshin_uid, hi3_uid, hsr_uid, zzz_uid from users WHERE user_id = ?").get(this.discord_id);
        if (user == null) throw new Error("`Missing user`");
        if (this.getUid(user) == null) throw new Error("`Missing uid`");
        if (user.hsr_cookie == null) throw new Error("`Missing cookie`");
        this.uid = this.getUid(user);
        this.cookie = user.hsr_cookie;
        this.root_url = config.root_url;
    }

    abstract battleChronicle(): void;

    abstract buildUserEmbed(): Promise<MessageCreateOptions>;

    abstract getUid(user: User): number;
    
    abstract getTimers(): Promise<Resource[]>;

    async dailySignIn() {
        throw new Error("Implement this");
    }

    static async news(): Promise<Post[]> {
        throw new Error("Implement this");
    }
}

export async function hoyoPost(url: string, cookie: string, body: any = "", addHeader: {[key: string]: string} = {}) {
    const r = await request({
        url,
        headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Accept-Encoding": "gzip, deflate, br",
            "Sec-Ch-Ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            "x-rpc-app_version": "1.5.0",
            "x-rpc-client_type": "5",
            "x-rpc-language": "en-us",
            cookie,
            ...addHeader
        },
        method: 'POST',
        body: JSON.stringify(body)
    });
    if (r.data != null) return r.data;
    else {
        console.log(r)
        throw new Error(`${r.retcode} ${r.message}`);
    }
}

export async function getPosts(id: number, cookie: string) {
    const posts: {
        list: {
            post: {
                content: string;
                created_at: number;
                post_id: string;
                subject: string;
            };
            image_list: {
                url: string;
            }[];
            cover_list: {
                url: string;
            }[];
        }[];
    } = await hoyoRequest(`https://bbs-api-os.hoyolab.com/community/post/wapi/userPost?size=15&uid=${id}`, cookie);
    return posts.list.map(p => {
        return {
            title: p.post.subject,
            description: p.post.content,
            created: p.post.created_at,
            id: parseInt(p.post.post_id),
            url: `https://www.hoyolab.com/article/${p.post.post_id}`,
            images: p.cover_list.map(image => image.url)
        };
    });
}
export async function hoyoRequest(url: string, cookie: string, addHeader: {[key: string]: string} = {}) {
    const r = await request({
        url,
        headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
            "Cache-Control": "no-cache",
            cookie,
            "Content-Type": "application/json",
            "Ds": generateDS(),
            "Origin": "https://act.hoyolab.com",
            "Referer": "https://act.hoyolab.com",
            "Sec-Ch-Ua": '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
            "X-Rpc-App_version": "1.5.0",
            "X-Rpc-Client_type": "5",
            "X-Rpc-Language": "en-us",
            "X-Rpc-Platform": "4",
            ...addHeader
        }
    });
    if (r.data != null) return r.data;
    else throw new Error(`${r.retcode} ${r.message}`);
}
export interface User {
    hsr_cookie: string;
    genshin_uid: number;
    hsr_uid: number;
    hi3_uid: number;
    zzz_uid: number;
}
export function generateDS() {
    const salt = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
    const date = new Date();
    const time = Math.floor(date.getTime() / 1000).toString();
    let random = "";
    const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        const randomChar = characters.charAt(randomIndex);
        random += randomChar;
    }
    const hash = (0, crypto.createHash)("md5").update("salt=".concat(salt, "&t=").concat(time, "&r=").concat(random)).digest("hex");
    return "".concat(time, ",").concat(random, ",").concat(hash);
}
export async function codes(id: number, cookie: string): Promise<any> {
    const response = await hoyoRequest(`https://bbs-api-os.hoyolab.com/community/painter/wapi/circle/channel/guide/material?game_id=${id}`, cookie);
    return response.modules;
}
export function calcTimestampAfter(time: number) {
    return Math.floor(new Date(Date.now() + time * 1000).getTime() / 1000);
}
export function crossIfTrue(test: boolean, string: string) {
    if (test) return `~~${string}~~`;
    return string;
}
export function next1stMonthly() {
    let curDate = new Date();
    let end_date = new Date(curDate.getFullYear(), curDate.getMonth(), 1, 9, 0, 0);
    if (end_date < curDate) {
        end_date.setMonth(end_date.getMonth()+1);
        end_date.setDate(1);
    }
    return end_date.valueOf()/1000;
}
export function next16thMonthly() {
    let curDate = new Date();
    let end_date = new Date(curDate.getFullYear(), curDate.getMonth(), 16, 9, 0, 0);
    if (end_date < curDate) {
        end_date.setMonth(end_date.getMonth()+1);
        end_date.setDate(1);
    }
    return end_date.valueOf()/1000;
}
export function nextBimonthly() {
    return Math.min(next1stMonthly(), next16thMonthly())
}
