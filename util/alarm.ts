import sql from './SQLite.js';
import AlarmManager from './alarm-manager.js';

export interface UserAlarm {
    user_id: string,
    alarm_id: number,
    time_before: number,
    next_time: number,
    triggered: number,
    active: number
}

interface AlarmId {
    id: number;
};

export abstract class Alarm {
    name: string;
    id: number;

    constructor(name: string) {
        this.name = name;
        let id = sql.prepare<string, AlarmId>("SELECT id FROM alarms WHERE name = ?").get(this.name)?.id;
        if (id) {
            this.id = id;
        } else {
            id = sql.prepare<string, AlarmId>("INSERT INTO alarms (name) VALUES (?) RETURNING id;").get(this.name)?.id;
            if (!id) throw new Error("could not add alarm");
            this.id = id;
        }
    }

    async executeByUserId(userId: string) {
        let userAlarm: UserAlarm | undefined = sql.prepare<[string, number], UserAlarm>("SELECT user_id, alarm_id, name as alarm_name, time_before, MAX(strftime('%s', 'now')-1, COALESCE(user_alarms.next_time - time_before * NOT triggered, alarms.next_time - time_before, 0)) AS next_time, triggered FROM user_alarms LEFT JOIN alarms ON user_alarms.alarm_id = alarms.id WHERE user_id = ? AND alarm_id = ?")
            .get(userId, this.id);
        if (userAlarm) await this.execute(userAlarm);
    }

    abstract execute(user_alarm: UserAlarm): void;

    addUserAlarm(user_id: string, time_before: number, next_time: number | null, triggered: boolean, active: boolean) {
        sql.prepare("INSERT INTO user_alarms (user_id, alarm_id, time_before, next_time, triggered, active) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET time_before = excluded.time_before, next_time = excluded.next_time, active = excluded.active;")
            .run(user_id, this.id, time_before, next_time, +triggered, +active);
        AlarmManager.refresh();
    }
}
