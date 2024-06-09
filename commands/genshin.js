import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import sql from '../util/SQLite.js';
import AlarmManager from '../util/alarm-manager.js';
import { GenshinImpact, LanguageEnum, GenshinRegion } from 'hoyoapi'
import { GenshinClient} from '../util/hoyo';
import { request} from '../util/functions.js';

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
            .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('cookie')
            .setDescription('cookie from website')
            .setRequired(false)
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
    .addSubcommand(subcommand => 
        subcommand.setName("set-alert")
        .setDescription("set alerts for various things")
        .addStringOption(option =>
            option.setName('alert')
            .setDescription('toggle alert')
            .setRequired(true)
            .addChoices(
                {name: 'Daily Commissions', value: 'Genshin Daily Commissions'},
                {name: 'Weekly Trounce', value: 'Genshin Weekly Trounce'},
                {name: 'Transformer', value: 'Genshin Transformer'},
                {name: 'Realm Currency', value: 'Genshin Realm Currency'},
                {name: 'Spiral Abyss', value: 'Genshin Spiral Abyss'},
                {name: 'Resin', value: 'Genshin Resin'},
                {name: 'Expeditions', value: 'Genshin Expeditions'}
            )
        )
        .addIntegerOption(option =>
            option.setName('minutes-before')
            .setDescription('minutes before it happens')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(7*24*60)
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("delete-alert")
        .setDescription("delete alert")
        .addStringOption(option =>
            option.setName('alert')
            .setDescription('alert')
            .setRequired(true)
            .addChoices(
                {name: 'Daily Commissions', value: 'Genshin Daily Commissions'},
                {name: 'Weekly Trounce', value: 'Genshin Weekly Trounce'},
                {name: 'Transformer', value: 'Genshin Transformer'},
                {name: 'Realm Currency', value: 'Genshin Realm Currency'},
                {name: 'Spiral Abyss', value: 'Genshin Spiral Abyss'},
                {name: 'Resin', value: 'Genshin Resin'},
                {name: 'Expeditions', value: 'Genshin Expeditions'}
            )
        )
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

let charMap;
let charRequest = request("https://api.uigf.org/dict/genshin/en.json").then(res => charMap = res);

function getNameFromId(id) {
    return Object.keys(charMap).find(key => charMap[key] === id);
}
function createListFromAvatarList(avatars) {
    return avatars.map(ava => `Lv.${ava.level} ${getNameFromId(ava.id)}`).join("\n")
}

const execute = async (interaction, discord_client) => {
    switch (interaction.options.getSubcommand()) {
        case 'set': {
            const uid = interaction.options.getInteger("uid");
            const cookie = interaction.options.getString("cookie");
            const user = sql.prepare("INSERT INTO users(user_id, hsr_cookie, genshin_uid) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET hsr_cookie=COALESCE(excluded.hsr_cookie, hsr_cookie), genshin_uid=COALESCE(excluded.genshin_uid, genshin_uid) RETURNING hsr_cookie, genshin_uid;")
                .get(interaction.user.id, cookie, uid);
            const embed = new EmbedBuilder()
                .setTitle('Genshin Impact info')
                .addFields(
                    { name: 'uid', value: user.genshin_uid.toString() },
                    { name: 'cookie', value: user.hsr_cookie }
                );
            return {embeds: [embed], ephemeral: true};
        } case 'info': {
            const defer = interaction.deferReply();
            const genshin = new GenshinClient(interaction.user.id);
            const info = await genshin.buildUserEmbed();
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
        } case 'set-alert': {
            const user_id = interaction.user.id;
            const alarm = AlarmManager.getAlarmFromName(interaction.options.getString("alert"));
            const minutes_before = interaction.options.getInteger('minutes-before')
            alarm.addUserAlarm(user_id, minutes_before*60, null, 0, 1);
            const embed = AlarmManager.createUserAlarmEmbed(user_id);
            return {embeds: [embed], ephemeral: true};
        } case 'delete-alert': {
            const user_id = interaction.user.id;
            const alarm = AlarmManager.getAlarmFromName(interaction.options.getString("alert"));
            sql.prepare("DELETE FROM user_alarms WHERE user_id = ? AND alarm_id = ?;").run(user_id, alarm.id);

            const embed = AlarmManager.createUserAlarmEmbed(user_id);
            return {embeds: [embed], ephemeral: true};
        } case 'help' : {
            return `Log into <https://www.hoyolab.com/home>, type java into the address bar and paste the rest \`\`\`script: (function(){if(document.cookie.includes('ltoken')&&document.cookie.includes('ltuid')){const e=document.createElement('input');e.value=document.cookie,document.body.appendChild(e),e.focus(),e.select();var t=document.execCommand('copy');document.body.removeChild(e),t?alert('HoYoLAB cookie copied to clipboard'):prompt('Failed to copy cookie. Manually copy the cookie below:\n\n',e.value)}else alert('Please logout and log back in. Cookie is expired/invalid!')})();\`\`\``;
        }
    }
}

const buttonClick = async (interaction) => {
    let args = interaction.customId.split("|");
    if (interaction.user.id != args[1]) return interaction.reply({content: "`only the user can refresh`", ephemeral: true});
    const defer = interaction.deferUpdate();
    try {
        const genshin = new GenshinClient(interaction.user.id);
        const info = await genshin.buildUserEmbed();
        await defer;
        interaction.editReply(info);
    } catch(e) {
        await defer;
        return interaction.followUp({content: "`Error`", ephemeral: true});
    }
}
export {
    slash, execute, buttonClick
};