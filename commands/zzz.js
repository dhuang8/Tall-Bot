import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import sql from '../util/SQLite.js';
import { ZzzClient } from '../util/hoyo/ZzzClient.ts';
import AlarmManager from '../util/alarm-manager.js';
import { escapeMarkdown } from '@discordjs/formatters';
import fs from 'fs';

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
    .addSubcommand(subcommand => 
        subcommand.setName("news")
        .setDescription("recent posts")
    )
    .addSubcommand(subcommand => 
        subcommand.setName("auto-news")
        .setDescription("auto post news")
        .addBooleanOption(option =>
            option.setName('toggle')
            .setDescription('on or off')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("critical-node")
        .setDescription("Shiyu Defense - Critical Node")
        .addIntegerOption(option =>
            option.setName('phase')
            .setDescription('which phase')
            .setRequired(true)
            .addChoices(
                {name: 'recent', value: 1},
                {name: 'previous', value: 2}
            )
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("set-alert")
        .setDescription("set alerts for various things")
        .addStringOption(option =>
            option.setName('alert')
            .setDescription('toggle alert')
            .setRequired(true)
            .addChoices(
                {name: 'Battery Charge', value: 'ZZZ Battery Charge'},
                {name: 'Dailies', value: 'ZZZ Dailies'},
                {name: 'Hollow Zero', value: 'ZZZ Hollow Zero'},
                {name: 'Shiyu Defense', value: 'ZZZ Shiyu Defense'}
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
                {name: 'Dailies', value: 'ZZZ Dailies'},
                {name: 'Hollow Zero', value: 'ZZZ Hollow Zero'},
                {name: 'Shiyu Defense', value: 'ZZZ Shiyu Defense'}
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
        } case 'news': {
            const defer = interaction.deferReply();
            let posts = await ZzzClient.news();
            let desc = posts.map(post => {
                return `[${escapeMarkdown(post.title)}](${post.url}) - <t:${post.created}>`
            }).join("\n");
            const embed = new EmbedBuilder()
                .setTitle(`Zenless Zone Zero — news`)
                .setDescription(desc)
                .setTimestamp();
            await defer;
            return {embeds: [embed]};
        } case 'auto-news': {
            const toggle = interaction.options.getBoolean('toggle')
            sql.prepare("UPDATE channels SET zzz_news = ? WHERE channel_id = ?;").run(+toggle, interaction.channel.id);
            return `\`ZZZ news will ${toggle ? '' : 'no longer '}be automatically posted here\``;
        } case 'critical-node': {
            // const uid = interaction.options.getInteger("uid");
            const phase = interaction.options.getInteger("phase");
            const defer = interaction.deferReply();
            // let zzz;
            // if (uid) zzz = new ZzzClient({uid});
            // else zzz = new ZzzClient(interaction.user.id);
            let zzz = new ZzzClient(interaction.user.id);
            const cn = await zzz.criticalNode(phase);
            let descLines = [];
            descLines.push(`This Critical Node ends <t:${cn.recovery_time}:R>`);
            descLines.push(`**S-Ranks**: ${cn.s_ranks.cur}/${cn.s_ranks.max}`);
            let embed = new EmbedBuilder()
                .setTitle('Zenless Zone Zero — Critical Node')
                .setDescription(descLines.join("\n"))
            cn.floors.forEach(floor => {
                let lines = [];
                lines.push(`**Rating**: ${floor.rating}`);
                embed.addFields({name: floor.name, value: lines.join("\n")});
                floor.teams.forEach((team, i) => {
                    let teamLines = [];
                    team.chars.forEach(char => {
                        teamLines.push(`Lv.${char.level} C${char.cinema} ${char.name}`);
                    });
                    teamLines.push(`Lv.${team.bangboo.level} ${team.bangboo.name}`);
                    embed.addFields({name: `Team ${i+1}`, value: teamLines.join("\n"), inline: true});
                })
            })
            await defer;
            return {embeds: [embed]};
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