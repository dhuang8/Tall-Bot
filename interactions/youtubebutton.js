"use strict";
import moment from 'moment-timezone';
const voice = import('@discordjs/voice');
import yt from 'play-dl';

moment.tz.setDefault("America/New_York");

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

export default {
	name: 'youtubebutton',
	async execute(interaction) {
        //interaction.deferUpdate();
        let args = interaction.customId.split("|")
        switch (args[0]){
            case "play":
                let connection = voice.getVoiceConnection(interaction.guildId);
                let user_channel_id = interaction.member?.voice?.channel?.id
                if (connection) {
                    if (connection.joinConfig.channelId != user_channel_id) connection = undefined;
                }
                if (!connection && user_channel_id) {
                    connection = voice.joinVoiceChannel({
                        channelId: user_channel_id,
                        guildId: interaction.guildId,
                        adapterCreator: interaction.guild.voiceAdapterCreator,
                    })
                }
                if (!connection) {
                    interaction.deferUpdate();
                    return;
                }

                let audioPlayer = connection._state?.subscription?.player?.removeAllListeners();
                if (audioPlayer) audioPlayer.stop();
                else audioPlayer = voice.createAudioPlayer();
                let source = await yt.stream(args[1]);
                let audioResource = voice.createAudioResource(source.stream, {
                    inputType : source.type,
                    inlineVolume: true
                });
                audioResource.volume.setVolume(.3);
                audioPlayer.play(audioResource);
                audioPlayer.on("idle",()=>connection.destroy());

                connection.subscribe(audioPlayer);
                /*if (interaction.message.components[1].components[0].placeholder != `Volume: 100%`){
                    interaction.message.components[1].components[0].setPlaceholder(`Volume: 100%`)
                    interaction.update({content: interaction.message.content, components: interaction.message.components})
                } else */
                interaction.deferUpdate();
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
                    //interaction.message.components[1].components[0].setPlaceholder(`Volume: ${interaction.values[0]}%`)
                    //interaction.update({content: interaction.message.content, components: interaction.message.components})
                    interaction.deferUpdate()
                }
                break;
        }
    }
}