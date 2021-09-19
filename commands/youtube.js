"use strict";
const Command = require('../util/Command');
const fetch = require('node-fetch');
const moment = require('moment-timezone');
const config = require('../util/config');
const ytdl = require('ytdl-core');
const unescape = require('unescape');
const { MessageActionRow, MessageButton, MessageSelectMenu } = require('discord.js');
const {
	AudioPlayerStatus,
	AudioResource,
    StreamType,
    createAudioPlayer,
    createAudioResource,
	entersState,
	joinVoiceChannel,
	VoiceConnectionStatus,
} = require('@discordjs/voice');
const yt = require('play-dl');

moment.tz.setDefault("America/New_York");

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

async function playSound(channel, URL, options = {}) {
    const audioPlayer = createAudioPlayer();
    const audioResource = createAudioResource(`https://r1---sn-ab5l6n67.googlevideo.com/videoplayback?expire=1632020045&ei=7VFGYYvyIpKahgbq5ILYCA&ip=104.162.89.209&id=o-AC5fzBMzXUaxrSnNO4MRj48BnB_y-N-7LiMvOg7N8Y9B&itag=249&source=youtube&requiressl=yes&mh=AM&mm=31%2C29&mn=sn-ab5l6n67%2Csn-ab5szn76&ms=au%2Crdu&mv=m&mvi=1&pl=16&initcwndbps=1985000&vprv=1&mime=audio%2Fwebm&ns=0oDrh5wNH8Nm5yPsj_z5l2cG&gir=yes&clen=1532616&dur=240.281&lmt=1540173287678528&mt=1631998143&fvip=1&keepalive=yes&fexp=24001373%2C24007246&c=WEB&txp=5411222&n=kMdO_B2l99mkVa&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cvprv%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&sig=AOq0QJ8wRAIgXKcZoQpBnzQmQSwQBsNJM1cGPMyw0rj9YF88ERh_VB4CIClsfXKx9GFMVthqCYTnVdbTlAThXmY79KAnwE1DZeSC&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AG3C_xAwRQIgBWom78WP6R77IY-5F6CVbNfhBkUtoXiYFntTLqQpqikCIQCnBkAtGEkbKuIn_oLXqRcsJDAqgAuQ0OUsdEUWh5Ps9A%3D%3D&ratebypass=yes`, {
		inputType: StreamType.Arbitrary,
		//inputType: StreamType.Opus,
	});
    audioPlayer.play(audioResource)
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
    })
    await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
    const subscription = connection.subscribe(audioPlayer);
    entersState(audioPlayer, AudioPlayerStatus.Playing, 5e3);
}

async function playYoutube(url, channel) {
    //source from ytdl-core-discord
    try {
        let info = await ytdl.getInfo(url);
        let options = {
            highWaterMark: 1<<25
        }
        let format_list = info.formats.filter(f=>{
            return f.audioBitrate;
        }).sort((a,b)=>{
            function score(f) {
                let score = 0;
                if (f.codecs === "opus" && f.container === "webm") score +=1
                return score;
            }
            let score_a = score(a);
            let score_b = score(b);
            if (score_a != score_b) return score_b-score_a;
            else return b.audioBitrate - a.audioBitrate;
        })
        if (format_list.length > 0) {
            const itag = format_list[0].itag;
            if (!format_list[0].url) {
                throw new Error("Missing URL field");
            }
            options = {...options, filter: (f)=>{
                return f.itag == itag;
            }}
            let type;
            if (format_list[0].codecs === "opus" && format_list[0].container === "webm") type = "webm/opus"
            else type = "unknown";
            //console.log(info)
            let stream = ytdl.downloadFromInfo(info, options);
            return [stream,{type}];
        }
        return null;
    } catch (e) {
        throw e;
        return null;
    }
}

async function ytFunc(message,args){
    let id;
    let searched = false;
    let data;
    let ytstream;
    try {
        id = ytdl.getVideoID(args[1])
        ytstream = await playYoutube(id);
        if (ytstream == null) throw e;
    } catch (e) {
        data = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&key=${config.api.youtube}&fields=items(id/videoId,snippet/title)&type=video&maxResults=1&q=${encodeURIComponent(args[1])}`).then(res => res.json());
        if (e.response && e.response.body && e.response.body.error && e.response.body.error.errors[0] && e.response.body.error.errors[0].reason && e.response.body.error.errors[0].reason === "quotaExceeded") {
            return "`Search quota exceeded. Use a full YouTube URL or try searching again tomorrow.`";
        }
        if (data.items.length < 1) return `\`No videos found\``;
        id = data.items[0].id.videoId;
        searched = true;
        ytstream = await playYoutube(id);
    }
    if (ytstream !== null) {
        if (message.member.voice.channel) {
            playSound(message.member.voice.channel, ytstream[0], ytstream[1]);
            return `**Playing** ${escapeMarkdownText(unescape(data.items[0].snippet.title))}\nhttps://youtu.be/${data.items[0].id.videoId}`;
        } else {
            if (searched) {
                return `**${escapeMarkdownText(unescape(data.items[0].snippet.title))}**\nhttps://youtu.be/${data.items[0].id.videoId}`;
            }
            return `\`Not in a voice channel\``;
        }
    }
    return `\`No videos found\``;
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
            if (results.length < 1) return "`no videos found`"
            video = results[0];
        } else {
            video = await yt.video_basic_info(interaction.options.data[0].value)
        }
        //console.log(video)
        /*
        let source = await yt.stream(video.url);
        let audioResource = createAudioResource(source.stream, {
            inputType : source.type,
            inlineVolume: true
        });
        audioResource.volume.setVolume(.3);
        const audioPlayer = createAudioPlayer();
        audioPlayer.play(audioResource);
        
        const connection = joinVoiceChannel({
            channelId: interaction.member?.voice.channel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        })
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
                .setStyle('PRIMARY'),/*
            new MessageButton()
                .setCustomId('volumedown')
                .setLabel('Volume')
                .setStyle('SUCCESS')
                .setEmoji("⬇️"),
            new MessageButton()
                .setCustomId('volumeup')
                .setLabel('Volume')
                .setStyle('DANGER')
                .setEmoji("⬆️"),*/
            new MessageButton()
                .setCustomId('stop')
                .setLabel('Stop')
                .setStyle('SECONDARY'),
            ]
        );
        const row2 = new MessageActionRow().addComponents([
            new MessageSelectMenu()
                .setCustomId('volume')
                .setPlaceholder("Volume: 100%")
                .addOptions(volumemenu),
        ])

        return {content: `${video.title} ${video.url}`, components: [row, row2], full: true, execute: (interaction2, original) => {
            //console.log(interaction2);
            //interaction2.deferUpdate();
            switch (interaction2.customId){
                case "pause":
                    if (audioPlayer.state.status == "playing") {
                        audioPlayer.pause();
                        interaction2.message.components[0].components[0].setLabel("Play")
                    } else {
                        audioPlayer.unpause();
                        interaction2.message.components[0].components[0].setLabel("Pause")
                    }
                    break;
                case "end":
                    audioPlayer.stop();
                    break;
                case "volumedown":
                    audioResource.volume.setVolume(audioResource.volume.volume-.1);
                    console.log(audioResource.volume.volume)
                    break;
                case "volumeup":
                    audioResource.volume.setVolume(audioResource.volume.volume+.1);
                    console.log(audioResource.volume.volume)
                    break;
                case "volume":
                    audioResource.volume.setVolume(.25*parseInt(interaction2.values[0])/100);
                    interaction2.message.components[1].components[0].setPlaceholder(`Volume: ${interaction2.values[0]}%`)
                    break;
            }
            interaction2.update({content: interaction2.message.content, components: interaction2.message.components})
        }};

        /*
        let id;
        let searched = false;
        let data;
        let ytstream;
        try {

            id = ytdl.getVideoID(interaction.options.data[0].value)
            ytstream = await playYoutube(id);
            if (ytstream == null) throw e;
        } catch (e) {
            data = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&key=${config.api.youtube}&fields=items(id/videoId,snippet/title)&type=video&maxResults=1&q=${encodeURIComponent(interaction.options.data[0].value)}`).then(res => res.json());
            if (e.response && e.response.body && e.response.body.error && e.response.body.error.errors[0] && e.response.body.error.errors[0].reason && e.response.body.error.errors[0].reason === "quotaExceeded") {
                return "`Search quota exceeded. Use a full YouTube URL or try searching again tomorrow.`";
            }
            if (data.items.length < 1) return `\`No videos found\``;
            id = data.items[0].id.videoId;
            searched = true;
            ytstream = await playYoutube(id);
        }
        if (ytstream !== null) {
            if (interaction.member.voice.channel) {
                playSound(interaction.member.voice.channel, ytstream[0], ytstream[1]);
                return `Playing **${escapeMarkdownText(unescape(data.items[0].snippet.title))}**\nhttps://youtu.be/${data.items[0].id.videoId}`;
            } else {
                if (searched) {
                    return `**${escapeMarkdownText(unescape(data.items[0].snippet.title))}**\nhttps://youtu.be/${data.items[0].id.videoId}`;
                }
                return `\`Not in a voice channel\``;
            }
        }
        return `\`No videos found\``;*/
    }
})