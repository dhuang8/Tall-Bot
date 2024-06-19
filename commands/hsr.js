import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import sql from '../util/SQLite.js';
import {HsrClient} from '../util/hoyo';
import {request} from '../util/functions.js';
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
    .setName('hsr')
    .setDescription('honkai star rail')
    .addSubcommand(subcommand => 
        subcommand.setName("set")
        .setDescription("set cookie and uid")
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('hsr uid')
            .setMinValue(600000000)
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
        subcommand.setName("moc")
        .setDescription("Memory of Chaos")
        .addIntegerOption(option =>
            option.setName('phase')
            .setDescription('which phase')
            .setRequired(true)
            .addChoices(
                {name: 'previous', value: 2},
                {name: 'recent', value: 1}
            )
        )
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('UID')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("pure-fiction")
        .setDescription("Pure Fiction")
        .addIntegerOption(option =>
            option.setName('phase')
            .setDescription('which phase')
            .setRequired(true)
            .addChoices(
                {name: 'previous', value: 2},
                {name: 'recent', value: 1}
            )
        )
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('UID')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("apoc-shadow")
        .setDescription("Apocalyptic Shadow")
        .addIntegerOption(option =>
            option.setName('phase')
            .setDescription('which phase')
            .setRequired(true)
            .addChoices(
                {name: 'previous', value: 2},
                {name: 'recent', value: 1}
            )
        )
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('UID')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("support-char")
        .setDescription("support character")
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('UID')
            .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('char-name')
            .setDescription('character name')
            .setRequired(false)
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
                {name: 'Daily Training', value: 'HSR Daily Training'},
                {name: 'Echo of War', value: 'HSR Echo of War'},
                {name: 'Trailblaze Power', value: 'HSR Trailblaze Power'},
                {name: 'Pure Fiction/Memory of Chaos', value: 'HSR Pure Fiction/Memory of Chaos'},
                {name: 'Simulated Universe', value: 'HSR Simulated Universe'},
                {name: 'Assignments', value: 'HSR Assignments'}
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
                {name: 'Daily Training', value: 'HSR Daily Training'},
                {name: 'Echo of War', value: 'HSR Echo of War'},
                {name: 'Trailblaze Power', value: 'HSR Trailblaze Power'},
                {name: 'Pure Fiction/Memory of Chaos', value: 'HSR Pure Fiction/Memory of Chaos'},
                {name: 'Simulated Universe', value: 'HSR Simulated Universe'}
            )
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("help")
        .setDescription("how to get cookie")
    )

function getUidAndCookie(userId) {
    const user = sql.prepare("SELECT hsr_cookie, hsr_uid from users WHERE user_id = ?").get(userId);
    if (user == null) return {error: "Missing uid and cookie"};
    const uid = user.hsr_uid;
    const cookie = user.hsr_cookie;
    if (uid == null || cookie == null) return {error: "Missing uid and cookie"};
    return {uid, cookie};
}

//TODO how to update if char doesn't exist
let charRequest = request("https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/index_min/en/characters.json");
let charMap = JSON.parse(await charRequest);
charMap[8001].name = charMap[8002].name = "Trailblazer (Physical)"
charMap[8003].name = charMap[8004].name = "Trailblazer (Fire)"
charMap[8005].name = charMap[8006].name = "Trailblazer (Imaginary)"

function createListFromAvatarList(avatars) {
    return avatars.map(ava => `Lv.${ava.level} ${charMap[ava.id].name}`).join("\n")
}

function calcScore(name, relic) {
    const include_main_stat = true;
    let slot = parseInt(relic.id % 10) - 1;
    // weights = [["AttackAddedRatio", 4, 2], ...] where 4 is value of a high roll substat and 2 is points per substat
    let weights = Object.entries(hsr_stats.weights[name]).sort((a,b) => {
        return b[1] - a[1];
    }).map(sub => {
        let stats = hsr_stats.subs[sub[0]];
        let max_sub_value = stats ? stats.base+stats.step*2 : hsr_stats.main[sub[0]]/10;
        sub.push(sub[1]/max_sub_value);
        return sub;
    });
    // console.log(mainstat , top4main[0] , top4main[1] , top4main[2] , top4main[3])
    let score = 0;
    let scores = [];
    if (include_main_stat) {
        let stats = weights.find(thisSub => {
            return thisSub[0] === relic.main_affix.type;
        })
        if (stats) {
            if (relic.main_affix.type == "SpeedDelta") {
                score += stats[1] * 25/2.6
                scores.push(stats[1] * 25/2.6);
            } else {
                score += stats[1] * 10
                scores.push(stats[1] * 10);
            }
        } else {
            scores.push(0);
        }
    }
    for (let sub of relic.sub_affix) {
        let stats = weights.find(thisSub => {
            return thisSub[0] === sub.type;
        })
        if (stats) {
            scores.push(sub.value * stats[2]);
            score += sub.value * stats[2];
        } else {
            scores.push(0);
        }
    }
    score = Math.round(score);
    let count_data = relic_count[name][slot]
    let count = count_data[score];
    if (count == null) {
        for (let [key,val] of Object.entries(count_data)) {
            let this_score = parseFloat(key);
            if (score < this_score) {
                count = val;
                break;
            }
        }
        if (count == null) count = 0;
    }
    if (count <= 0) return `**This shit is perfect**`;
    return `**TP upgrade cost**: ${count}`;
}

function createCharEmbed(char) {
    const embed = new EmbedBuilder()
        .setTitle(char.name)
        .setThumbnail(`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${char.icon}`);
    let descLines = [];
    if (char.light_cone) descLines.push(`**Light cone**: Lv.${char.light_cone?.level} S${char.light_cone?.rank} ${char.light_cone?.name}`)
    for (let obj of char.additions) {
        descLines.push(`**${obj.name}**: ${changeToPercent({percent: obj.percent, value: getTotalStat(char, obj.field)})}`)
    }
    // embed.setDescription(descLines.join("\n").slice(0,textLen));
    embed.addFields({name: "Stats", value: descLines.join("\n").slice(0,4095), inline: false});
    let name_for_relic = char.name
    if (!hsr_stats.weights[char.name]) {
        name_for_relic = char.path.name;
    }
    // console.log(char, name_for_relic);
    for (let relic of char.relics) {
        let descLines = [];
        descLines.push(`**Lv.${relic.level}**`);
        descLines.push(`**${relic.main_affix.name}**: ${changeToPercent(relic.main_affix)}`);
        for (let sub of relic.sub_affix) {
            descLines.push(`**${sub.name}**: ${changeToPercent(sub)}`)
        }
        descLines.push(calcScore(name_for_relic, relic));
        embed.addFields({name: relic.name, value: descLines.join("\n").slice(0,1000), inline: true});
    }
    // console.log(char.relic_sets.map(set => `${set.name} (${set.num}): ${set.desc}`).join("\n"));
    embed.addFields({name: "Set Bonuses", value: char.relic_sets.map(set => `${set.name} (${set.num})`).join("\n").slice(0,2000), inline: false});
    embed.setColor(char.element.color)
    embed.setFooter({text:`TP cost based on weights for ${name_for_relic}`})
    // console.log("size", char.name, embed.length)
    return embed;
}

const execute = async (interaction) => {
    switch (interaction.options.getSubcommand()) {
        case 'set': {
            const uid = interaction.options.getInteger("uid");
            const cookie = interaction.options.getString("cookie");
            const user = sql.prepare("INSERT INTO users(user_id, hsr_cookie, hsr_uid) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET hsr_cookie=COALESCE(excluded.hsr_cookie, hsr_cookie), hsr_uid=COALESCE(excluded.hsr_uid, hsr_uid) RETURNING hsr_cookie, hsr_uid;")
                .get(interaction.user.id, cookie, uid);
            const embed = new EmbedBuilder()
                .setTitle('Honkai Star Rail info')
                .addFields(
                    { name: 'uid', value: user.hsr_uid?.toString() ?? `not set` },
                    { name: 'cookie', value: user.hsr_cookie ?? `not set` }
                );
            return {embeds: [embed], ephemeral: true};
        } case 'info': {
            const defer = interaction.deferReply();
            const hsr = new HsrClient(interaction.user.id);
            const info = await hsr.buildUserEmbed();
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
        } case 'moc': {
            const uid = interaction.options.getInteger("uid");
            const phase = interaction.options.getInteger("phase");
            const defer = interaction.deferReply();
            let hsr;
            if (uid) hsr = new HsrClient({uid});
            else hsr = new HsrClient(interaction.user.id);
            const moc = await hsr.memoryOfChaos(phase, true);
            let descLines = [];
            descLines.push(`This Memory of Chaos ends <t:${moc.recovery_time}:R>`);
            descLines.push(`**Stars**: ${moc.current_stars}/${moc.max_stars}`);
            let embed = new EmbedBuilder()
                .setTitle('Honkai: Star Rail — Memory of Chaos')
                .setDescription(descLines.join("\n"))
            moc.floors.forEach(floor => {
                let lines = [];
                lines.push(':star:'.repeat(floor.stars));
                lines.push(`**Cycles**: ${floor.cycles}`)
                embed.addFields({name: floor.name, value: lines.join("\n")});
                floor.teams.forEach((team, i) => {
                    let desc = team.chars.map(char => {
                        return `Lv.${char.level} E${char.eidolon} ${char.name}`;
                    }).join("\n")
                    embed.addFields({name: `Team ${i+1}`, value: desc, inline: true});
                })
            })
            await defer;
            return {embeds: [embed]};
        } case 'pure-fiction': {
            const uid = interaction.options.getInteger("uid");
            const phase = interaction.options.getInteger("phase");
            const defer = interaction.deferReply();
            let hsr;
            if (uid) hsr = new HsrClient({uid});
            else hsr = new HsrClient(interaction.user.id);
            const pf = await hsr.pureFiction(phase, true);
            let descLines = [];
            descLines.push(`This Pure Fiction ends <t:${pf.recovery_time}:R>`);
            descLines.push(`**Stars**: ${pf.current_stars}/${pf.max_stars}`);
            let embed = new EmbedBuilder()
                .setTitle('Honkai: Star Rail — Pure Fiction')
                .setDescription(descLines.join("\n"))
            pf.floors.forEach(floor => {
                let lines = [];
                lines.push(':star:'.repeat(floor.stars));
                embed.addFields({name: floor.name, value: lines.join("\n")});
                floor.teams.forEach((team, i) => {
                    let teamLines = [];
                    teamLines.push(`**Score**: ${team.score}`);
                    teamLines.push(`**Cacophony**: ${team.buff}`);
                    team.chars.forEach(char => {
                        teamLines.push(`Lv.${char.level} E${char.eidolon} ${char.name}`);
                    });
                    embed.addFields({name: `Team ${i+1}`, value: teamLines.join("\n"), inline: true});
                })
            })
            await defer;
            return {embeds: [embed]};
        } case 'apoc-shadow': {
            const uid = interaction.options.getInteger("uid");
            const phase = interaction.options.getInteger("phase");
            const defer = interaction.deferReply();
            let hsr;
            if (uid) hsr = new HsrClient({uid});
            else hsr = new HsrClient(interaction.user.id);
            const as = await hsr.apocalypticShadow(phase, true);
            let descLines = [];
            descLines.push(`This Apocalyptic Shadow ends <t:${as.recovery_time}:R>`);
            descLines.push(`**Stars**: ${as.current_stars}/${as.max_stars}`);
            let embed = new EmbedBuilder()
                .setTitle('Honkai: Star Rail — Apocalyptic Shadow')
                .setDescription(descLines.join("\n"))
            as.floors.forEach(floor => {
                let lines = [];
                lines.push(':star:'.repeat(floor.stars));
                embed.addFields({name: floor.name, value: lines.join("\n")});
                floor.teams.forEach((team, i) => {
                    let teamLines = [];
                    teamLines.push(`**Score**: ${team.score}`);
                    teamLines.push(`**Finality's Axiom**: ${team.buff}`);
                    team.chars.forEach(char => {
                        teamLines.push(`Lv.${char.level} E${char.eidolon} ${char.name}`);
                    });
                    embed.addFields({name: `Team ${i+1}`, value: teamLines.join("\n"), inline: true});
                })
            })
            await defer;
            return {embeds: [embed]};
        } case 'help' : {
            return `Log into <https://www.hoyolab.com/home>, type \`java\` into the address bar and paste the rest \`\`\`script: (function(){if(document.cookie.includes('ltoken')&&document.cookie.includes('ltuid')){const e=document.createElement('input');e.value=document.cookie,document.body.appendChild(e),e.focus(),e.select();var t=document.execCommand('copy');document.body.removeChild(e),t?alert('HoYoLAB cookie copied to clipboard'):prompt('Failed to copy cookie. Manually copy the cookie below:\n\n',e.value)}else alert('Please logout and log back in. Cookie is expired/invalid!')})();\`\`\``;
        // } case 'test': {
        //     const hsr = getUidAndCookie(interaction.user.id);
        //     if (hsr.error) return hsr.error;
        //     const defer = interaction.deferReply();
        //     const client = new HonkaiStarRail({
        //         lang: LanguageEnum.ENGLISH,
        //         region: 'prod_official_usa',
        //         cookie: hsr.cookie,
        //         uid: hsr.uid
        //     })
        //     client.record.region = 'prod_official_usa'
        //     let mocResponse = await client.info();
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
        } case 'support-char': {
            let uid = interaction.options.getInteger("uid");
            if (uid == null) {
                const user = sql.prepare("SELECT hsr_uid from users WHERE user_id = ?").get(interaction.user.id);
                uid = user.hsr_uid;
            }
            if (uid == null) return `missing uid`;
            const defer = interaction.deferReply();
            const info = await request(`https://api.mihomo.me/sr_info_parsed/${uid}?lang=en`);
            let embeds = [];
            let char_name = interaction.options.getString("char-name");
            // if (char_name) {
            //     info.characters.forEach(char => embeds.push(createCharEmbed(char)));
            // } else {
                info.characters.filter(char => char_name == null || char.name.toLowerCase()
                    .indexOf(char_name.toLowerCase()) > -1)
                    .forEach(char => embeds.push(createCharEmbed(char)));
            // }
            await defer;
            if (embeds.length > 0) return {embeds};
            return "`No characters found`";
        } 
    }
}

function roundToPlaces(value, num = 2) {
    return Math.round(value * Math.pow(10, num))/Math.pow(10, num);
}

function changeToPercent(obj) {
    return obj.percent ? `${roundToPlaces(obj.value*100)}%` : roundToPlaces(obj.value);
}

function getTotalStat(char, fieldName) {
    return getFieldValue(char.attributes, fieldName) + getFieldValue(char.additions, fieldName);
}

function getFieldValue(arr, fieldName) {
    let obj = arr.find(obj => obj.field == fieldName)
    return obj ? obj.value : 0;
}

const buttonClick = async (interaction) => {
    let args = interaction.customId.split("|");
    if (interaction.user.id != args[1]) return interaction.reply({content: "`only the user can refresh`", ephemeral: true});
    const defer = interaction.deferUpdate();
    try {
        const hsr = new HsrClient(interaction.user.id);
        const info = await hsr.buildUserEmbed();
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