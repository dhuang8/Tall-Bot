import sql from '../util/SQLite.js';
import {GenshinClient, } from '../util/hoyo.js';
import {Alarm} from '../util/alarm.js';
import config from '../config.json' with { type: "json" };

class GenshinSpiralAbyss extends Alarm {
    constructor(client) {
        super(client, "Genshin Spiral Abyss");
        try {
            this.addUserAlarm("", -1, null, 0, 1);
        } catch(e) {
            console.error(e)
            //ignore if it exists
        }
    }

    async refresh() {
        const genshin = new GenshinClient(config.user_id);
        const sa = await genshin.spiralAbyss();
        sql.prepare("UPDATE alarms SET next_time = ? WHERE id = ?").run(sa.recovery_time, this.id);
        sql.prepare("UPDATE user_alarms SET active = true WHERE alarm_id = ?").run(this.id);
    }

    async execute(user_alarm) {
        const user_id = user_alarm.user_id;
        if (user_id == "") {
            await this.refresh();
            return;
        }
        sql.prepare("UPDATE user_alarms SET active = false WHERE user_id = ? AND alarm_id = ?").run(user_id, this.id);
        try {
            const genshin = new GenshinClient(user_id);
            const sa = await genshin.spiralAbyss();
            if (sa.current < sa.max) {
                this.client.users.fetch(user_id).then(user => {
                    user.send(`Spiral abyss ends <t:${sa.recovery_time}:R>.`)
                }).catch(e => {
                    this.client.sendToLog("Could not DM", `user: ${user_id}`, e);
                })
            } else {
                this.client.sendToLog("Spiral abyss is done");
            }
        } catch (e) {
            this.client.sendToLog("timer error", e)
        }
    }
}

export default function(client) {
    const genshin_spiral_abyss = new GenshinSpiralAbyss(client);
    return genshin_spiral_abyss;
}
