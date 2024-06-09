import { UserAlarm } from '../util/alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';
import {GenshinClient, } from '../util/hoyo.js';
import { PersonalAlarm } from '../util/personal-alarm.ts';

class GenshinResin extends PersonalAlarm {
    constructor() {
        super("Genshin Resin", 3*60*60);
    }

    async executeUser(userAlarm: UserAlarm) {
        const genshin = new GenshinClient(userAlarm.user_id);
        const bc = await genshin.battleChronicle();
        const cur = Math.floor(Date.now() / 1000);
        const newNext = bc.resin.recovery_time - userAlarm.time_before;
        if (newNext > cur) {
            this.waitNext(userAlarm, bc.resin.recovery_time);
        } else {
            this.triggerAlarm(userAlarm, cur + this.waitOnTrigger );
            if (!userAlarm.triggered) {
                const message = await genshin.buildUserEmbed();
                message.content = `Resin capped <t:${bc.resin.recovery_time}:R>.`;
                DiscordHelper.whisper(userAlarm.user_id, message);
            } else {
                DiscordHelper.sendToLog("Resin is triggered again");
            }
        }
    }
}

export default function() {
    return new GenshinResin();
}
