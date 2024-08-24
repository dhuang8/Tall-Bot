import { UserAlarm } from '../../util/alarm.ts';
import DiscordHelper from '../../util/discord-helper.ts';
import { HsrClient } from '../../util/hoyo/HsrClient.ts';
import { PersonalAlarm } from '../../util/personal-alarm.ts';

class HsrTp extends PersonalAlarm {
    constructor() {
        super("HSR Trailblaze Power", 3*60*60);
    }

    async executeUser(userAlarm: UserAlarm) {
        const hsr = new HsrClient(userAlarm.user_id);
        const bc = await hsr.battleChronicle();
        const cur = Math.floor(Date.now() / 1000);
        const newNext = bc.trailblaze_power.recovery_time - userAlarm.time_before;
        if (newNext > cur) {
            this.waitNext(userAlarm, bc.trailblaze_power.recovery_time);
        } else {
            this.triggerAlarm(userAlarm, cur + this.waitOnTrigger );
            if (!userAlarm.triggered) {
                const message = await hsr.buildUserEmbed();
                message.content = `TP capped <t:${bc.trailblaze_power.recovery_time}:R>.`;
                DiscordHelper.whisper(userAlarm.user_id, message);
            } else {
                DiscordHelper.sendToLog("TP is triggered again");
            }
        }
    }
}

export default new HsrTp();
