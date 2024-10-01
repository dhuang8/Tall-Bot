import sql from './SQLite.js';
import { Alarm, UserAlarm } from './alarm.ts';
import config from '../config.json';
import DiscordHelper from './discord-helper.ts';

export abstract class PersonalAlarm extends Alarm {
    waitOnTrigger: number;

    constructor(name: string, triggerOnWait: number) {
        super(name);
        this.waitOnTrigger = triggerOnWait;
    }
    
    triggerAlarm(userAlarm: UserAlarm | string, nextTime: number) {
        const discord_id = (typeof userAlarm == "string") ? userAlarm : userAlarm.user_id;
        sql.prepare("UPDATE user_alarms SET triggered = true, next_time = ? WHERE user_id = ? AND alarm_id = ?").run(nextTime, discord_id, this.id);
    }

    waitNext(userAlarm: UserAlarm | string, nextTime: number) {
        const discord_id = (typeof userAlarm == "string") ? userAlarm : userAlarm.user_id;
        sql.prepare("UPDATE user_alarms SET triggered = false, next_time = ? WHERE user_id = ? AND alarm_id = ?").run(nextTime, discord_id, this.id);
    }

    updateNextTime(discord_id: string, maxRecoveryTime: number) {
        let userAlarm = sql.prepare<[string, number], {triggered: number, time_before: number}>("SELECT triggered, time_before FROM user_alarms WHERE user_id = ? AND alarm_id = ?").get(discord_id, this.id);
        if (userAlarm == null) return;
        if (!userAlarm.triggered) {
            this.waitNext(discord_id, maxRecoveryTime);
            return;
        }
        const cur = Math.floor(Date.now() / 1000);
        const newNext = maxRecoveryTime - userAlarm.time_before;
        if (newNext > cur) {
            this.waitNext(discord_id, maxRecoveryTime);
        } else {
            this.triggerAlarm(discord_id, cur + this.waitOnTrigger );
        }
    }

    abstract executeUser(userAlarm: UserAlarm): Promise<void>;

    async execute(userAlarm: UserAlarm) {
        try {
            await this.executeUser(userAlarm);
        } catch (e) {
            if (typeof e === "string") {
                DiscordHelper.sendToLog(`<@${config.user_id}>`,"timer error", e);
            } else if (e instanceof Error) {
                DiscordHelper.sendToLog(`<@${config.user_id}>`,"timer error", e.toString());
            }
            const cur = Math.floor(Date.now() / 1000);
            // wait 60 min if error
            this.triggerAlarm(userAlarm, cur + 60*60);
        }
    }
}
