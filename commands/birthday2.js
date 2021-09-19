"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fs = require('fs');
const {MessageEmbed} = require('discord.js');
const fetch = require('node-fetch');
const { CanvasRenderService } = require('chartjs-node-canvas');
const moment = require('moment-timezone');
const config = require('../util/config');
const {escapeMarkdownText} = require('../util/functions');
const sql = require('../util/SQLite');

moment.tz.setDefault("America/New_York");
//sql.prepare(`ALTER TABLE tbl_name`

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