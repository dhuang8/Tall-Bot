"use strict";
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuOptionBuilder, StringSelectMenuBuilder } from 'discord.js';
import yt from 'play-dl';

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

const slash = new SlashCommandBuilder()
    .setName('youtube')
    .setDescription('play youtube video')
    .addStringOption(option => 
        option.setName('search-or-url')
        .setDescription('url to youtube video or search')
        .setRequired(true)
    );
const execute = async (interaction) => {
    let video;
    let query = interaction.options.getString('search-or-url');
    let check = yt.yt_validate(query);
    if (check !== "video") {
        let results = await yt.search(query, {limit: 1, type: "video"})
        if (results.length < 1) return "`Video not found`"
        video = results[0];
    } else {
        try {
            video = (await yt.video_basic_info(query))?.video_details;
        } catch (e) {
            return "`Video not found`"
        }
    }
    if (!video) return "`Video not found`"

    const play = new ButtonBuilder()
        .setCustomId(`play|${video.id}`)
        .setLabel('Play')
        .setStyle(ButtonStyle.Primary);

    const stop = new ButtonBuilder()
        .setCustomId(`stop`)
        .setLabel('Stop')
        .setStyle(ButtonStyle.Secondary);


    const row = new ActionRowBuilder()
    	.addComponents(play, stop);

    let volumemenu = [25,50,75,100,125,150,175,200].map(val=>{
        return new StringSelectMenuOptionBuilder()
            .setLabel(`${val}%`)
            .setValue(val.toString());
    })
    
    const volume = new StringSelectMenuBuilder()
        .setCustomId('volume')
        .setPlaceholder("Volume")
        .addOptions(volumemenu)

    const row2 = new ActionRowBuilder()
        .addComponents(volume);


    return {content: `${video.title} ${video.url}`, components: [row]};
}
export {
    slash, execute
};