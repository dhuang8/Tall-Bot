import { ZzzClient } from '../../util/hoyo/ZzzClient.ts';
import {UserAlarm} from '../../util/alarm.ts';
import { StaticAlarm } from '../../util/static-alarm.ts';
import DiscordHelper from '../../util/discord-helper.ts';
import { nextBimonthly } from '../../util/hoyo/HoyoClient.ts';

class ZzzShiyuDefense extends StaticAlarm {
    constructor() {
        super("ZZZ Shiyu Defense");
    }

    async calcNextTime(): Promise<number> {
        return nextBimonthly();
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const zzz = new ZzzClient(userAlarm.user_id);
        const cn = await zzz.criticalNode();
        if (cn.s_ranks.cur < cn.s_ranks.max) {
            const message = await zzz.buildUserEmbed();
            message.content = `Critical Node ends <t:${cn.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("Critical Node is done");
        }
    }
}

export default new ZzzShiyuDefense();
