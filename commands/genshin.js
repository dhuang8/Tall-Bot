import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import sql from '../util/SQLite.js';
import { GenshinImpact, LanguageEnum, GenshinRegion } from 'hoyoapi'
import {crossIfTrue, calcTimestampAfter} from '../util/hoyo.js';
import {timeOnNext, request} from '../util/functions.js';

const slash = new SlashCommandBuilder()
    .setName('genshin')
    .setDescription('genshin impact')
    .addSubcommand(subcommand => 
        subcommand.setName("set")
        .setDescription("set cookie and uid")
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('genshin uid')
            .setMinValue(600000000)
        )
        .addStringOption(option =>
            option.setName('cookie')
            .setDescription('cookie from website')
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("info")
        .setDescription("battle records")
    )
    /*
    .addSubcommand(subcommand => 
        subcommand.setName("char")
        .setDescription("characters")
    )*/
    .addSubcommand(subcommand => 
        subcommand.setName("spiral-abyss")
        .setDescription("Spiral Abyss")
    )
    /*
    .addSubcommand(subcommand => 
        subcommand.setName("redeem")
        .setDescription("redeem codes")
        .addStringOption(option =>
            option.setName('code')
            .setDescription('code')
            .setRequired(true)
        )
    )
    */
    .addSubcommand(subcommand => 
        subcommand.setName("help")
        .setDescription("how to get cookie")
    )

function getUidAndCookie(userId) {
    const user = sql.prepare("SELECT hsr_cookie, genshin_uid from users WHERE user_id = ?").get(userId);
    if (user == null) return {error: "`Missing uid and cookie`"};
    const uid = user.genshin_uid;
    const cookie = user.hsr_cookie;
    if (uid == null || cookie == null) return {error: "`Missing uid and cookie`"};
    return {uid, cookie};
}

async function generateInfo(genshin, userId){
    const client = new GenshinImpact({
        lang: LanguageEnum.ENGLISH,
        region: GenshinRegion.USA,
        cookie: genshin.cookie,
        uid: genshin.uid
    })

    let dailyResponse = client.daily.info()
    let staminaResponse = client.record.dailyNote();
    let spiralResponse = client.record.spiralAbyss();
    dailyResponse = await dailyResponse;
    staminaResponse = await staminaResponse;
    spiralResponse = await spiralResponse;

    let descLines = [];
    descLines.push(`**Resin**: ${staminaResponse.current_resin}/${staminaResponse.max_resin}, capped <t:${calcTimestampAfter(staminaResponse.resin_recovery_time)}:R>`)
    descLines.push(`**Realm Currency**: ${staminaResponse.current_home_coin}/${staminaResponse.max_home_coin}, capped <t:${calcTimestampAfter(staminaResponse.home_coin_recovery_time)}:R>`)
    
    let tTime = staminaResponse.transformer.recovery_time;
    let milliAfter = tTime.Day*24*60*60 + tTime.Hour*60*60 + tTime.Minute*60 + tTime.Second;
    milliAfter = parseInt(new Date().getTime()/1000 + milliAfter);
    descLines.push(`**Transformer** ready <t:${milliAfter}:R>`);

    const embed = new EmbedBuilder()
        .setTitle('Genshin Impact — Battle Chronicle')
        .setDescription(descLines.join("\n"))
        .setTimestamp();
    
    let expeditionLines = [];
    staminaResponse.expeditions.forEach((expedition, i) => {
        if (expedition.status === "Finished") {
            expeditionLines.push(`**Expedition ${i+1}** finished`)
        } else {
            expeditionLines.push(`**Expedition ${i+1}** <t:${calcTimestampAfter(expedition.remained_time)}:R>`)
        }
    })
    embed.addFields({name: "Expeditions", value: expeditionLines.join("\n")});
    
    embed.addFields({name: `Check-in reset <t:${timeOnNext(24*60*60, 16*60*60)}:R>`, value: crossIfTrue(dailyResponse?.is_sign, `Daily check-in`)});

    let dailyLines = [];
    dailyLines.push(crossIfTrue(
        staminaResponse.finished_task_num == staminaResponse.total_task_num,
        `**Daily Commissions**: ${staminaResponse.finished_task_num}/${staminaResponse.total_task_num}`
    ))
    dailyLines.push(crossIfTrue(
        staminaResponse.is_extra_task_reward_received,
        `Daily Commission Reward`
    ))
    embed.addFields({name: `Daily reset <t:${timeOnNext(24*60*60, 9*60*60)}:R>`, value: dailyLines.join("\n")});

    let weeklyLines = [];
    weeklyLines.push(crossIfTrue(
        staminaResponse.remain_resin_discount_num == 0,
        `**Trounce**: ${staminaResponse.resin_discount_num_limit-staminaResponse.remain_resin_discount_num}/${staminaResponse.resin_discount_num_limit}`
    ));
    embed.addFields({name: `Weekly reset <t:${timeOnNext(7*24*60*60, 9*60*60+4*24*60*60)}:R>`, value: weeklyLines.join("\n")});

    let spiralLines = [];
    spiralLines.push(crossIfTrue(
        spiralResponse.max_floor == "12-3",
        `**Max floor**: ${spiralResponse.max_floor}`
    ));
    spiralLines.push(crossIfTrue(
        spiralResponse.total_star == 36,
        `**Stars**: ${spiralResponse.total_star}/36`
    ));
    embed.addFields({name: `Spiral Abyss reset <t:${new Date(parseInt(spiralResponse.end_time)).getTime()}:R>`, value: spiralLines.join("\n")});

    const refreshButton = new ButtonBuilder()
        .setCustomId(`genshin|${userId}`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder()
        .addComponents(refreshButton);
    return {embeds: [embed], components: [row]};
}

let charMap;
let charRequest = request("https://api.uigf.org/dict/genshin/en.json").then(res => charMap = res);

function getNameFromId(id) {
    return Object.keys(charMap).find(key => charMap[key] === id);
}
function createListFromAvatarList(avatars) {
    return avatars.map(ava => `Lv.${ava.level} ${getNameFromId(ava.id)}`).join("\n")
}

const execute = async (interaction) => {
    switch (interaction.options.getSubcommand()) {
        case 'set': {
            const uid = interaction.options.getInteger("uid");
            const cookie = interaction.options.getString("cookie");
            const user = sql.prepare("INSERT INTO users(user_id, hsr_cookie, genshin_uid) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET hsr_cookie=excluded.hsr_cookie, genshin_uid=excluded.genshin_uid RETURNING hsr_cookie, genshin_uid;")
                .get(interaction.user.id, cookie, uid);
            const embed = new EmbedBuilder()
                .setTitle('Genshin Impact info')
                .addFields(
                    { name: 'uid', value: user.genshin_uid.toString() },
                    { name: 'cookie', value: user.hsr_cookie }
                );
            return {embeds: [embed], ephemeral: true};
        } case 'info': {
            const genshin = getUidAndCookie(interaction.user.id);
            if (genshin.error) return genshin.error;
            const defer = interaction.deferReply();
            const info = await generateInfo(genshin, interaction.user.id);
            await defer;
            return info;
        } case 'char' : {
            const genshin = getUidAndCookie(interaction.user.id);
            if (genshin.error) return genshin.error;
            const defer = interaction.deferReply();
            const client = new GenshinImpact({
                lang: LanguageEnum.ENGLISH,
                region: GenshinRegion.USA,
                cookie: genshin.cookie,
                uid: genshin.uid
            })
            let charResponse = await client.record.characters();
            await defer;
            console.log(JSON.stringify(charResponse.avatars[0]))
            return JSON.stringify(charResponse.avatars[0]);
        } case 'spiral-abyss': {
            await charRequest;
            const genshin = getUidAndCookie(interaction.user.id);
            if (genshin.error) return genshin.error;
            const defer = interaction.deferReply();
            const client = new GenshinImpact({
                lang: LanguageEnum.ENGLISH,
                region: GenshinRegion.USA,
                cookie: genshin.cookie,
                uid: genshin.uid
            })
            let spiralResponse = await client.record.spiralAbyss();
            
            let descLines = [];
            descLines.push(`Spiral Abyss reset <t:${new Date(parseInt(spiralResponse.end_time)).getTime()}:R>`);
            descLines.push(`**Stars**: ${spiralResponse.total_star}/36`);
            let embeds = [];
            let embed = new EmbedBuilder()
            .setTitle('Genshin Impact — Spiral Abyss')
            .setDescription(descLines.join("\n"))
            .setFooter({text: "Only the last 8 are shown"});
            spiralResponse.floors.reverse().forEach((floor, i) => {
                if (i > 0 && i % 2 == 0) {
                    embeds.push(embed);
                    embed = new EmbedBuilder();
                }
                embed.addFields({name: `Floor ${floor.index}`, value: `**Stars**: ${floor.star}/${floor.max_star}`});
                floor.levels.forEach(level => {
                    embed.addFields({name: `Floor ${floor.index} Chamber ${level.index}`, value: `${":star:".repeat(level.star)}/${level.max_star}`});
                    level.battles.forEach(battle => {
                        embed.addFields({name: `${floor.index}-${level.index}-${battle.index}`, value: createListFromAvatarList(battle.avatars), inline: true});
                    })
                })
            })
            embed.setTimestamp();
            embeds.push(embed);
            await defer;
            return {embeds};
        } case 'redeem' : {
            const user = sql.prepare("SELECT hsr_cookie2, genshin_uid from users WHERE user_id = ?").get(interaction.user.id);
            if (user == null) return {error: "`Missing uid and cookie`"};
            const uid = user.genshin_uid;
            const cookie = user.hsr_cookie2;
            if (uid == null || cookie == null) return {error: "`Missing uid and cookie`"};
            const genshin = {uid, cookie};
            if (genshin.error) return genshin.error;
            const defer = interaction.deferReply();
            const client = new GenshinImpact({
                lang: LanguageEnum.ENGLISH,
                region: GenshinRegion.USA,
                cookie: genshin.cookie,
                uid: genshin.uid
            })
            const code = interaction.options.getString("code");
            const redeem = await client.redeem.claim(code);
            await defer;
            console.log(redeem);
            return JSON.stringify(redeem);
        } case 'help' : {
            return `Log into <https://www.hoyolab.com/home>, type java into the address bar and paste the rest \`\`\`script: (function(){if(document.cookie.includes('ltoken')&&document.cookie.includes('ltuid')){const e=document.createElement('input');e.value=document.cookie,document.body.appendChild(e),e.focus(),e.select();var t=document.execCommand('copy');document.body.removeChild(e),t?alert('HoYoLAB cookie copied to clipboard'):prompt('Failed to copy cookie. Manually copy the cookie below:\n\n',e.value)}else alert('Please logout and log back in. Cookie is expired/invalid!')})();\`\`\``;
        }
    }
}

const buttonClick = async (interaction) => {
    let args = interaction.customId.split("|");
    if (interaction.user.id != args[1]) return interaction.reply({content: "`only the user can refresh`", ephemeral: true});
    const genshin = getUidAndCookie(args[1]);
    if (genshin.error) return interaction.reply({content: genshin.error, ephemeral: true});
    const defer = interaction.deferUpdate();
    let info = await generateInfo(genshin, args[1]);
    await defer;
    interaction.editReply(info);
}
export {
    slash, execute, buttonClick
};