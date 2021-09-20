"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fetch = require('node-fetch');
const moment = require('moment-timezone');
const sql = require('../util/SQLite');

moment.tz.setDefault("America/New_York");

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

let poe_leagues = [];
fetch("https://www.pathofexile.com/api/trade/data/leagues",{
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
    }
}).then(res => res.json()).then(json => {
    poe_leagues = json.result.map(leag => {
        return leag.id
    });
})

module.exports = new Command({
	name: 'setpoeleague',
    description: 'sets the poe league for /poetrade search',
    type: "CHAT_INPUT",
    options: [],
	async execute(interaction) {
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
        return rich;
    }
})