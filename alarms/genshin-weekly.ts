import {GenshinClient, } from '../util/hoyo.ts';
import {timeOnNext} from '../util/functions.js';
import {UserAlarm} from '../util/alarm.ts';
import { StaticAlarm } from '../util/static-alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';

class GenshinWeekly extends StaticAlarm {
    constructor() {
        super("Genshin Weekly Trounce");
    }

    async calcNextTime(): Promise<number> {
        return timeOnNext(7*24*60*60, 9*60*60+4*24*60*60);
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const genshin = new GenshinClient(userAlarm.user_id);
        const bc = await genshin.battleChronicle();
        if (bc.weekly.half_cost_count < bc.weekly.half_cost_max) {
            const message = await genshin.buildUserEmbed();
            message.content = `Your weekly trounces expire <t:${bc.weekly.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("weekly trounces are done");
        }
    }
}

export default new GenshinWeekly();
