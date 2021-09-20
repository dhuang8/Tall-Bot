const Command = require('../util/Command');
const {MessageEmbed} = require('discord.js');
const fetch = require('node-fetch');
const MessageResponse = require('../util/MessageResponse');
const config = require('../util/config');
const { ClientCredentials, ResourceOwnerPassword, AuthorizationCode } = require('simple-oauth2');

let token;
let meta;

function cardRich(card, mode) {
    let rich = new MessageEmbed();
    rich.setTitle(card.name);
    let desc_lines = [];
    if (!card.battlegrounds) {
        rich.setImage(card.image);
        if (card.classId) {
            let class2 = meta.classes.find(class3 => {
                return class3.id == card.classId;
            });
            desc_lines.push(`**Class:** ${class2.name}`);
        }
        if (card.cardSetId) {
            let set = meta.sets.find(set => {
                return set.name.id == set.classId;
            });
            desc_lines.push(`**Set:** ${set.name}`);
        }
        if (card.manaCost) desc_lines.push(`**Cost**: ${card.manaCost}`);
    } else {
        if (card.battlegrounds.hero) desc_lines.push(`**Hero**`);
        if (card.battlegrounds.tier) desc_lines.push(`**Tier**: ${card.battlegrounds.tier}`);
        rich.setImage(card.battlegrounds.image);
    }
    if (card.collectible != 1) desc_lines.push("**Uncollectible**");
    if (card.attack && card.health) desc_lines.push(`${card.attack}/${card.health}`);
    desc_lines.push("");
    if (card.text) {
        card.text = card.text.replace(/&nbsp;/g, " ");
        card.text = card.text.replace(/\*/g, "\\*");
        card.text = card.text.replace(/<i>/g, "*");
        card.text = card.text.replace(/<\/i>/g, "*");
        card.text = card.text.replace(/<b>/g, "**");
        card.text = card.text.replace(/<\/b>/g, "**");
        desc_lines.push(card.text);
    }
    if (card.flavorText) {
        card.flavorText = card.flavorText.replace(/<i>/g, "");
        card.flavorText = card.flavorText.replace(/<\/i>/g, "");
        card.flavorText = card.flavorText.replace(/<b>/g, "");
        card.flavorText = card.flavorText.replace(/<\/b>/g, "");
    }
    rich.setDescription(desc_lines.join("\n"));
    rich.setFooter(card.flavorText);
    return rich;
};

module.exports = new Command({
	name: 'hs',
    description: 'returns Hearthstone card data',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search',
        required: true,
    },{
        name: 'game-mode',
        type: 'STRING',
        description: 'term to search',
        required: true,
        choices: [{
            name: "constructed",
            value: "constructed"
        },{
            name: "battlegrounds",
            value: "battlegrounds"
        },{
            name: "arena",
            value: "arena"
        },{
            name: "duels",
            value: "duels"
        },{
            name: "standard",
            value: "standard"
        }],
    }],
    required: true,
	async execute(interaction) {
        const credentials = {
            client: {
                id: config.api.blizzard.id,
                secret: config.api.blizzard.secret
            },
            auth: {
                tokenHost: 'https://us.battle.net/oauth/token'
            }
        };
        if (!token) {
            const client = new ClientCredentials(credentials);
            //const thisoauth = oauth2.create(credentials);
            token = await client.getToken();
            //token = thisoauth.accessToken.create(result);
        }
        if (token.expired()){
            accessToken = await accessToken.refresh();
        }

        let data = fetch(`https://us.api.blizzard.com/hearthstone/cards?locale=en_US&textFilter=${interaction.options.data[0].value}&gameMode=${interaction.options.data[1].value}&access_token=${token.token.access_token}`).then(res => res.json());
        if (!meta) {
            meta = await fetch(`https://us.api.blizzard.com/hearthstone/metadata?locale=en_US&access_token=${token.token.access_token}`).then(res => res.json());
        }
        cards = (await data).cards;
        cards = cards.map(card => {
            let title = card.name
            if (card.battlegrounds) title += " (BG)";
            return {title, response: cardRich(card) };
        })
        if (cards.length < 1) {
            return "`No results`";
        } else if (cards.length == 1) {
            return cards[0].response;
        } else {
            return MessageResponse.addList(interaction.channelID, cards);
        }
    }
});