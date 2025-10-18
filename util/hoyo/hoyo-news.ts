import { EmbedBuilder } from 'discord.js';
import sql from '../SQLite.js';
import { Alarm } from '../alarm.ts';
import DiscordHelper from '../discord-helper.ts';
import { timeOnNext } from '../functions.js';
import { Post } from './HoyoClient.ts';

export abstract class HoyoNews extends Alarm {
    field: string;

    constructor(name: string, field: string) {
        super(name);
        this.field = field;
        try {
            sql.prepare("INSERT INTO user_alarms (user_id, alarm_id, time_before, next_time, triggered, active, priority) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET time_before = excluded.time_before, next_time = excluded.next_time, active = excluded.active;")
                .run("", this.id, -1, null, 0, 1, 1);
        } catch(e) {
            console.error(e)
            //ignore if it exists
        }
    }

    async getNews(): Promise<Post[]> {
        throw new Error("not implemented")
    };

    nextTime() {
        return timeOnNext(60*60, 60);
    }

    async execute() {
        try {
            let posts = await this.getNews();
            let alarm = sql.prepare<number, {extra_data: string}>("SELECT extra_data FROM alarms WHERE id=?").get(this.id);
            if (!alarm) return;
            if (alarm.extra_data === null) {
                sql.prepare("UPDATE alarms SET next_time = ?, extra_data=? WHERE id = ?").run(this.nextTime(), posts[0].id.toString(), this.id);
                return;
            }
            const lastCreated = parseInt(alarm.extra_data);
            let embeds = posts.filter(post => {
                return post.created > lastCreated;
            }).sort((a,b) => {
                return a.created - b.created;
            }).map(post => {
                return new EmbedBuilder()
                    .setTitle(post.title.substring(0, 256))
                    .setDescription(post.description.substring(0, 5000))
                    .setURL(`https://www.hoyolab.com/article/${post.id}`)
                    .setImage(post.images[0] ?? undefined)
                    .setTimestamp(post.created*1000);
            });
            if (embeds.length > 0) {
                let channels = sql.prepare<[], {channel_id: string}>(`SELECT channel_id FROM channels WHERE ${this.field}=1`).all();
                channels.forEach(channel => {
                    DiscordHelper.send(channel.channel_id, {embeds: embeds});
                })
            }
            let maxCreated = Math.max(...posts.map(post => post.created));
            sql.prepare("UPDATE alarms SET next_time = ?, extra_data=? WHERE id = ?").run(this.nextTime(), maxCreated, this.id);
        } catch (e) {
            sql.prepare("UPDATE alarms SET next_time = ? WHERE id = ?").run(this.nextTime(), this.id);
        }
    }
}
