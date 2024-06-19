import {timeOnNext} from '../util/functions.js';
import {UserAlarm} from '../util/alarm.ts';
import { StaticAlarm } from '../util/static-alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';
import { HsrClient } from '../util/hoyo.ts';

class HsrWeekly extends StaticAlarm {
    constructor() {
        super("HSR Echo of War");
    }

    async calcNextTime(): Promise<number> {
        return timeOnNext(7*24*60*60, 9*60*60+4*24*60*60);
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const hsr = new HsrClient(userAlarm.user_id);
        const bc = await hsr.battleChronicle();
        if (bc.weekly.current < bc.weekly.max) {
            const message = await hsr.buildUserEmbed();
            message.content = `Echo of War limit resets <t:${bc.weekly.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("weeklies are done");
        }
    }
}

export default new HsrWeekly();
