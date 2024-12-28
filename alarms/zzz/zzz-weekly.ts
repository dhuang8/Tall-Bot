import {timeOnNext} from '../../util/functions.js';
import {UserAlarm} from '../../util/alarm.ts';
import { StaticAlarm } from '../../util/static-alarm.ts';
import DiscordHelper from '../../util/discord-helper.ts';
import { ZzzClient } from '../../util/hoyo/ZzzClient.ts';

class ZzzWeekly extends StaticAlarm {
    constructor() {
        super("ZZZ Hollow Zero");
    }

    async calcNextTime(): Promise<number> {
        return timeOnNext(7*24*60*60, 9*60*60+4*24*60*60);
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const zzz = new ZzzClient(userAlarm.user_id);
        const bc = await zzz.battleChronicle();
        if (bc.weekly.weekly_points.current < bc.weekly.weekly_points.max || 
            bc.weekly.bounty_commission.current < bc.weekly.bounty_commission.max
        ) {
            const message = await zzz.buildUserEmbed();
            message.content = `Weeklies resets <t:${bc.weekly.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("zzz weeklies are done");
        }
    }
}

export default new ZzzWeekly();
