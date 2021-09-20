"use strict";
const moment = require('moment-timezone');
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
                let audioPlayer = voice.createAudioPlayer();
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
                if (!connection) {
                    interaction.deferUpdate();
                    return;
                }
                connection.subscribe(audioPlayer);
                interaction.message.components[1].components[0].setPlaceholder(`Volume: 100%`)
                interaction.update({content: interaction.message.content, components: interaction.message.components})
                break;
            case "stop":
                interaction.deferUpdate();
                let connection2 = voice.getVoiceConnection(interaction.guildId);
                connection2.destroy();
                //audioPlayer.stop();
                //leave
                break;
            case "volume":
                let connection3 = voice.getVoiceConnection(interaction.guildId);
                //console.log(connection2._state.subscription.player._state.resource)
                let audioResource3 = connection3?._state?.subscription?.player?._state?.resource;
                if (audioResource3) {
                    audioResource3.volume.setVolume(.3*parseInt(interaction.values[0])/100);
                    interaction.message.components[1].components[0].setPlaceholder(`Volume: ${interaction.values[0]}%`)
                    interaction.update({content: interaction.message.content, components: interaction.message.components})
                }
                break;
        }
    }
}