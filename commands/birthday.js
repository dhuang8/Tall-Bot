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

let month_names = ["January","February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let months = month_names.map((name, index) =>{
    return {
        name,
        value: index
    }
})

try {
    sql.prepare(`SELECT birthday FROM users`).run()
} catch (e) {
    console.log("adding birthday to table")
    sql.prepare(`ALTER TABLE users ADD COLUMN birthday TEXT`).run()
}
//sql.prepare(`ALTER TABLE tbl_name`

module.exports = new Command({
	name: 'birthday',
    description: 'birthday',
    type: "CHAT_INPUT",
    options: [{
        name: 'set',
        description: 'set your birthday',
        type: 1,
        options: [{
            name: "year",
            description: "year",
            type: "INTEGER",
            required: true
        },{
            name: "month",
            description: "month",
            type: "INTEGER",
            required: true,
            choices: months,
        },{
            name: "day",
            description: "day",
            type: "INTEGER",
            required: true
        }]
    },{
        name: "get",
        description: "get birthday",
        type: 1,
        options: [{
            name: "user",
            description: "get user's birthday",
            type: "USER",
            required: false
        }]
    }],
	async execute(interaction) {
        switch (interaction.options.data[0].name) {
            case "set":
                let args = interaction.options.data[0].options;
                let date = moment(new Date(args[0].value,args[1].value,args[2].value+1));
                sql.prepare("INSERT INTO users(user_id, birthday) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET birthday=excluded.birthday;").run(interaction.user.id, date.format("YYYY-MM-DD"));
                return `\`Birthday set to ${date.format("MMMM D, YYYY")}\``;
            case "get":
                let data = sql.prepare("SELECT birthday FROM users WHERE user_id = ?").get(interaction.options.data[0].options[0].user.id);
                if (data === undefined) return "`No birthday found`";
                let now = moment();
                let birthdate = moment(data.birthday, "YYYY-MM-DD");
                let birthday = birthdate.clone();
                birthday.year(now.year());
                if (birthday.dayOfYear() < now.dayOfYear()) birthday.year(birthday.year()+1);
                return `${interaction.options.data[0].options[0].user} turns ${birthday.year()-birthdate.year()} ${birthday.fromNow()} on ${birthday.format("MMMM D")}`;
            default:
                break;
        }
        return "0";
        /*
        let data;
        try {
            data = await fetch("http://api.pathofexile.com/leagues?type=main&compact=0",{
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
                }
            }).then(res => res.json());
        } catch (e) {
            console.error(e)
            return "`Error loading PoE API`"
        }
        let leaguelist = data.filter((leag) => {
            return leag.rules.every((rule) => {
                return rule.id !== "NoParties";
            })
        }).map(leag=>{
            return {
                title: leag.id,
                response: () => {
                    let stmt = sql.prepare("INSERT INTO users(user_id,poeleague) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET poeleague=excluded.poeleague;");
                    stmt.run(interaction.user.id, leag.id);
                    return `\`PoE league set to ${leag.id}\``;
                }
            }
        })
        let rich = MessageResponse.addList(interaction.channel.id, leaguelist, interaction.user.id);
        return rich;*/
    }
})