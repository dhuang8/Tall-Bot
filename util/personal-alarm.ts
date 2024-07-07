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
    
    triggerAlarm(userAlarm: UserAlarm, nextTime: number) {
        sql.prepare("UPDATE user_alarms SET triggered = true, next_time = ? WHERE user_id = ? AND alarm_id = ?").run(nextTime, userAlarm.user_id, this.id);
    }

    waitNext(userAlarm: UserAlarm, nextTime: number) {
        sql.prepare("UPDATE user_alarms SET triggered = false, next_time = ? WHERE user_id = ? AND alarm_id = ?").run(nextTime, userAlarm.user_id, this.id);
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
            // wait 5 min if error
            this.waitNext(userAlarm, cur + 5*60);
        }
    }
}
