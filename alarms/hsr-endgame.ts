import {HsrClient} from '../util/hoyo.ts';
import {UserAlarm} from '../util/alarm.ts';
import { StaticAlarm } from '../util/static-alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';
import config from '../config.json' with { type: "json" };

class HsrEndgame extends StaticAlarm {
    constructor() {
        super("HSR Pure Fiction/Memory of Chaos");
    }

    async calcNextTime(): Promise<number> {
        const hsr = new HsrClient(config.user_id);
        const eg = await hsr.endgameContent();
        return Math.min(...eg.map(e => e.recovery_time));
    }

    async executeUser(userAlarm: UserAlarm): Promise<void> {
        const hsr = new HsrClient(userAlarm.user_id);
        const eg = await hsr.endgameContent();
        if (eg[0].current_stars < eg[0].max_stars) {
            const message = await hsr.buildUserEmbed();
            message.content = `${eg[0].name} ends <t:${eg[0].recovery_time}:R>.`;
            DiscordHelper.whisper(userAlarm.user_id, message);
        } else {
            DiscordHelper.sendToLog(`${eg[0].name} is done`);
        }
    }
}

export default new HsrEndgame();
