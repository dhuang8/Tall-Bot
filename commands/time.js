"use strict";
import Command from '../util/Command.js';
import moment from 'moment-timezone';

moment.tz.setDefault("America/New_York");

export default new Command({
	name: 'time',
    description: 'responds with the time at several time zones',
    type: "CHAT_INPUT",
	execute(interaction) {
        let fullZones = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tokyo", "Etc/UTC"];
        let inputTime = moment();
        let msg = inputTime.valueOf() + "\n";
        msg += fullZones.map((v) => {
            return inputTime.tz(v).format('ddd, MMM Do YYYY, h:mma z')
        }).join("\n");
        msg = "`" + msg + "`";
        return msg;
	},
});