import { UserAlarm } from '../util/alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';
import {ZzzClient} from '../util/hoyo.ts';
import { PersonalAlarm } from '../util/personal-alarm.ts';

class ZzzBc extends PersonalAlarm {
    constructor() {
        super("ZZZ Battery Charge", 3*60*60);
    }

    async executeUser(userAlarm: UserAlarm) {
        const zzz = new ZzzClient(userAlarm.user_id);
        const bc = await zzz.battleChronicle();
        const cur = Math.floor(Date.now() / 1000);
        const newNext = bc.battery_charge.recovery_time - userAlarm.time_before;
        if (newNext > cur) {
            this.waitNext(userAlarm, bc.battery_charge.recovery_time);
        } else {
            this.triggerAlarm(userAlarm, cur + this.waitOnTrigger );
            if (!userAlarm.triggered) {
                const message = await zzz.buildUserEmbed();
                message.content = `BC capped <t:${bc.battery_charge.recovery_time}:R>.`;
                DiscordHelper.whisper(userAlarm.user_id, message);
            } else {
                DiscordHelper.sendToLog("BC is triggered again");
            }
        }
    }
}

export default new ZzzBc();
