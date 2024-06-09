import { UserAlarm } from '../util/alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';
import { GenshinClient } from '../util/hoyo.ts';
import { PersonalAlarm } from '../util/personal-alarm.ts';

class GenshinExpedition extends PersonalAlarm {
    constructor() {
        super("Genshin Expeditions", 3*60*60);
    }

    async executeUser(userAlarm: UserAlarm) {
        const genshin = new GenshinClient(userAlarm.user_id);
        const bc = await genshin.battleChronicle();
        const cur = Math.floor(Date.now() / 1000);
        const maxRecoveryTime = Math.max(...bc.expeditions.map(expedition => expedition.recovery_time));
        const newNext = maxRecoveryTime - userAlarm.time_before;
        if (newNext > cur) {
            this.waitNext(userAlarm, maxRecoveryTime);
        } else {
            this.triggerAlarm(userAlarm, cur + this.waitOnTrigger );
            if (!userAlarm.triggered) {
                const message = await genshin.buildUserEmbed();
                message.content = `Expeditions are ready <t:${maxRecoveryTime}:R>.`;
                DiscordHelper.whisper(userAlarm.user_id, message);
            } else {
                DiscordHelper.sendToLog("Expedition is triggered again");
            }
        }
    }
}

export default function() {
    return new GenshinExpedition();
}
