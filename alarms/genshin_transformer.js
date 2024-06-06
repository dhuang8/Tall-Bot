import sql from '../util/SQLite.js';
import {GenshinClient, } from '../util/hoyo.js';
import {timeOnNext} from '../util/functions.js';
import {Alarm} from '../util/alarm.js';

class GenshinTransformer extends Alarm {
    constructor(client) {
        super(client, "Genshin Transformer");
        this.trigger_wait = 6*24*60*60;
    }

    refresh() {
    }

    async execute(user_alarm) {
        const user_id = user_alarm.user_id;
        const cur = Math.floor(Date.now() / 1000);
        try {
            const genshin = new GenshinClient(user_id);
            const bc = await genshin.battleChronicle();
            const new_next = bc.transformer.recovery_time - user_alarm.time_before;
            if (new_next > cur) {
                sql.prepare("UPDATE user_alarms SET triggered = false, next_time = ? WHERE user_id = ? AND alarm_id = ?").run(new_next, user_id, this.id);
            } else {
                sql.prepare("UPDATE user_alarms SET triggered = true, next_time = ? WHERE user_id = ? AND alarm_id = ?").run(cur + this.trigger_wait, user_id, this.id);
                if (!user_alarm.triggered) {
                    this.client.users.fetch(user_id).then(user => {
                        user.send(`Transformer available <t:${bc.transformer.recovery_time}:R>.`)
                    }).catch(e => {
                        this.client.sendToLog("Could not DM", `user: ${user_id}`, e);
                    })
                } else {
                    this.client.sendToLog("transformer is triggered");
                }
            }
        } catch (e) {
            this.client.sendToLog("maybe a genshin error", e)
            sql.prepare("UPDATE user_alarms SET next_time = ? WHERE user_id = ? AND alarm_id = ?").run(cur + this.trigger_wait, user_id, this.id);
        }
    }
}

export default function(client) {
    const genshin_transformer = new GenshinTransformer(client);
    return genshin_transformer;
}
