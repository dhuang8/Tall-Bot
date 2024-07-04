import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import sql from '../util/SQLite.js';
import {ZzzClient} from '../util/hoyo';
import AlarmManager from '../util/alarm-manager.js';
import fs from 'fs';

let hsr_stats;
let relic_count;
try {
    // update from char_weights.json
    hsr_stats = JSON.parse(fs.readFileSync("./data/hsr_weights.json", 'utf8'));
    // update from relic_count.json
    relic_count = JSON.parse(fs.readFileSync("./data/relic_count.json", 'utf8'));
} catch (e) {
    console.error(e);
    console.error("hsr_weights not found");
}

const slash = new SlashCommandBuilder()
    .setName('zzz')
    .setDescription('Zenless Zone Zero')
    .addSubcommand(subcommand => 
        subcommand.setName("set")
        .setDescription("set cookie and uid")
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('zzz uid')
            // .setMinValue(100_000_000)
            .setRequired(false)
        ).addStringOption(option =>
            option.setName('cookie')
            .setDescription('cookie from website')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("info")
        .setDescription("Battle Chronicle")
    )
    .addSubcommand(subcommand => 
        subcommand.setName("sign-in")
        .setDescription("Manual sign in. Not needed after the first day of inputting zzz uid and cookie")
    )
    // .addSubcommand(subcommand => 
    //     subcommand.setName("moc")
    //     .setDescription("Memory of Chaos")
    //     .addIntegerOption(option =>
    //         option.setName('phase')
    //         .setDescription('which phase')
    //         .setRequired(true)
    //         .addChoices(
    //             {name: 'recent', value: 1},
    //             {name: 'previous', value: 2}
    //         )
    //     )
    //     .addIntegerOption(option =>
    //         option.setName('uid')
    //         .setDescription('UID')
    //         .setRequired(false)
    //     )
    // )
    // .addSubcommand(subcommand => 
    //     subcommand.setName("support-char")
    //     .setDescription("support character")
    //     .addIntegerOption(option =>
    //         option.setName('uid')
    //         .setDescription('UID')
    //         .setRequired(false)
    //     )
    //     .addStringOption(option =>
    //         option.setName('char-name')
    //         .setDescription('character name')
    //         .setRequired(false)
    //     )
    // )
    .addSubcommand(subcommand => 
        subcommand.setName("set-alert")
        .setDescription("set alerts for various things")
        .addStringOption(option =>
            option.setName('alert')
            .setDescription('toggle alert')
            .setRequired(true)
            .addChoices(
                {name: 'Battery Charge', value: 'ZZZ Battery Charge'},
                {name: 'Dailies', value: 'ZZZ Dailies'}
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
                {name: 'Battery Charge', value: 'ZZZ Battery Charge'},
                {name: 'Dailies', value: 'ZZZ Dailies'}
            )
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("help")
        .setDescription("how to get cookie")
    )

const execute = async (interaction) => {
    switch (interaction.options.getSubcommand()) {
        case 'set': {
            const uid = interaction.options.getInteger("uid");
            const cookie = interaction.options.getString("cookie");
            const user = sql.prepare("INSERT INTO users(user_id, hsr_cookie, zzz_uid) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET hsr_cookie=COALESCE(excluded.hsr_cookie, hsr_cookie), zzz_uid=COALESCE(excluded.zzz_uid, zzz_uid) RETURNING hsr_cookie, zzz_uid;")
                .get(interaction.user.id, cookie, uid);
            const embed = new EmbedBuilder()
                .setTitle('Zenless Zone Zero info')
                .addFields(
                    { name: 'uid', value: user.zzz_uid?.toString() ?? `not set` },
                    { name: 'cookie', value: user.hsr_cookie ?? `not set` }
                );
            return {embeds: [embed], ephemeral: true};
        } case 'sign-in': {
            const defer = interaction.deferReply();
            const zzz = new ZzzClient(interaction.user.id);
            const info = await zzz.dailySignIn();
            await defer;
            return info;
        } case 'info': {
            const defer = interaction.deferReply();
            const zzz = new ZzzClient(interaction.user.id);
            const info = await zzz.buildUserEmbed();
            await defer;
            return info;
        // } case 'daily': {
        //     const hsr = getUidAndCookie(interaction.user.id);
        //     if (hsr.error) return hsr.error;
        //     const client = new HonkaiStarRail({
        //         lang: LanguageEnum.ENGLISH,
        //         region: 'prod_official_usa',
        //         cookie: hsr.cookie,
        //         uid: hsr.uid
        //     })
        //     const claim = await client.daily.claim()
        //     if (claim?.status) return claim.status;
        //     throw new Error(JSON.stringify(claim));
        // } case 'moc': {
        //     const uid = interaction.options.getInteger("uid");
        //     const phase = interaction.options.getInteger("phase");
        //     const defer = interaction.deferReply();
        //     let hsr;
        //     if (uid) hsr = new HsrClient({uid});
        //     else hsr = new HsrClient(interaction.user.id);
        //     const moc = await hsr.memoryOfChaos(phase, true);
        //     let descLines = [];
        //     descLines.push(`This Memory of Chaos ends <t:${moc.recovery_time}:R>`);
        //     descLines.push(`**Stars**: ${moc.current_stars}/${moc.max_stars}`);
        //     let embed = new EmbedBuilder()
        //         .setTitle('Honkai: Star Rail — Memory of Chaos')
        //         .setDescription(descLines.join("\n"))
        //     moc.floors.forEach(floor => {
        //         let lines = [];
        //         lines.push(':star:'.repeat(floor.stars));
        //         lines.push(`**Cycles**: ${floor.cycles}`)
        //         embed.addFields({name: floor.name, value: lines.join("\n")});
        //         floor.teams.forEach((team, i) => {
        //             let desc = team.chars.map(char => {
        //                 return `Lv.${char.level} E${char.eidolon} ${char.name}`;
        //             }).join("\n")
        //             embed.addFields({name: `Team ${i+1}`, value: desc, inline: true});
        //         })
        //     })
        //     await defer;
        //     return {embeds: [embed]};
        } case 'help' : {
            return `Log into <https://www.hoyolab.com/home>, type \`java\` into the address bar and paste the rest \`\`\`script: (function(){if(document.cookie.includes('ltoken')&&document.cookie.includes('ltuid')){const e=document.createElement('input');e.value=document.cookie,document.body.appendChild(e),e.focus(),e.select();var t=document.execCommand('copy');document.body.removeChild(e),t?alert('HoYoLAB cookie copied to clipboard'):prompt('Failed to copy cookie. Manually copy the cookie below:\n\n',e.value)}else alert('Please logout and log back in. Cookie is expired/invalid!')})();\`\`\``;
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
        }
    }
}

const buttonClick = async (interaction) => {
    let args = interaction.customId.split("|");
    if (interaction.user.id != args[1]) return interaction.reply({content: "`only the user can refresh`", ephemeral: true});
    const defer = interaction.deferUpdate();
    try {
        const zzz = new ZzzClient(interaction.user.id);
        const info = await zzz.buildUserEmbed();
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