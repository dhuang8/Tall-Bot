import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import sql from '../util/SQLite.js';
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
    )
    .addSubcommand(subcommand => 
        subcommand.setName("info")
        .setDescription("battle records")
    )
    /*.addSubcommand(subcommand => 
        subcommand.setName("redeem")
        .setDescription("redeem codes")
        .addStringOption(option =>
            option.setName('code')
            .setDescription('code')
            .setRequired(true)
        )
    )*/
    .addSubcommand(subcommand => 
        subcommand.setName("help")
        .setDescription("how to get cookie")
    )

function calcTimestampAfter(time) {
    return parseInt(new Date(new Date().getTime()+time*1000).getTime()/1000)
}

function getUidAndCookie(userId) {
    const user = sql.prepare("SELECT hsr_cookie, hsr_uid from users WHERE user_id = ?").get(userId);
    if (user == null) return {error: "Missing uid and cookie"};
    const uid = user.hsr_uid;
    const cookie = user.hsr_cookie;
    if (uid == null || cookie == null) return {error: "Missing uid and cookie"};
    return {uid, cookie};
}

function timeOnNext(interval, offset){
    interval *= 1000;
    offset *= 1000;
    return Math.floor(((Math.floor((new Date().getTime()-offset) / interval)+1) * interval + offset) / 1000);
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
    let mocResponse = await client.record.request.setQueryParams({
        server: client.record.region,
        role_id: client.record.uid,
        schedule_type: '1',
        need_all: 'false',
    }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/challenge')
    mocResponse = mocResponse.response.data;
    let suResponse = await client.record.request.setQueryParams({
        server: client.record.region,
        role_id: client.record.uid,
        schedule_type: '3',
        lang: client.record.lang,
        need_all: 'false',
    }).setDs().send('https://bbs-api-os.hoyolab.com/game_record/hkrpg/api/rogue')
    suResponse = suResponse.response.data;

    dailyResponse = await dailyResponse;
    staminaResponse = await staminaResponse;
    mocResponse = await mocResponse;
    suResponse = await suResponse;

    let descLines = [];
    if (dailyResponse?.is_sign) {
        descLines.push(`**Daily check-in** done`)
    } else {
        descLines.push(`**Daily check-in** incomplete`)
    }
    descLines.push(`**TP**: ${staminaResponse.current_stamina}/180, capped <t:${calcTimestampAfter(staminaResponse.stamina_recover_time)}:R>`)
    descLines.push(`**SU runs**: ${suResponse.current_record.basic.finish_cnt}`);

    const embed = new EmbedBuilder()
        .setTitle('Honkai Star Rail info')
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

    let mocLines = [];
    mocLines.push(`**Max floor**: ${mocResponse.max_floor}`);
    mocLines.push(`**Stars**: ${mocResponse.star_num}/30`);
    embed.addFields({name: "Memory of Chaos", value: mocLines.join("\n")});

    let resetLines = [];
    resetLines.push(`**Daily** reset <t:${timeOnNext(24*60*60, 8*60*60)}:R>`)
    resetLines.push(`**Weekly** reset <t:${timeOnNext(7*24*60*60, 8*60*60+4*24*60*60)}:R>`)
    let mocDate = new Date(mocResponse.end_time.year, mocResponse.end_time.month-1, mocResponse.end_time.day, mocResponse.end_time.hour+4, mocResponse.end_time.minute);
    resetLines.push(`**MoC** reset <t:${mocDate.getTime()/1000}:R>`);
    embed.addFields({name: "Resets", value: resetLines.join("\n")});

    const refreshButton = new ButtonBuilder()
        .setCustomId(`hsr|${userId}`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder()
        .addComponents(refreshButton);

    return {embeds: [embed], components: [row]};
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
        } case 'help' : {
            return `Log into <https://www.hoyolab.com/home>, type j into the address bar and paste the rest \`\`\`avascript: (function(){if(document.cookie.includes('ltoken')&&document.cookie.includes('ltuid')){const e=document.createElement('input');e.value=document.cookie,document.body.appendChild(e),e.focus(),e.select();var t=document.execCommand('copy');document.body.removeChild(e),t?alert('HoYoLAB cookie copied to clipboard'):prompt('Failed to copy cookie. Manually copy the cookie below:\n\n',e.value)}else alert('Please logout and log back in. Cookie is expired/invalid!')})();\`\`\``;
        } case 'test': {
            let hsr = getUidAndCookie(interaction.user.id);
            return "good";
        }
    }
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