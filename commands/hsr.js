import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import sql from '../util/SQLite.js';
import {request} from '../util/functions.js';
import { HonkaiStarRail, LanguageEnum, HsrRegion } from 'hoyoapi'

const slash = new SlashCommandBuilder()
    .setName('hsr')
    .setDescription('honkai star rail')
    .addSubcommand(subcommand => 
        subcommand.setName("set")
        .setDescription("set cookie and uid")
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('hsr uid')
            .setMinValue(600000000)
        ).addStringOption(option =>
            option.setName('cookie')
            .setDescription('cookie from website')
        )
    ).addSubcommand(subcommand => 
        subcommand.setName("info")
        .setDescription("battle records")
    ).addSubcommand(subcommand => 
        subcommand.setName("redeem")
        .setDescription("redeem codes")
        .addStringOption(option =>
            option.setName('code')
            .setDescription('code')
            .setRequired(true)
        )
    ).addSubcommand(subcommand => 
        subcommand.setName("help")
        .setDescription("how to set cookie")
    )

function calcTimestampAfter(time) {
    return parseInt(new Date(new Date().getTime()+time*1000).getTime()/1000)
}

const execute = async (interaction) => {
    switch (interaction.options.getSubcommand()) {
        case 'set': {
            const uid = interaction.options.getInteger("uid");
            const cookie = interaction.options.getString("cookie");
            const user = sql.prepare("INSERT INTO users(user_id, hsr_cookie, hsr_uid) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET hsr_cookie=excluded.hsr_cookie, hsr_uid=excluded.hsr_uid RETURNING hsr_cookie, hsr_uid;")
                .get(interaction.user.id, cookie, uid);
            const embed = new EmbedBuilder()
                .setTitle('Honkai Star Rail info')
                .addFields(
                    { name: 'uid', value: user.hsr_uid.toString() },
                    { name: 'cookie', value: user.hsr_cookie }
                );
            return {embeds: [embed], ephemeral: true};
        } case 'info': {
            const user = sql.prepare("SELECT hsr_cookie, hsr_uid from users WHERE user_id = ?").get(interaction.user.id);
            const uid = user.hsr_uid;
            const cookie = user.hsr_cookie;
            const client = new HonkaiStarRail({
                lang: LanguageEnum.ENGLISH,
                region: 'prod_official_usa',
                cookie,
                uid
            })
            client.record.region = 'prod_official_usa'

            let dailyResponse = await client.daily.info()
            let staminaResponse = client.record.note();
            let mocResponse = client.record.forgottenHall();
            const {response} = await client.record.request.setQueryParams({
                server: client.record.region,
                role_id: client.record.uid,
                schedule_type: '3',
                lang: client.record.lang,
                need_all: 'false',
            }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/rogue')
            let suResponse = response.data;
            let descLines = [];

            dailyResponse = await dailyResponse;
            if (dailyResponse?.is_sign)
                descLines.push(`Daily check-in done`)
            else
                descLines.push(`Daily check-in incomplete`)

            staminaResponse = await staminaResponse;
            descLines.push(`TP: ${staminaResponse.current_stamina}, capped <t:${parseInt(new Date(new Date().getTime()+staminaResponse.stamina_recover_time*1000).getTime()/1000)}:R>`)
            staminaResponse.expeditions.forEach((expedition, i) => {
                if (expedition.status === "Finished")
                    descLines.push(`Expedition ${i+1} finished`)
                else 
                    descLines.push(`Expedition ${i+1} <t:${calcTimestampAfter(expedition.remaining_time)}:R>`)
            })

            mocResponse = await mocResponse;
            descLines.push(`MoC max floor: ${mocResponse.max_floor}`);
            descLines.push(`MoC stars: ${mocResponse.star_num}/30`);

            suResponse = await suResponse;
            descLines.push(`SU runs completed: ${suResponse.current_record.basic.finish_cnt}`);
            const embed = new EmbedBuilder()
                .setTitle('Honkai Star Rail info')
                .setDescription(descLines.join("\n"));
            return {embeds: [embed]};
        } case 'daily': {
            const user = sql.prepare("SELECT hsr_cookie, hsr_uid from users WHERE user_id = ?").get(interaction.user.id);
            const uid = user.hsr_uid;
            const cookie = user.hsr_cookie;
            const client = new HonkaiStarRail({
                lang: LanguageEnum.ENGLISH,
                region: 'prod_official_usa',
                cookie,
                uid
            })
            const claim = await client.daily.claim()
            console.log(claim);
            if (claim?.status) return claim.status;
            throw new Error(JSON.stringify(claim));
        } case 'help' : {
            return new EmbedBuilder()
                .setTitle("How to get cookie")
                .setDescription("Log into [hoyolab](https://www.hoyolab.com/home)")
                .addFields({name: 'paste this in the url address', value:"javascript: (function(){if(document.cookie.includes('ltoken')&&document.cookie.includes('ltuid')){const e=document.createElement('input');e.value=document.cookie,document.body.appendChild(e),e.focus(),e.select();var t=document.execCommand('copy');document.body.removeChild(e),t?alert('HoYoLAB cookie copied to clipboard'):prompt('Failed to copy cookie. Manually copy the cookie below:\n\n',e.value)}else alert('Please logout and log back in. Cookie is expired/invalid!')})();"})
        } case 'test': {
            const users = sql.prepare("SELECT user_id, hsr_cookie, hsr_uid from users WHERE hsr_cookie IS NOT NULL AND hsr_uid IS NOT NULL").all();            
            users.forEach(async user=>{
                try {
                    const user_id = user.user_id;
                    const cookie = user.hsr_cookie;
                    const hsr_uid = user.hsr_uid;
                    const hsrClient = new HonkaiStarRail({
                        lang: LanguageEnum.ENGLISH,
                        region: 'prod_official_usa',
                        cookie,
                        uid: hsr_uid
                    })
                    const claim = await hsrClient.daily.claim()
                    let discordUser = await interaction.client.users.fetch("113060802252054528");
                    if (claim?.status === "OK") {
                        discordUser.send(`good\n${claim}`);
                    } else {
                        discordUser.send(`bad\n${claim}`);
                    }
                } catch (e) {
                    let discordUser = await interaction.client.users.fetch("113060802252054528");
                    discordUser.send(`error\n${e}`);
                }
            })
        }
    }
}
export {
    slash, execute
};