import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, escapeMarkdown } from 'discord.js';
import sql from '../util/SQLite.js';
import { Hi3Client } from '../util/hoyo/Hi3Client.ts';

const slash = new SlashCommandBuilder()
    .setName('hi3')
    .setDescription('honkai impact 3rd')
    .addSubcommand(subcommand => 
        subcommand.setName("set")
        .setDescription("set cookie and uid")
        .addIntegerOption(option =>
            option.setName('uid')
            .setDescription('hi3 uid')
            .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('cookie')
            .setDescription('cookie from website')
            .setRequired(false)
        )
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

const execute = async (interaction: ChatInputCommandInteraction) => {
    switch (interaction.options.getSubcommand()) {
        case 'set': {
            const uid = interaction.options.getInteger("uid");
            const cookie = interaction.options.getString("cookie");
            const user = sql.prepare<[string, string | null, number | null], {user_id: string, hsr_cookie: string, hi3_uid: number}>("INSERT INTO users(user_id, hsr_cookie, hi3_uid) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET hsr_cookie=COALESCE(excluded.hsr_cookie, hsr_cookie), hi3_uid=COALESCE(excluded.hi3_uid, hi3_uid) RETURNING hsr_cookie, hi3_uid;")
                .get(interaction.user.id, cookie, uid);
            const embed = new EmbedBuilder()
                .setTitle('Honkai Impact 3rd')
                .addFields(
                    { name: 'uid', value: user?.hi3_uid?.toString() ?? `not set` },
                    { name: 'cookie', value: user?.hsr_cookie ?? `not set` }
                );
            return {embeds: [embed], ephemeral: true};
        } case 'news': {
            const defer = interaction.deferReply();
            let posts = await Hi3Client.news();
            let desc = posts.map(post => {
                return `[${escapeMarkdown(post.title)}](${post.url}) - <t:${post.created}>`
            }).join("\n");
            const embed = new EmbedBuilder()
                .setTitle(`Honkai Impact 3rd — news`)
                .setDescription(desc)
                .setTimestamp();
            await defer;
            return {embeds: [embed]};
        } case 'auto-news': {
            const toggle = interaction.options.getBoolean('toggle') || false;
            sql.prepare("UPDATE channels SET hi3_news = ? WHERE channel_id = ?;").run(+toggle, interaction.channel?.id);
            return `\`HI3 news will ${toggle ? '' : 'no longer '}be automatically posted here\``;
        }
    }
}

const personal = true;

export {
    slash, 
    execute,
    personal
}