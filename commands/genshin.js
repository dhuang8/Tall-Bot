import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import sql from '../util/SQLite.js';
import { GenshinImpact, LanguageEnum, GenshinRegion } from 'hoyoapi'

const slash = new SlashCommandBuilder()
    .setName('genshin')
    .setDescription('genshin impact')
    .addSubcommand(subcommand => 
        subcommand.setName("set")
        .setDescription("set cookie and uid")
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('hsr uid')
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
    const user = sql.prepare("SELECT hsr_cookie, genshin_uid from users WHERE user_id = ?").get(userId);
    if (user == null) return {error: "`Missing uid and cookie`"};
    const uid = user.genshin_uid;
    const cookie = user.hsr_cookie;
    if (uid == null || cookie == null) return {error: "`Missing uid and cookie`"};
    return {uid, cookie};
}

function timeOnNext(interval, offset){
    interval *= 1000;
    offset *= 1000;
    return Math.floor(((Math.floor((new Date().getTime()-offset) / interval)+1) * interval + offset) / 1000);
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

    if (dailyResponse?.is_sign) {
        descLines.push(`**Daily check-in** done`)
    } else {
        descLines.push(`**Daily check-in** incomplete`)
    }
    let tTime = staminaResponse.transformer.recovery_time;
    let milliAfter = tTime.Day*24*60*60 + tTime.Hour*60*60 + tTime.Minute*60 + tTime.Second;
    milliAfter = parseInt(new Date().getTime()/1000 + milliAfter);
    descLines.push(`**Resin**: ${staminaResponse.current_resin}/160, capped <t:${calcTimestampAfter(staminaResponse.resin_recovery_time)}:R>`)
    descLines.push(`**Daily Commissions**: ${staminaResponse.finished_task_num}/${staminaResponse.total_task_num}`)
    descLines.push(`**Realm Currency**: ${staminaResponse.current_home_coin}/${staminaResponse.max_home_coin}, capped <t:${calcTimestampAfter(staminaResponse.home_coin_recovery_time)}:R>`)
    descLines.push(`**Transformer** ready <t:${milliAfter}:R>`);
    
    const embed = new EmbedBuilder()
        .setTitle('Genshin Impact info')
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

    let spiralLines = []
    spiralLines.push(`**Max floor**: ${spiralResponse.max_floor}`);
    spiralLines.push(`**Stars**: ${spiralResponse.total_star}/36`);
    embed.addFields({name: "Spiral Abyss", value: spiralLines.join("\n")});

    let resetLines = [];
    resetLines.push(`**Daily** reset <t:${timeOnNext(24*60*60, 9*60*60)}:R>`)
    resetLines.push(`**Weekly** reset <t:${timeOnNext(7*24*60*60, 9*60*60+4*24*60*60)}:R>`)
    resetLines.push(`**Spiral Abyss** reset <t:${new Date(parseInt(spiralResponse.end_time)).getTime()}:R>`);
    embed.addFields({name: "Resets", value: resetLines.join("\n")});

    const refreshButton = new ButtonBuilder()
        .setCustomId(`genshin|${userId}`)
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
            if (claim?.status) return claim.status;
            throw new Error(JSON.stringify(claim));
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