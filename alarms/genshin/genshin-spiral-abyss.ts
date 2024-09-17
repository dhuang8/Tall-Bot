import { GenshinClient } from '../../util/hoyo/GenshinClient.ts';
import {UserAlarm} from '../../util/alarm.ts';
import { StaticAlarm } from '../../util/static-alarm.ts';
import DiscordHelper from '../../util/discord-helper.ts';
import { nextBimonthly } from '../../util/hoyo/HoyoClient.ts';

class GenshinSpiralAbyss extends StaticAlarm {
    constructor() {
        super("Genshin Spiral Abyss");
    }

    async calcNextTime(): Promise<number> {
        return nextBimonthly()
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const genshin = new GenshinClient(userAlarm.user_id);
        const eg = await genshin.endgameContent();
        if (eg[0].current < eg[0].max) {
            const message = await genshin.buildUserEmbed();
            message.content = `${eg[0].name} ends <t:${eg[0].recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog(`${eg[0].name} is done`);
        }
    }
}

export default new GenshinSpiralAbyss();
