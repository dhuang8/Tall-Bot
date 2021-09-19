"use strict";
const Command = require('../util/Command');
const fetch = require('node-fetch');
const moment = require('moment-timezone');
const config = require('../util/config');
const ytdl = require('ytdl-core');
const unescape = require('unescape');
const { MessageActionRow, MessageButton, MessageSelectMenu } = require('discord.js');
const voice = require('@discordjs/voice');
const yt = require('play-dl');

moment.tz.setDefault("America/New_York");

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

module.exports = {
	name: 'youtubebutton',
	async execute(interaction) {
        let args = interaction.customId.split("|")
        switch (args[0]){
            case "play":
                let source = await yt.stream(args[1]);
                let audioResource = voice.createAudioResource(source.stream, {
                    inputType : source.type,
                    inlineVolume: true
                });
                audioResource.volume.setVolume(.3);
                const audioPlayer = voice.createAudioPlayer();
                audioPlayer.play(audioResource);
                
                let connection = voice.getVoiceConnection(interaction.guildId);
                if (connection) {
                    if (connection.joinConfig.channelId != interaction.member?.voice.channel.id) connection = undefined;
                }
                if (!connection) {
                    connection = voice.joinVoiceChannel({
                        channelId: interaction.member?.voice.channel.id,
                        guildId: interaction.guildId,
                        adapterCreator: interaction.guild.voiceAdapterCreator,
                    })
                }
                const subscription = connection.subscribe(audioPlayer);
                interaction.message.components[1].components[0].setPlaceholder(`Volume: 100%`)
                interaction.update({content: interaction.message.content, components: interaction.message.components})
                break;
            case "stop":
                let connection2 = voice.getVoiceConnection(interaction.guildId);
                connection2.destroy();
                //audioPlayer.stop();
                interaction.deferUpdate();
                //leave
                break;
            case "volume":
                let connection3 = voice.getVoiceConnection(interaction.guildId);
                //console.log(connection2._state.subscription.player._state.resource)
                let audioResource3 = connection3._state.subscription.player._state.resource;
                audioResource3.volume.setVolume(.3*parseInt(interaction.values[0])/100);
                interaction.message.components[1].components[0].setPlaceholder(`Volume: ${interaction.values[0]}%`)
                interaction.update({content: interaction.message.content, components: interaction.message.components})
                break;
        }
    }
}