import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuOptionBuilder, StringSelectMenuBuilder } from 'discord.js';
import {getVoiceConnection , joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, demuxProbe } from '@discordjs/voice';
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
        .setCustomId(`youtube|play|${video.id}`)
        .setLabel('Play')
        .setStyle(ButtonStyle.Primary);

    const stop = new ButtonBuilder()
        .setCustomId(`youtube|stop`)
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
        .setCustomId('youtube|volume')
        .setPlaceholder("Volume")
        .addOptions(volumemenu)

    const row2 = new ActionRowBuilder()
        .addComponents(volume);


    return {content: `${video.title} ${video.url}`, components: [row]};
}

function calcVolume(value) {
    return .3*parseInt(value)/100;
}

const buttonClick = async function(interaction) {
    interaction.deferUpdate();
    let args = interaction.customId.split("|");
    switch (args[1]){
        case "play": {
            let user_channel_id = interaction.member?.voice?.channel?.id
            if (!user_channel_id) return;
            let connection = getVoiceConnection(interaction.guildId);
            if (connection) {
                if (connection.joinConfig.channelId != user_channel_id) connection = undefined;
            }
            if (!connection && user_channel_id) {
                connection = joinVoiceChannel({
                    channelId: user_channel_id,
                    guildId: interaction.guildId,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                })
            }

            let audioPlayer = connection._state?.subscription?.player?.removeAllListeners();
            if (audioPlayer) audioPlayer.stop();
            else audioPlayer = createAudioPlayer();
            let source = await yt.stream(args[2]);
            let audioResource = createAudioResource(source.stream, {
                inputType : source.type,
                inlineVolume: true
            });
            audioResource.playStream.on('error', error => {
                console.error('Error:', error.message, 'with track', audioResource.metadata.title);
            });

            audioResource.volume.setVolume(.3);
            audioPlayer.on("idle",()=>connection.destroy());
            audioPlayer.on('error', error => {
                console.error('Error:', error.message, 'with track', error.resource.metadata.title);
            });
            audioPlayer.play(audioResource);

            connection.subscribe(audioPlayer);
            /*if (interaction.message.components[1].components[0].placeholder != `Volume: 100%`){
                interaction.message.components[1].components[0].setPlaceholder(`Volume: 100%`)
                interaction.update({content: interaction.message.content, components: interaction.message.components})
            } else */
            break;
        } case "stop": {
            let connection2 = getVoiceConnection(interaction.guildId);
            if (connection2) connection2.destroy();
            //audioPlayer.stop();
            //leave
            break;
        } case "volume": {
            let connection3 = getVoiceConnection(interaction.guildId);
            let audioResource3 = connection3?._state?.subscription?.player?._state?.resource;
            if (audioResource3) {
                audioResource3.volume.setVolume(calcVolume(interaction.values[0]));
                //interaction.message.components[1].components[0].setPlaceholder(`Volume: ${interaction.values[0]}%`)
                //interaction.update({content: interaction.message.content, components: interaction.message.components})
            }
            break;
        }
    }
}

export {
    slash, execute, buttonClick
};