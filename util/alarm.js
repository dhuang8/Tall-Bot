import sql from '../util/SQLite.js';

export class Alarm {
    constructor(client, name, next_time = null) {
        this.client = client;
        this.name = name;
        let row = sql.prepare("SELECT id FROM alarms WHERE name = ?").get(this.name);
        if (row?.id) {
            this.id = row.id;
        } else {
            row = sql.prepare("INSERT INTO alarms (name, next_time) VALUES (?, ?) RETURNING id;").get(this.name, next_time);
            this.client.alarm_manager.refresh();
            this.id = row.id;
        }
    }

    setup() {

    }

    execute(user_alarm) {

    }

    addUserAlarm(user_id, time_before, next_time, triggered, active) {
        sql.prepare("INSERT INTO user_alarms (user_id, alarm_id, time_before, next_time, triggered, active) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET time_before = excluded.time_before, next_time = excluded.next_time, triggered = excluded.triggered, active = excluded.active;")
            .run(user_id, this.id, time_before, next_time, triggered, active);
        this.client.alarm_manager.refresh();
    }
}
