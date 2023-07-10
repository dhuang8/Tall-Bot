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
                .setRequired(true)
                .setMinValue(600000000)
        ).addStringOption(option =>
            option.setName('cookie')
                .setDescription('cookie from website')
                .setRequired(true)
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
            
            staminaResponse = await staminaResponse;
            let descLines = [];
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
        } case 'redeem': {
            const code = interaction.options.getString("code");
            const user = sql.prepare("SELECT hsr_cookie, hsr_uid from users WHERE user_id = ?").get(interaction.user.id);
            const uid = user.hsr_uid;
            const cookie = user.hsr_cookie;
            let codeResp = await request({
                url: `https://sg-hkrpg-api.hoyoverse.com/common/apicdkey/api/webExchangeCdkey?t=${new Date().valueOf()}&lang=en&game_biz=hkrpg_global&uid=${uid}&region=prod_official_usa&cdkey=${code}`,
                headers: {
                    "X-Rpc-Language": "en",
                    "Cookie": `${cookie}`
                }
            })
            return `${codeResp.message}`;
        }
    }
}
export {
    slash, execute
};