"use strict";
import Command from '../util/Command.js';
import MessageResponse from '../util/MessageResponse.js';
import fetch from 'node-fetch';
import {MessageEmbed} from 'discord.js';

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

function cardRich(card) {
    let rich = new MessageEmbed()
        .setTitle(card.name)
        .setImage(card.imageUrl)
    if (card.multiverseid) {
        rich.setURL(`https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${card.multiverseid}`)
    }
    let desc_lines = [];
    if (card.manaCost) desc_lines.push(`Mana Cost: ${replaceIcons(card.manaCost)}`)
    if (card.type) desc_lines.push(`**${replaceIcons(card.type)}**`)
    if (card.text) desc_lines.push(replaceIcons(escapeMarkdownText(card.text)));
    let stats = ""
    if (card.power) stats += card.power;
    if (card.toughness) stats += "/" + card.toughness;
    if (stats !== "") desc_lines.push(stats);
    if (card.flavor) desc_lines.push(`\n*_${card.flavor}_*`);

    rich.setDescription(desc_lines.join("\n"))
    return rich;
}

function replaceIcons(text) {
    let icons = {
        "{R/G}": `<:mtg_ur:609868515255517215>`,
        "{U/R}": `<:mtg_ur:609868528182493186>`,
        "{R/W}": `<:mtg_rw:609867524061921320>`,
        "{W/B}": `<:mtg_wb:609867910772424748>`,
        "{B/R}": `<:mtg_br:609867020770607104>`,
        "{B/G}": `<:mtg_bg:609860420127424518>`,
        "{E}": `<:mtg_e:584109084861530132>`,
        "{W}": `<:mtg_w:584108894595448970>`,
        "{U}": `<:mtg_u:584108894922735629>`,
        "{T}": `<:mtg_t:584108894591254535>`,
        "{R}": `<:mtg_r:584108894524276746>`,
        "{G}": `<:mtg_g:584108863607930881>`,
        "{B}": `<:mtg_b:584108877440876544>`,
        "{C}": `<:mtg_c:584131157206237184>`,
        "{X}": `:regional_indicator_x:`,
        "{1}": `:one:`,
        "{2}": `:two:`,
        "{3}": `:three:`,
        "{4}": `:four:`,
        "{5}": `:five:`,
        "{6}": `:six:`,
        "{7}": `:seven:`,
        "{8}": `:eight:`,
        "{9}": `:nine:`,
    }
    Object.keys(icons).forEach(icon => {
        let literal = icon.replace(/\{/g, `\\{`).replace(/\}/g, `\\}`)
        text = text.replace(new RegExp(literal, 'g'), icons[icon]);
    })
    return text;
}

export default new Command({
	name: 'mtg',
    description: 'returns Magic the Gathering card info',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search or random',
        required: true,
    }],
	async execute(interaction) {
        //https://docs.magicthegathering.io/#api_v1cards_list
        let response;
        if (interaction.options.data[0].value.toLowerCase() === "random") {
            response = await fetch(`https://api.magicthegathering.io/v1/cards?random=true&pageSize=100`).then(res => res.json());
            response.cards = [response.cards.find(card => {
                return card.multiverseid !== undefined;
            })]
        } else {
            response = await rp(`https://api.magicthegathering.io/v1/cards?name=${encodeURIComponent(interaction.options.data[0].value)}&orderBy=name`).then(res => res.json());
        }
        let card_list = {}

        response.cards.forEach((card) => {
            card.checkid = card.multiverseid || 0;
            if (!card_list[card.name]) card_list[card.name] = card;
            else if (card_list[card.name].checkid < card.checkid) card_list[card.name] = card
        })

        card_list = Object.values(card_list).map(card => {
            return {title: card.name, response: cardRich(card) }
        })

        if (card_list.length < 1) {
            return "`No results`";
        } else if (card_list.length == 1) {
            return card_list[0].response;
        } else {
            return MessageResponse.addList(interaction.channelId, card_list);
        }
    }
})