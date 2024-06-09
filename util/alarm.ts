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

export abstract class Alarm {
    name: string;
    id: number;

    constructor(name: string) {
        this.name = name;
        let row = sql.prepare("SELECT id FROM alarms WHERE name = ?").get(this.name);
        if (row?.id) {
            this.id = row.id;
        } else {
            row = sql.prepare("INSERT INTO alarms (name) VALUES (?) RETURNING id;").get(this.name);
            this.id = row.id;
        }
    }

    abstract execute(user_alarm: UserAlarm): void;

    addUserAlarm(user_id: string, time_before: number, next_time: number | null, triggered: boolean, active: boolean) {
        sql.prepare("INSERT INTO user_alarms (user_id, alarm_id, time_before, next_time, triggered, active) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET time_before = excluded.time_before, next_time = excluded.next_time, active = excluded.active;")
            .run(user_id, this.id, time_before, next_time, +triggered, +active);
        AlarmManager.refresh();
    }
}
