"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const {MessageEmbed} = require('discord.js');
const fetch = require('node-fetch');
const config = require('../util/config');
const {escapeMarkdownText} = require('../util/functions');
//var HttpsProxyAgent = require('https-proxy-agent');

module.exports = new Command({
	name: 'news',
    description: 'search news articles',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: `"WORDS IN QUOTES" for exact match. +WORD must appear in article. -WORD must not appear.`,
        required: true,
    }],
	async execute(interaction) {
        async function smmry(e) {
            let response = await fetch(`http://api.smmry.com/&SM_API_KEY=${config.api.smmry}`, {
                method: "POST",
                body: `sm_api_input=${test}`,
                //agent:new HttpsProxyAgent('http://127.0.0.1:8888'),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then(res => {
                return res.json();
            });
            if (response.sm_api_error) {
                return `\`${response.sm_api_message}\``;
            }
            let summary = response.sm_api_content;
            summary = summary.replace(/\[BREAK\]/g, "\n\n");
            let rich = new MessageEmbed()
                .setTitle(`${e.title} (Summarized)`)
                .setURL(e.url)
                .setDescription(summary)
            return rich;
        }
        let response;
        if (interaction.options.data.length>0) {
            response = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(`${interaction.options.data[0].value}`)}&apiKey=${config.api.news}&sortBy=publishedAt&language=en&pageSize=20`).then(res => res.json());
        } else {
            response = await fetch(`https://newsapi.org/v2/top-headlines?apiKey=${config.api.news}&pageSize=20&language=en`).then(res => res.json());
        }
        let desc = response.articles.filter((e, i, arr) => {
            return arr.findIndex((that_e) => {
                return that_e.title.toLowerCase() === e.title.toLowerCase();
            }) === i;
        }).map(e => {
            return {
                title: `${e.source.name}: **[${escapeMarkdownText(e.title)}](${escapeMarkdownText(e.url)})**`,
                response: async () => { return smmry(e) }
            };
        })


        if (desc.length == 1) {
            return await desc[0].response()
        } else if (desc.length < 1) {
            return "`No results found`";
        } else {
            let rich = MessageResponse.addList(interaction.channelID, desc);
            rich.setTitle(`Recent News${interaction.options.data[0].value ? `: ${escapeMarkdownText(interaction.options.data[0].value)}` : ""}`);
            return rich;
        }
    }
})