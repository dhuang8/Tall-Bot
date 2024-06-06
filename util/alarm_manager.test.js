import {AlarmManager} from "./alarm_manager.js";
import sql from '../util/SQLite.js';

test('first alarm', async () => {
    const manager = new AlarmManager(null);
    manager.addAlarm({id: 1})
    const user_alarm = manager.getFirstAlarm();
    console.log(user_alarm);
    expect(user_alarm.alarm_name).toBe("Genshin Daily Commissions");
});

test('first n alarms', async () => {
    const manager = new AlarmManager(null);
    manager.addAlarm({id: 1})
    const user_alarms = manager.getFirstNAlarms(10);
    console.log(user_alarms);
    // expect(user_alarm.alarm_id).toBe(1);
});

test('alarms', async () => {
    const manager = new AlarmManager(null);
    manager.addAlarm({id: 1})
    console.log(manager.alarms.get(1));
});

test('sql returning', async () => {
    const rows = sql.prepare(`INSERT INTO alarm_ids (name) VALUES ('testalarm8') on conflict (name) do update set name=name RETURNING *;`).all();
    console.log(rows);
});

test('sql returning2', async () => {
    const rows = sql.prepare(`INSERT INTO alarm_ids (name) VALUES ('testalarm10') on conflict (name) do update set name=name RETURNING *;`).all();
    console.log(rows);
});

test('get alarm from name', async () => {
    const manager = new AlarmManager(null);
    manager.addAlarm({id: 1, name: "test"})
    const user_alarm = manager.getAlarmFromName("test");
    console.log(user_alarm);
});