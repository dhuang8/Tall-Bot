import { HsrClient } from '../../util/hoyo/HsrClient.ts';
import {timeOnNext} from '../../util/functions.js';
import {UserAlarm} from '../../util/alarm.ts';
import { StaticAlarm } from '../../util/static-alarm.ts';
import DiscordHelper from '../../util/discord-helper.ts';

class HsrDaily extends StaticAlarm {
    constructor() {
        super("HSR Daily Training");
    }

    async calcNextTime(): Promise<number> {
        return timeOnNext(24*60*60, 9*60*60);
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const hsr = new HsrClient(userAlarm.user_id);
        const bc = await hsr.battleChronicle();
        if (bc.daily.current < bc.daily.max) {
            const message = await hsr.buildUserEmbed();
            message.content = `Daily expires <t:${bc.daily.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("dailies are done");
        }
    }
}

export default new HsrDaily();
