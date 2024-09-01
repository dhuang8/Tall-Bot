import { ZzzClient } from '../../util/hoyo/ZzzClient.ts';
import {UserAlarm} from '../../util/alarm.ts';
import { StaticAlarm } from '../../util/static-alarm.ts';
import DiscordHelper from '../../util/discord-helper.ts';
import config from '../../config.json' with { type: "json" };
import { GenshinClient } from '../../util/hoyo/GenshinClient.ts';

class ZzzShiyuDefense extends StaticAlarm {
    constructor() {
        super("ZZZ Shiyu Defense");
    }

    async calcNextTime(): Promise<number> {
        const genshin = new GenshinClient(config.user_id);
        const sa = await genshin.spiralAbyss();
        return sa.recovery_time;
        // const zzz = new ZzzClient(config.user_id);
        // const cn = await zzz.criticalNode();
        // return cn.recovery_time;
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
