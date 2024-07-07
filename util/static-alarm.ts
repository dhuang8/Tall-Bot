import sql from './SQLite.js';
import { Alarm, UserAlarm } from './alarm.ts';
import config from '../config.json';
import DiscordHelper from './discord-helper.ts';

export abstract class StaticAlarm extends Alarm {

    constructor(name: string) {
        super(name);
        try {
            sql.prepare("INSERT INTO user_alarms (user_id, alarm_id, time_before, next_time, triggered, active, priority) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET time_before = excluded.time_before, next_time = excluded.next_time, active = excluded.active;")
                .run("", this.id, -1, null, 0, 1, 1);
        } catch(e) {
            console.error(e)
            //ignore if it exists
        }
    }

    abstract calcNextTime(): Promise<number>;

    async refresh() {
        sql.prepare("UPDATE alarms SET next_time = ? WHERE id = ?").run(await this.calcNextTime(), this.id);
        sql.prepare("UPDATE user_alarms SET active = true WHERE alarm_id = ?").run(this.id);
    }

    abstract executeUser(userAlarm: UserAlarm): Promise<void>;

    async execute(userAlarm: UserAlarm) {
        const userId = userAlarm.user_id;
        if (userId == "") {
            this.refresh();
            return;
        }
        sql.prepare("UPDATE user_alarms SET active = false WHERE user_id = ? AND alarm_id = ?").run(userId, this.id);
        try {
            this.executeUser(userAlarm);
        } catch (e) {
            // TODO better way to handle error
            if (typeof e === "string") {
                DiscordHelper.sendToLog(`<@${config.user_id}>`,"timer error auto trigger", e);
            } else if (e instanceof Error) {
                DiscordHelper.sendToLog(`<@${config.user_id}>`,"timer error auto trigger", e.toString());
            }
        }
    }
}
