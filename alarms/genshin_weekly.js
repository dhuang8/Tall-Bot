import sql from '../util/SQLite.js';
import {GenshinClient, } from '../util/hoyo';
import {timeOnNext} from '../util/functions.js';
import {Alarm} from '../util/alarm.js';

class GenshinWeekly extends Alarm {
    constructor(client) {
        super(client, "Genshin Weekly Trounce", timeOnNext(7*24*60*60, 9*60*60+4*24*60*60));
        try {
            this.addUserAlarm("", -1, null, 0, 1);
        } catch(e) {
            console.error(e)
            //ignore if it exists
        }
    }

    refresh() {
        sql.prepare("UPDATE alarms SET next_time = ? WHERE id = ?").run(timeOnNext(7*24*60*60, 9*60*60+4*24*60*60), this.id);
        sql.prepare("UPDATE user_alarms SET active = true WHERE alarm_id = ?").run(this.id);
    }

    async execute(user_alarm) {
        const user_id = user_alarm.user_id;
        if (user_id == "") {
            this.refresh();
            return;
        }
        sql.prepare("UPDATE user_alarms SET active = false WHERE user_id = ? AND alarm_id = ?").run(user_id, this.id);
        try {
            const genshin = new GenshinClient(user_id);
            const bc = await genshin.battleChronicle();
            if (bc.weekly.half_cost_count < bc.weekly.half_cost_max) {
                this.client.users.fetch(user_id).then(user => {
                    user.send(`Your weekly trounces expire <t:${timeOnNext(7*24*60*60, 9*60*60+4*24*60*60)}:R>.`)
                }).catch(e => {
                    this.client.sendToLog("Could not DM", `user: ${user_id}`, e);
                })
            } else {
                this.client.sendToLog("weekly trounces are done");
            }
        } catch (e) {
            this.client.sendToLog("timer error", e)
        }
    }
}

export default function(client) {
    const genshin_weekly = new GenshinWeekly(client);
    return genshin_weekly;
}
