import sql from './SQLite.js';
import { EmbedBuilder } from 'discord.js';

class AlarmManager {
    constructor(client) {
        // this.client = client;
        this.alarms = new Map();
        this.timeout = null;
    }

    attachClient(client) {
        this.client = client;
    }

    getAlarmFromName(name) {
        let iter = this.alarms.values();
        for (let i = 0; i < this.alarms.size; i++) {
            let alarm = iter.next().value;
            if (alarm.name == name) return alarm;
        }
        return null;
    }

    addAlarm(alarm) {
        this.alarms.set(alarm.id, alarm);
    }

    addAlarms(alarms) {
        alarms.forEach(alarm => {
            this.addAlarm(alarm);
        })
    }

    refresh() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
            this.loop();
        }
        this.client.sendEmbedToLog(this.createAlarmEmbed());
    }

    async loop() {
        //TODO "multithread" alarms
        let user_alarm = this.getFirstAlarm();
        this.client.sendToLog("user alarm", JSON.stringify(user_alarm));
        let cur_epoch = Date.now()/1000;
        if (!user_alarm) {
            this.client.sendToLog("inactive alarm");
        } else if (user_alarm.next_time <= cur_epoch) {
            this.client.sendToLog("alarm", `${user_alarm.alarm_id} - ${user_alarm.user_id}`);
            let alarm = this.alarms.get(user_alarm.alarm_id);
            await alarm.execute(user_alarm);
            this.timeout = setTimeout(()=> {
                this.loop();
            }, 5000)
        } else {
            let sleepMs = Math.max(5000, (user_alarm.next_time-cur_epoch) * 1000);
            this.client.sendToLog(`next alarm in ${sleepMs/1000} seconds.`, `${user_alarm.alarm_id} - ${user_alarm.user_id}`);
            this.timeout = setTimeout(()=> {
                this.loop();
            }, sleepMs)
        }
        this.client.sendEmbedToLog(this.createAlarmEmbed());
    }

    getFirstAlarm() {
        let rows = this.getFirstNAlarms(1);
        return rows[0];
    }

    getFirstNAlarms(n) {
        let rows = sql.prepare("SELECT user_id, alarm_id, name as alarm_name, time_before, MAX(strftime('%s', 'now')-1, COALESCE(user_alarms.next_time - time_before * NOT triggered, alarms.next_time - time_before, 0)) AS next_time, triggered FROM user_alarms LEFT JOIN alarms ON user_alarms.alarm_id = alarms.id WHERE active = TRUE AND alarm_id IN (SELECT value FROM json_each(?)) ORDER BY next_time ASC, triggered DESC LIMIT ?")
           .all(JSON.stringify(Array.from(this.alarms.keys())), n);
        return rows;
    }

    createAlarmEmbed() {
        const user_alarms = this.getFirstNAlarms(10);
        let desc = user_alarms.map(user_alarm => {
            return `${user_alarm.alarm_name} - ${user_alarm.user_id} - <t:${user_alarm.next_time}:R> - <t:${user_alarm.next_time}>`;
        }).join("\n");
        if (desc == "") desc = "No alarms active";
        return new EmbedBuilder()
            .setTitle('All Alarms')
            .setDescription(desc);
    }

    createUserAlarmEmbed(user_id) {
        let user_alarms = sql.prepare("SELECT name as alarm_name, time_before FROM user_alarms LEFT JOIN alarms ON user_alarms.alarm_id = alarms.id WHERE user_id = ? AND alarm_id IN (SELECT value FROM json_each(?))")
           .all(user_id, JSON.stringify(Array.from(this.alarms.keys())));
        let desc = user_alarms.map((user_alarm, i) => {
            return `${i+1}. ${user_alarm.alarm_name} - ${user_alarm.time_before/60} minutes before`;
        }).join("\n");
        if (desc == "") desc = "No alerts active";
        return new EmbedBuilder()
            .setTitle('Alerts')
            .setDescription(desc);
    }
}

export default new AlarmManager();
