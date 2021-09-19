"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fetch = require('node-fetch');
const {MessageEmbed} = require('discord.js');

function simplifyname(s) {
    s = s.replace(/ /g, "");
    s = s.replace(/-/g, "");
    s = s.replace(/\./g, "");
    s = s.toLowerCase();
    return s;
}
function parseCardText(s) {
    s = s.replace(/\[\[(.+?)\]\]/g, "***$1***");
    s = s.replace(/\[(.+?)\]/g, "**$1**");
    s = s.replace(/<b>(.+?)<\/b>/g, "**$1**");
    s = s.replace(/<i>(.+?)<\/i>/g, "*$1*");
    s = s.replace(/<br\/>/g, "\n");
    return s;
}
function createRich(card) {
    let cardanalytics;
    //if (adbsql) cardanalytics = adbsql.prepare("select * from card where id=?").get(card.code);
    let rich = new MessageEmbed();
    rich.setTitle(card.name);
    if (card.url != null) rich.setURL(card.url)
    let desclines = [];
    if (cardanalytics != null) desclines.push(`Pick Rate: ${Math.round(cardanalytics.count*100/cardanalytics.possible)}%`);
    if (card.faction_name != null) desclines.push(`${card.faction_name}`);
    if (card.type_name != null) desclines.push(`**${card.type_name}**`);
    if (card.traits != null) desclines.push(`*${card.traits}*`);
    if (card.cost != null) desclines.push(`Cost: ${card.cost}`);
    if (card.xp != null) desclines.push(`XP: ${card.xp}`);
    if (card.text != null) desclines.push(parseCardText(card.text));
    rich.setDescription(desclines.join("\n"));
    if (card.imagesrc != null) rich.setImage(`https://arkhamdb.com${card.imagesrc}`);
    if (card.flavor != null) rich.setFooter(card.flavor);
    return rich;
}

let ahdb;

module.exports = new Command({
	name: 'adb',
    description: 'returns Arkham Horror LCG card info',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search or random',
        required: true,
    }],
	async execute(interaction) {
        if (ahdb == null) ahdb = await fetch("https://arkhamdb.com/api/public/cards/").then(res => res.json());
        let cardlist = ahdb.filter(card=>{
            return simplifyname(card.name).indexOf(simplifyname(interaction.options.data[0].value))>-1 || card.code == interaction.options.data[0].value
        }).map(card=>{
            let title = card.xp ? `${card.name} (${card.xp})` : card.name;
            return {
                title,
                response: createRich(card)
            }
        })
        if (cardlist.length == 1) {
            return list[0].response;
        } else if (cardlist.length > 1) {
            return MessageResponse.addList(interaction.channelId, cardlist);
        } else {
            return "`No results`";
        }
    }
})