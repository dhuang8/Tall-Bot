import {getVoiceConnection , joinVoiceChannel, createAudioPlayer, createAudioResource, StreamType, demuxProbe } from '@discordjs/voice';
import yt from 'play-dl';

function calcVolume(value) {
    return .3*parseInt(value)/100;
}

const execute = async function(interaction) {
    //interaction.deferUpdate();
    let args = interaction.customId.split("|");
    switch (args[0]){
        case "play":
            interaction.deferUpdate();
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
            let source = await yt.stream(args[1]);
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
        case "stop":
            interaction.deferUpdate();
            let connection2 = getVoiceConnection(interaction.guildId);
            if (connection2) connection2.destroy();
            //audioPlayer.stop();
            //leave
            break;
        case "volume":
            interaction.deferUpdate()
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

export {execute};

/*
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
                } else *//*
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
*/