"use strict";
const Command = require('../util/Command');
const moment = require('moment-timezone');
const sql = require('../util/SQLite');

moment.tz.setDefault("America/New_York");

module.exports = new Command({
	name: 'getbirthday',
    type: "USER",
	async execute(interaction) {
        let data = sql.prepare("SELECT birthday FROM users WHERE user_id = ?").get(interaction.options.data[0].user.id);
        if (data === undefined) return "`No birthday found`";
        let now = moment();
        let birthdate = moment(data.birthday, "YYYY-MM-DD");
        let birthday = birthdate.clone();
        birthday.year(now.year());
        if (birthday.dayOfYear() < now.dayOfYear()) birthday.year(birthday.year()+1);
        return `${interaction.options.data[0].user} turns ${birthday.year()-birthdate.year()} ${birthday.fromNow()} on ${birthday.format("MMMM D")}`;
    }
})