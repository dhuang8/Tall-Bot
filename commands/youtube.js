"use strict";
const Command = require('../util/Command');
const { MessageActionRow, MessageButton, MessageSelectMenu } = require('discord.js');
const yt = require('play-dl');

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

module.exports = new Command({
	name: 'youtube',
    description: 'play youtube video',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-or-url',
        type: 'STRING',
        description: 'url to youtube video or search',
        required: true,
    }],
	async execute(interaction) {
        let video;
        let check = yt.yt_validate(interaction.options.data[0].value);
        if (!check) {
            let results = await yt.search(interaction.options.data[0].value, {limit: 1, type: "video"})
            if (results.length < 1) return "`Video not found`"
            video = results[0];
        } else {
            try {
                video = (await yt.video_basic_info(interaction.options.data[0].value))?.video_details;
            } catch (e) {
                return "`Video not found`"
            }
        }
        if (!video) return "`Video not found`"
        /*
        await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
        const subscription = connection.subscribe(audioPlayer);
        entersState(audioPlayer, AudioPlayerStatus.Playing, 5e3);*/

        let volumemenu = [25,50,75,100,125,150,175,200].map(val=>{
            return {
                label: `${val}%`,
                value: `${val}`
            }
        })
        const row = new MessageActionRow().addComponents([
            new MessageButton()
                .setCustomId(`play|${video.id}`)
                .setLabel('Play')
                .setStyle('PRIMARY'),
            new MessageButton()
                .setCustomId('stop')
                .setLabel('Stop')
                .setStyle('SECONDARY'),
            ]
        );
        const row2 = new MessageActionRow().addComponents([
            new MessageSelectMenu()
                .setCustomId('volume')
                .setPlaceholder("Volume")
                .addOptions(volumemenu),
        ])

        return {content: `${video.title} ${video.url}`, components: [row, row2]};
    }
})