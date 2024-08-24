import { EmbedBuilder } from 'discord.js';
import sql from '../../util/SQLite.js';
import { Alarm } from '../../util/alarm.ts';
import { HsrClient } from '../../util/hoyo/HsrClient.ts';
import DiscordHelper from '../../util/discord-helper.ts';
import { timeOnNext } from '../../util/functions.js';

class HsrNews extends Alarm {

    constructor() {
        super("HSR News");
        try {
            sql.prepare("INSERT INTO user_alarms (user_id, alarm_id, time_before, next_time, triggered, active, priority) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET time_before = excluded.time_before, next_time = excluded.next_time, active = excluded.active;")
                .run("", this.id, -1, null, 0, 1, 1);
        } catch(e) {
            console.error(e)
            //ignore if it exists
        }
    }

    async execute() {
        try {
            let posts = await HsrClient.news();
            let alarm = sql.prepare<number, {extra_data: string}>("SELECT extra_data FROM alarms WHERE id=?").get(this.id);
            if (!alarm) return;
            if (alarm.extra_data === null) {
                sql.prepare("UPDATE alarms SET next_time = ?, extra_data=? WHERE id = ?").run(timeOnNext(10*60, 60), posts[0].id.toString(), this.id);
                return;
            }
            const lastId = parseInt(alarm.extra_data);
            let embeds = posts.filter(post => {
                return post.id > lastId;
            }).reverse().map(post => {
                return new EmbedBuilder()
                    .setTitle(post.title.substring(0, 256))
                    .setDescription(post.description.substring(0, 5000))
                    .setURL(`https://www.hoyolab.com/article/${post.id}`)
                    .setImage(post.images[0] ?? undefined)
                    .setTimestamp(post.created*1000);
            });
            if (embeds.length > 0) {
                let channels = sql.prepare<[], {channel_id: string}>("SELECT channel_id FROM channels WHERE hsr_news=1").all();
                channels.forEach(channel => {
                    DiscordHelper.send(channel.channel_id, {embeds: embeds});
                })
            }
            sql.prepare("UPDATE alarms SET next_time = ?, extra_data=? WHERE id = ?").run(timeOnNext(10*60, 60), posts[0].id.toString(), this.id);
        } catch (e) {
            sql.prepare("UPDATE alarms SET next_time = ? WHERE id = ?").run(timeOnNext(10*60, 60), this.id);
        }
    }
}

export default new HsrNews();
