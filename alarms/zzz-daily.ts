import {ZzzClient} from '../util/hoyo.ts';
import {timeOnNext} from '../util/functions.js';
import {UserAlarm} from '../util/alarm.ts';
import { StaticAlarm } from '../util/static-alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';

class ZzzDaily extends StaticAlarm {
    constructor() {
        super("ZZZ Dailies");
    }

    async calcNextTime(): Promise<number> {
        return timeOnNext(24*60*60, 9*60*60);
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const zzz = new ZzzClient(userAlarm.user_id);
        const bc = await zzz.battleChronicle();
        if (bc.daily.engagement.current < bc.daily.engagement.max || bc.daily.scratch_card.current < bc.daily.scratch_card.max) {
            const message = await zzz.buildUserEmbed();
            message.content = `Dailies expire <t:${bc.daily.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("dailies are done");
        }
    }
}

export default new ZzzDaily();
