import AlarmManager from "./alarm-manager.js";
import sql from './SQLite.js';

test('export alarm', async () => {
    console.log(AlarmManager);
});

test('first alarm', async () => {
    AlarmManager.addAlarm({id: 1})
    const user_alarm = AlarmManager.getFirstAlarm();
    console.log(user_alarm);
    expect(user_alarm.alarm_name).toBe("Genshin Daily Commissions");
});

test('first n alarms', async () => {
    AlarmManager.addAlarm({id: 1})
    const user_alarms = AlarmManager.getFirstNAlarms(10);
    console.log(user_alarms);
    // expect(user_alarm.alarm_id).toBe(1);
});

test('alarms', async () => {
    AlarmManager.addAlarm({id: 1})
    console.log(manager.alarms.get(1));
});

test('get alarm from name', async () => {
    AlarmManager.addAlarm({id: 1, name: "test"})
    const user_alarm = AlarmManager.getAlarmFromName("test");
    console.log(user_alarm);
});