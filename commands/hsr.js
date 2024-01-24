import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import sql from '../util/SQLite.js';
import {crossIfTrue, calcTimestampAfter} from '../util/hoyo.js';
import {timeOnNext, request} from '../util/functions.js';
import { HonkaiStarRail, LanguageEnum, HsrRegion } from 'hoyoapi'
import fs from 'fs';

let hsr_stats;
let jingliu_test;
try {
    hsr_stats = JSON.parse(fs.readFileSync("./data/hsr_weights.json", 'utf8'));
    jingliu_test = JSON.parse(fs.readFileSync("./data/jingliu_test.json", 'utf8'));
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
            .setRequired(true)
        ).addStringOption(option =>
            option.setName('cookie')
            .setDescription('cookie from website')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand => 
        subcommand.setName("info")
        .setDescription("Battle Chronicle")
    )
    .addSubcommand(subcommand => 
        subcommand.setName("moc")
        .setDescription("Memory of Chaos")
    )
    .addSubcommand(subcommand => 
        subcommand.setName("support-char")
        .setDescription("support character")
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('UID')
            .setRequired(false)
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
charMap[8002].name = charMap[8001].name = "Trailblazer (Physical)"
charMap[8003].name = charMap[8004].name = "Trailblazer (Fire)"

function createListFromAvatarList(avatars) {
    return avatars.map(ava => `Lv.${ava.level} ${charMap[ava.id].name}`).join("\n")
}

async function generateInfo(hsr, userId) {
    const client = new HonkaiStarRail({
        lang: LanguageEnum.ENGLISH,
        region: 'prod_official_usa',
        cookie: hsr.cookie,
        uid: hsr.uid
    })
    client.record.region = 'prod_official_usa'

    let dailyResponse = client.daily.info()
    let staminaResponse = client.record.note();
    //let mocResponse = client.record.forgottenHall();
    let mocResponse1 = await client.record.request.setQueryParams({
        server: client.record.region,
        role_id: client.record.uid,
        schedule_type: '1',
        need_all: 'false',
    }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge')
    let mocResponse2 = await client.record.request.setQueryParams({
        server: client.record.region,
        role_id: client.record.uid,
        schedule_type: '2',
        need_all: 'false',
    }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge')
    let pfResponse1 = await client.record.request.setQueryParams({
        server: client.record.region,
        role_id: client.record.uid,
        schedule_type: '2',
        need_all: 'false',
    }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge_story')
    let pfResponse2 = await client.record.request.setQueryParams({
        server: client.record.region,
        role_id: client.record.uid,
        schedule_type: '1',
        need_all: 'false',
    }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge_story')
    mocResponse1 = mocResponse1.response.data;
    mocResponse2 = mocResponse2.response.data;
    pfResponse1 = pfResponse1.response.data;
    pfResponse2 = pfResponse2.response.data;
    let suResponse = await client.record.request.setQueryParams({
        server: client.record.region,
        role_id: client.record.uid,
        schedule_type: '3',
        lang: client.record.lang,
        need_all: 'false',
    }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/rogue')
    suResponse = suResponse.response.data;

    //TODO probably a better way to do this
    dailyResponse = await dailyResponse;
    staminaResponse = await staminaResponse;
    let mocResponses = [await mocResponse1, await mocResponse2];
    let pfResponses = [await pfResponse1, await pfResponse2];
    suResponse = await suResponse;

    let nextUpdate = null;
    const newCapped = staminaResponse.current_stamina >= staminaResponse.max_stamina-1 ? 1 : 0;
    if (newCapped) nextUpdate = calcTimestampAfter(60*60*12)
    else nextUpdate = calcTimestampAfter(staminaResponse.stamina_recover_time)
    sql.prepare("UPDATE users SET hsr_capped=?, hsr_next_update=? WHERE user_id = ?;").run(newCapped, nextUpdate, userId);

    let descLines = [];
    descLines.push(`**TP**: ${staminaResponse.current_stamina}/${staminaResponse.max_stamina}, capped <t:${calcTimestampAfter(staminaResponse.stamina_recover_time)}:R>`)
    descLines.push(`**Reserve TP**: ${staminaResponse.current_reserve_stamina}/2400`)
    const embed = new EmbedBuilder()
        .setTitle('Honkai: Star Rail — Battle Chronicle')
        .setDescription(descLines.join("\n"))
        .setTimestamp();
    
    let assignmentLines = [];
    staminaResponse.expeditions.forEach((expedition, i) => {
        if (expedition.status === "Finished") {
            assignmentLines.push(`**Assignment ${i+1}** complete`)
        } else {
            assignmentLines.push(`**Assignment ${i+1}** <t:${calcTimestampAfter(expedition.remaining_time)}:R>`)
        }
    })
    embed.addFields({name: "Assignments", value: assignmentLines.join("\n")});
    
    embed.addFields({name: `Check-in reset <t:${timeOnNext(24*60*60, 16*60*60)}:R>`, value: crossIfTrue(dailyResponse?.is_sign, `Daily check-in`)});

    let dailyLines = [];
    dailyLines.push(crossIfTrue(
        staminaResponse.current_train_score == staminaResponse.max_train_score,
        `**Daily Training**: ${staminaResponse.current_train_score}/${staminaResponse.max_train_score}`
    ))
    embed.addFields({name: `Daily reset <t:${timeOnNext(24*60*60, 9*60*60)}:R>`, value: dailyLines.join("\n")});

    let weeklyLines = [];
    weeklyLines.push(crossIfTrue(
        staminaResponse.weekly_cocoon_cnt == 0,
        `**Echo of War**: ${staminaResponse.weekly_cocoon_limit-staminaResponse.weekly_cocoon_cnt}/${staminaResponse.weekly_cocoon_limit}`
    ));
    weeklyLines.push(crossIfTrue(
        staminaResponse.current_rogue_score == staminaResponse.max_rogue_score,
        `**SU score**: ${staminaResponse.current_rogue_score}/${staminaResponse.max_rogue_score}`
    ));
    weeklyLines.push(crossIfTrue(
        suResponse.current_record.basic.finish_cnt > 33,
        `**SU runs**: ${suResponse.current_record.basic.finish_cnt}/34 (100 elites)` 
    ));
    embed.addFields({name: `Weekly reset <t:${timeOnNext(7*24*60*60, 9*60*60+4*24*60*60)}:R>`, value: weeklyLines.join("\n")});

    for (let i=0; i<2;i++) {
        let mocResponse = mocResponses[i];
        if (mocResponse.all_floor_detail.length == 0) continue;
        let mocLines = [];
        let mocDate = new Date(mocResponse.end_time.year, mocResponse.end_time.month-1, mocResponse.end_time.day, mocResponse.end_time.hour+5, mocResponse.end_time.minute);
        mocLines.push(crossIfTrue(
            mocResponse.max_floor.indexOf("XII") > -1,
            `**Max floor**: ${mocResponse.max_floor.replace("<unbreak>", "").replace("</unbreak>", "")}`
        ));
        mocLines.push(crossIfTrue(
            mocResponse.star_num >= 36,
            `**Stars**: ${mocResponse.star_num}/36`
        ));
        embed.addFields({name: `This Memory of Chaos ends <t:${mocDate.getTime()/1000}:R>`, value: mocLines.join("\n")});
    }

    for (let i=0; i<2;i++) {
        let pfResponse = pfResponses[i];
        if (pfResponse.all_floor_detail.length == 0) continue;
        let pfLines = [];
        let pfDate = new Date(
            pfResponse.groups[0].end_time.year, 
            pfResponse.groups[0].end_time.month-1, 
            pfResponse.groups[0].end_time.day, 
            pfResponse.groups[0].end_time.hour+5, 
            pfResponse.groups[0].end_time.minute);
        pfLines.push(crossIfTrue(
            pfResponse.max_floor.indexOf("IV") > -1,
            `**Max floor**: ${pfResponse.max_floor.replace("<unbreak>", "").replace("</unbreak>", "")}`
        ));
        pfLines.push(crossIfTrue(
            pfResponse.star_num >= 12,
            `**Stars**: ${pfResponse.star_num}/12`
        ));
        embed.addFields({name: `This Pure Fiction ends <t:${pfDate.getTime()/1000}:R>`, value: pfLines.join("\n")});
    }

    const refreshButton = new ButtonBuilder()
        .setCustomId(`hsr|${userId}`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder()
        .addComponents(refreshButton);

    return {embeds: [embed], components: [row]};
}

let relic_mains = [];
relic_mains[3] = ["AttackAddedRatio", "CriticalChanceBase", "CriticalDamageBase"];
relic_mains[4] = ["AttackAddedRatio", "SpeedDelta"];
relic_mains[5] = [
    "AttackAddedRatio",
    "PhysicalAddedRatio",
    "FireAddedRatio",
    "IceAddedRatio",
    "ThunderAddedRatio",
    "WindAddedRatio",
    "QuantumAddedRatio",
    "ImaginaryAddedRatio"
];
relic_mains[6] = ["AttackAddedRatio"];

function calcScore(name, relic) {
    // name = "Jingliu"
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
    let count_data = jingliu_test[name][slot]
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
    let textLen = 5000;
    const embed = new EmbedBuilder()
        .setTitle(char.name)
        .setThumbnail(`https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/${char.icon}`);
    let descLines = [];
    if (char.light_cone) descLines.push(`**Light cone**: Lv.${char.light_cone?.level} S${char.light_cone?.rank} ${char.light_cone?.name}`)
    for (let obj of char.additions) {
        descLines.push(`**${obj.name}**: ${changeToPercent({percent: obj.percent, value: getTotalStat(char, obj.field)})}`)
    }
    embed.setDescription(descLines.join("\n").slice(0,textLen));
    let name_for_relic = char.name
    if (!hsr_stats.weights[char.name]) {
        name_for_relic = char.path.name;
    }
    for (let relic of char.relics) {
        let descLines = [];
        descLines.push(`**Lv.${relic.level}**`);
        descLines.push(`**${relic.main_affix.name}**: ${changeToPercent(relic.main_affix)}`);
        for (let sub of relic.sub_affix) {
            descLines.push(`**${sub.name}**: ${changeToPercent(sub)}`)
        }
        descLines.push(calcScore(name_for_relic, relic));
        embed.addFields({name: relic.name, value: descLines.join("\n").slice(0,textLen), inline: true});
    }
    // console.log(char.relic_sets.map(set => `${set.name} (${set.num}): ${set.desc}`).join("\n"));
    embed.addFields({name: "Set Bonuses", value: char.relic_sets.map(set => `${set.name} (${set.num})`).join("\n").slice(0,textLen), inline: false});
    embed.setColor(char.element.color)
    embed.setFooter({text:`TP cost based on weights for ${name_for_relic}`})
    return embed;
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
            const hsr = getUidAndCookie(interaction.user.id);
            if (hsr.error) return hsr.error;
            const defer = interaction.deferReply();
            let info = await generateInfo(hsr, interaction.user.id);
            await defer;
            return info;
        } case 'daily': {
            const hsr = getUidAndCookie(interaction.user.id);
            if (hsr.error) return hsr.error;
            const client = new HonkaiStarRail({
                lang: LanguageEnum.ENGLISH,
                region: 'prod_official_usa',
                cookie: hsr.cookie,
                uid: hsr.uid
            })
            const claim = await client.daily.claim()
            if (claim?.status) return claim.status;
            throw new Error(JSON.stringify(claim));
        } case 'moc': {
            const hsr = getUidAndCookie(interaction.user.id);
            if (hsr.error) return hsr.error;
            const defer = interaction.deferReply();
            const client = new HonkaiStarRail({
                lang: LanguageEnum.ENGLISH,
                region: 'prod_official_usa',
                cookie: hsr.cookie,
                uid: hsr.uid
            })
            client.record.region = 'prod_official_usa';
            let mocResponse1 = await client.record.request.setQueryParams({
                server: client.record.region,
                role_id: client.record.uid,
                schedule_type: '1',
                need_all: 'true',
            }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge')
            let mocResponse2 = await client.record.request.setQueryParams({
                server: client.record.region,
                role_id: client.record.uid,
                schedule_type: '2',
                need_all: 'true',
            }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge')
            let embeds = []
            let mocResponses = [mocResponse1.response.data, mocResponse2.response.data]
            for (let i=0;i<2;i++) {
                let mocResponse = mocResponses[i]
                let mocDate = new Date(mocResponse.end_time.year, mocResponse.end_time.month-1, mocResponse.end_time.day, mocResponse.end_time.hour+5, mocResponse.end_time.minute);
                let descLines = [];
                descLines.push(`This Memory of Chaos ends <t:${mocDate.getTime()/1000}:R>`);
                descLines.push(`**Stars**: ${mocResponse.star_num}/36`);
                let embed = new EmbedBuilder()
                    .setTitle('Honkai: Star Rail — Memory of Chaos')
                    .setDescription(descLines.join("\n"))
                mocResponse.all_floor_detail.forEach(floor => {
                    if (floor.is_fast) return;
                    if (embed.addFields.length > 21) {
                        embeds.push(embed);
                        embed = new EmbedBuilder();
                    }
                    const name = floor.name.replace("<unbreak>", "").replace("</unbreak>", "");
                    const stars = floor.star_num;
                    const cycles = floor.round_num;
                    let lines = [];
                    lines.push(':star:'.repeat(stars));
                    lines.push(`**Cycles**: ${cycles}`)
                    embed.addFields({name, value: lines.join("\n")});
                    embed.addFields({name: 'Team 1', value: createListFromAvatarList(floor.node_1.avatars), inline: true});
                    embed.addFields({name: 'Team 2', value: createListFromAvatarList(floor.node_2.avatars), inline: true});
                })
                embed.setTimestamp();
                embeds.push(embed);
            }
            await defer;
            return {embeds};
        } case 'help' : {
            return `Log into <https://www.hoyolab.com/home>, type \`java\` into the address bar and paste the rest \`\`\`script: (function(){if(document.cookie.includes('ltoken')&&document.cookie.includes('ltuid')){const e=document.createElement('input');e.value=document.cookie,document.body.appendChild(e),e.focus(),e.select();var t=document.execCommand('copy');document.body.removeChild(e),t?alert('HoYoLAB cookie copied to clipboard'):prompt('Failed to copy cookie. Manually copy the cookie below:\n\n',e.value)}else alert('Please logout and log back in. Cookie is expired/invalid!')})();\`\`\``;
        } case 'test': {
            const hsr = getUidAndCookie(interaction.user.id);
            if (hsr.error) return hsr.error;
            const defer = interaction.deferReply();
            const client = new HonkaiStarRail({
                lang: LanguageEnum.ENGLISH,
                region: 'prod_official_usa',
                cookie: hsr.cookie,
                uid: hsr.uid
            })
            client.record.region = 'prod_official_usa'
            let mocResponse = await client.info();
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
            info.characters.forEach(char => embeds.push(createCharEmbed(char)));
            await defer;
            return {embeds};
        } case 'redeem' : {
            const user = sql.prepare("SELECT hsr_cookie2, hsr_uid from users WHERE user_id = ?").get(interaction.user.id);
            if (user == null) return "`Missing uid and cookie`";
            const uid = user.hsr_uid;
            const cookie = user.hsr_cookie2;
            if (uid == null || cookie == null) return {error: "`Missing uid and cookie`"};
            const hsr = {uid, cookie};
            const defer = interaction.deferReply();
            const client = new HonkaiStarRail({
                lang: "en",
                region: "prod_official_usa",
                cookie: hsr.cookie,
                uid: hsr.uid
            })
            client.redeem.region = 'prod_official_usa';
            client.redeem.game_biz = "hkrpg_global";
            client.redeem.t = Date.now();
            console.log(client.redeem);
            const code = interaction.options.getString("code");
            const redeem = await client.redeem.claim(code);
            await defer;
            console.log(redeem);
            return JSON.stringify(redeem);
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
    const hsr = getUidAndCookie(args[1]);
    if (hsr.error) return interaction.reply({content: hsr.error, ephemeral: true});
    const defer = interaction.deferUpdate();
    let info = await generateInfo(hsr, args[1]);
    await defer;
    interaction.editReply(info);
}

export {
    slash, execute, buttonClick
};