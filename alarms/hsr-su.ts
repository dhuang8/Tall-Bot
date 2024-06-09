import {timeOnNext} from '../util/functions.js';
import {UserAlarm} from '../util/alarm.ts';
import { StaticAlarm } from '../util/static-alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';
import { HsrClient } from '../util/hoyo.ts';

class HsrSu extends StaticAlarm {
    constructor() {
        super("HSR Simulated Universe");
    }

    async calcNextTime(): Promise<number> {
        return timeOnNext(7*24*60*60, 9*60*60+4*24*60*60);
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const hsr = new HsrClient(userAlarm.user_id);
        const su = await hsr.simulatedUniverse();
        if (su.current < su.max) {
            const message = await hsr.buildUserEmbed();
            message.content = `Simulated Universe resets <t:${su.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("su is done");
        }
    }
}

export default function() {
    return new HsrSu();
}
