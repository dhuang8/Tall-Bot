import { UserAlarm } from '../../util/alarm.ts';
import DiscordHelper from '../../util/discord-helper.ts';
import { GenshinClient } from '../../util/hoyo/GenshinClient.ts';
import { PersonalAlarm } from '../../util/personal-alarm.ts';

class GenshinTransformer extends PersonalAlarm {
    constructor() {
        super("Genshin Transformer", 3*24*60*60);
    }

    async executeUser(userAlarm: UserAlarm) {
        const genshin = new GenshinClient(userAlarm.user_id);
        const bc = await genshin.battleChronicle();
        const cur = Math.floor(Date.now() / 1000);
        const newNext = bc.transformer.recovery_time - userAlarm.time_before;
        if (newNext > cur) {
            this.waitNext(userAlarm, bc.transformer.recovery_time);
        } else {
            this.triggerAlarm(userAlarm, cur + this.waitOnTrigger );
            if (!userAlarm.triggered) {
                const message = await genshin.buildUserEmbed();
                message.content = `Transformer available <t:${bc.transformer.recovery_time}:R>.`;
                DiscordHelper.whisper(userAlarm.user_id, message);
            } else {
                DiscordHelper.sendToLog("transformer is already triggered");
            }
        }
    }
}

export default new GenshinTransformer();
