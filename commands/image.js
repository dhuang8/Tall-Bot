"use strict";
import {AttachmentBuilder, SlashCommandBuilder} from 'discord.js';
import fetch from 'node-fetch';
import config from '../config.json' with { type: "json" };
import AbortController from "abort-controller";

const slash = new SlashCommandBuilder()
    .setName('image')
    .setDescription('returns first image from google search')
    .addStringOption(option =>
        option.setName('search-term')
        .setDescription('search')
        .setRequired(true)
    )

const execute = async (interaction) => {
    let safe = interaction.channel.nsfw ? "" : "&safe=active"
    //https://developers.google.com/custom-search/v1/cse/list
    let data;
    try {
        data = await fetch(`https://www.googleapis.com/customsearch/v1?key=${config.api.image}&q=${encodeURIComponent(interaction.options.data[0].value)}&searchType=image&num=10${safe}`).then(res => res.json());
    } catch (e) {
        if (e.response && e.response.body && e.response.body.error && e.response.body.error.errors[0] && e.response.body.error.errors[0].reason && e.response.body.error.errors[0].reason === "dailyLimitExceeded") {
            return "`Try again tomorrow`";
        }
        throw e;
    }
    let validmime = ["image/png", "image/jpeg", "image/bmp", "image/gif"]
    let extension = [".png", ".jpg", ".bmp", ".gif"]
    if (data.items && data.items.length > 0) {
        /*
        let imageitems = data.items.filter(element => {
            return validmime.indexOf(element.mime) > -1;
        })*/
        for (let i = 0; i < data.items.length; i++) {
            let imagedata = data.items[i];
            if (imagedata.image.byteSize < 8388608) {
                try {
                    const controller = new AbortController();
                    setTimeout(
                        () => { controller.abort(); },
                        1000,
                    );
                    let head = await fetch(imagedata.link, {
                        method: "HEAD",
                        signal: controller.signal
                    })
                    let mimeindex = validmime.indexOf(head.headers.get("content-type"));
                    if (mimeindex < 0 || parseInt(head.headers.get("content-length")) >= 8388608) continue;
                    let attach = new AttachmentBuilder(imagedata.link, `${encodeURIComponent(interaction.options.data[0].value)}${extension[mimeindex]}`);
                    return {content: interaction.options.data[0].value, files: [attach]};
                } catch (e) {
                    //let attach = new Discord.MessageAttachment(imagedata.image.thumbnailLink,`${encodeURIComponent(args[1])}${extension[validmime.indexOf(imagedata.mime)]}`);
                    //return attach;
                }
            } else {
                //let attach = new Discord.MessageAttachment(imagedata.image.thumbnailLink,`${encodeURIComponent(args[1])}${extension[validmime.indexOf(imagedata.mime)]}`);
                //return attach;
            }
        }
    }
    return "`No results found`"
}

export {
    slash, execute
};
