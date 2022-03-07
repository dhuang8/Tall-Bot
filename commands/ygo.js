import Command from '../util/Command.js';
import {MessageEmbed} from 'discord.js';
import fetch from 'node-fetch';
import MessageResponse from '../util/MessageResponse.js';

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

function cardRich(card) {
    let rich = new MessageEmbed()
        .setTitle(escapeMarkdownText(card.name))
        .setURL(`http://yugioh.wikia.com/wiki/${encodeURIComponent(card.name)}`);
    if (card.card_images.length > 0) {
        rich.setImage(card.card_images[0].image_url)
    }
    let desc_lines = []
    if (card.attribute != null) desc_lines.push(`${card.attribute}`);
    if (card.level != null) desc_lines.push(`Level: ${card.level}:star:`);
    if (card.scale != null) desc_lines.push(`Scale: ${card.scale}`);
    if (card.linkmarkers != null) {
        const ascii_arrows = {
            "Top": ":arrow_up:",
            "Bottom": ":arrow_down:",
            "Left": ":arrow_left:",
            "Right": ":arrow_right:",
            "Top-Left": ":arrow_upper_left:",
            "Top-Right": ":arrow_upper_right:",
            "Bottom-Left": ":arrow_lower_left:",
            "Bottom-Right": ":arrow_lower_right:"
        };
        let links = card.linkmarkers.map(dir => {
            return ascii_arrows[dir];
        }).join(" ")

        desc_lines.push(`LINK: ${links}`);
    }
    let race_type = []
    if (card.race != null) race_type.push(card.race)
    if (card.type != null) race_type.push(card.type)
    if (race_type.length > 0) desc_lines.push(`**[${escapeMarkdownText(race_type.join(" / "))}]**`)
    if (card.desc != null) desc_lines.push(escapeMarkdownText(card.desc).replace("----------------------------------------\r\n",""));
    let atk_def = []
    if (card.atk != null) atk_def.push(`ATK/${card.atk}`);
    if (card.def != null) atk_def.push(`DEF/${card.def}`);
    if (card.linkval && card.linkval > 0) atk_def.push(`LINK–${card.linkval}`);
    if (atk_def.length > 0) desc_lines.push(`**${atk_def.join("  ")}**`)
    desc_lines.push(``);
    if (card.banlist_info) {
        const format = {
            "ban_tcg": "TCG",
            "ban_ocg": "OCG",
            "ban_goat": "GOAT"
        };
        Object.keys(card.banlist_info).forEach(key=>{
            desc_lines.push(`**${format[key]}**: ${card.banlist_info[key]}`);                    
        })
    }
    if (card.card_prices != null) {
        const shops = Object.keys(card.card_prices[0])
        let sum = shops.map(shop=>{
            return parseFloat(card.card_prices[0][shop])
        }).reduce((a,b)=>{
            return a+b;
        },0)
        let avg = sum/shops.length
        desc_lines.push(`Price: $${avg.toFixed(2)}`);
    }
    rich.setDescription(desc_lines.join("\n"));
    return rich;
}

export default new Command({
	name: 'ygo',
    description: 'returns Yu-Gi-Oh card info',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search',
        required: true,
    }],
	async execute(interaction) {
        let data;
        if (interaction.options.data[0].value.toLowerCase() === "random") {
            data = await fetch(`https://db.ygoprodeck.com/api/v7/randomcard.php`).then(res => res.json());
        } else {
            data = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${interaction.options.data[0].value}`).then(res => res.json());
        }
        if (data.error) return data.error;
        let card_list = data.data.map(card => {
            return {title: card.name, response: cardRich(card)}
        })

        if (card_list.length == 1) {
            return card_list[0].response;
        } else if (card_list.length > 1) {
            return MessageResponse.addList(interaction.channelId, card_list);
        } else {
            return "`No cards found`";
        }
    }
})