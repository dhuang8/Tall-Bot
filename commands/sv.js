"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const {MessageEmbed} = require('discord.js');
const {escapeMarkdownText, htmldecode} = require('../util/functions');

module.exports = new Command({
	name: 'sv',
    description: 'returns shadowverse card info',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search',
        required: true,
    }],
	async execute(interaction) {
        let body = await fetch(
            `https://shadowverse-portal.com/cards?card_name=${encodeURIComponent(interaction.options.data[0].value)}&lang=en&include_token=1`, {
                headers: {
                    "Accept-Language": "en-us"
                }
            }
        ).then(res => res.text());
        let $ = cheerio.load(body);
        let list = [];
        $(".el-card-detail").each(function (i, e) {
            let pic = $(this).find(".el-card-detail-image").first().attr("data-src").replace(/(\?.+)/g, "");
            let name = $(this).find(".el-card-detail-name").first().text().trim();
            let link = "https://shadowverse-portal.com" + $(this).attr("href");
            let tribe = $(this).find(".el-card-detail-tribe-name").first().text().trim();
            let desc = "";
            let embed = new MessageEmbed();
            embed.setImage(pic);
            embed.setTitle(escapeMarkdownText(htmldecode(name)));
            embed.setURL(link);
            if (tribe !== "-") desc += tribe + "\n";
            $(this).find(".el-card-detail-status").each(function (i, e) {
                if ($(this).find(".el-card-detail-status-header").text().trim() == "") {
                    desc += htmldecode($(this).find(".el-card-detail-skill-description").html().trim().replace(/<br>/g, "\n"));
                } else {
                    let fieldtitle = $(this).find(".el-label-card-state").text().trim();
                    let atk = $(this).find(".is-atk").text().trim();
                    let def = $(this).find(".is-life").text().trim();
                    let desc = htmldecode($(this).find(".el-card-detail-skill-description").html().trim().replace(/<br>/g, "\n"));
                    embed.addField(escapeMarkdownText(htmldecode(fieldtitle)), `${atk}/${def}\n${escapeMarkdownText(desc)}`)
                }
            })
            embed.setDescription(escapeMarkdownText(htmldecode(desc)));
            list.push({title: name, response: embed});
        })
        if (list.length < 1) {
            return "`No results`";
        } else if (list.length == 1) {
            return list[0].response;
        } else {
            return MessageResponse.addList(interaction.channelId, list);
        }
	}
});