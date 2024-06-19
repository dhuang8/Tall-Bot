import { UserAlarm } from '../util/alarm.ts';
import DiscordHelper from '../util/discord-helper.ts';
import {HsrClient} from '../util/hoyo.ts';
import { PersonalAlarm } from '../util/personal-alarm.ts';

class HsrAssignment extends PersonalAlarm {
    constructor() {
        super("HSR Assignments", 3*60*60);
    }

    async executeUser(userAlarm: UserAlarm) {
        const hsr = new HsrClient(userAlarm.user_id);
        const bc = await hsr.battleChronicle();
        const cur = Math.floor(Date.now() / 1000);
        const maxRecoveryTime = Math.max(...bc.assignments.map(assignment => assignment.recovery_time));
        const newNext = maxRecoveryTime - userAlarm.time_before;
        if (newNext > cur) {
            this.waitNext(userAlarm, maxRecoveryTime);
        } else {
            this.triggerAlarm(userAlarm, cur + this.waitOnTrigger );
            if (!userAlarm.triggered) {
                const message = await hsr.buildUserEmbed();
                message.content = `Assignments are ready <t:${maxRecoveryTime}:R>.`;
                DiscordHelper.whisper(userAlarm.user_id, message);
            } else {
                DiscordHelper.sendToLog("Assignment is triggered again");
            }
        }
    }
}

export default new HsrAssignment();
