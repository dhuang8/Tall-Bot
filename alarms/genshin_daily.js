import sql from '../util/SQLite.js';
import {GenshinClient, } from '../util/hoyo.js';
import {timeOnNext} from '../util/functions.js';
import {Alarm} from '../util/alarm.js';

class GenshinDaily extends Alarm {
    constructor(client) {
        super(client, "Genshin Daily Commissions", timeOnNext(24*60*60, 9*60*60));
        try {
            this.addUserAlarm("", -1, null, 0, 1);
        } catch(e) {
            console.error(e)
            //ignore if it exists
        }
    }

    refresh() {
        sql.prepare("UPDATE alarms SET next_time = ? WHERE id = ?").run(timeOnNext(24*60*60, 9*60*60), this.id);
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
            if (bc.daily.commission_count != bc.daily.commission_max || bc.daily.commission_reward) {
                this.client.users.fetch(user_id).then(user => {
                    user.send(`Daily commissions expire <t:${timeOnNext(24*60*60, 9*60*60)}:R>.`)
                }).catch(e => {
                    this.client.sendToLog("Could not DM", `user: ${user_id}`, e);
                })
            } else {
                this.client.sendToLog("commissions are done");
            }
        } catch (e) {
            this.client.sendToLog("timer error", e)
        }
    }
}

export default function(client) {
    const genshin_daily = new GenshinDaily(client);
    return genshin_daily;
}
