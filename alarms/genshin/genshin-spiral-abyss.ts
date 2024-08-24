import { GenshinClient } from '../../util/hoyo/GenshinClient.ts';
import {UserAlarm} from '../../util/alarm.ts';
import { StaticAlarm } from '../../util/static-alarm.ts';
import DiscordHelper from '../../util/discord-helper.ts';
import config from '../../config.json' with { type: "json" };

class GenshinSpiralAbyss extends StaticAlarm {
    constructor() {
        super("Genshin Spiral Abyss");
    }

    async calcNextTime(): Promise<number> {
        const genshin = new GenshinClient(config.user_id);
        const sa = await genshin.spiralAbyss();
        return sa.recovery_time;
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const genshin = new GenshinClient(userAlarm.user_id);
        const sa = await genshin.spiralAbyss();
        if (sa.stars < sa.max_stars) {
            const message = await genshin.buildUserEmbed();
            message.content = `Spiral Abyss ends <t:${sa.recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog("Spiral abyss is done");
        }
    }
}

export default new GenshinSpiralAbyss();
