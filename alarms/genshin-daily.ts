import {GenshinClient, } from '../util/hoyo.ts';
import {timeOnNext} from '../util/functions.js';
import {UserAlarm} from '../util/alarm.ts';
import { StaticAlarm } from '../util/static-alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';

class GenshinDaily extends StaticAlarm {
    constructor() {
        super("Genshin Daily Commissions");
    }

    async calcNextTime(): Promise<number> {
        return timeOnNext(24*60*60, 9*60*60);
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const genshin = new GenshinClient(userAlarm.user_id);
        const bc = await genshin.battleChronicle();
        if (!bc.daily.commission_reward) {
            const message = await genshin.buildUserEmbed();
            message.content = `Daily commissions expire <t:${bc.daily.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("daily commissions are done");
        }
    }
}

export default function() {
    return new GenshinDaily();
}
