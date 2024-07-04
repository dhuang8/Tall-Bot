import { BaseInteraction, ChatInputCommandInteraction, EmbedBuilder, Interaction, SlashCommandBuilder, StringSelectMenuInteraction } from 'discord.js';
import sql from '../util/SQLite.js';

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
        }
    }
}

const personal = true;

export {
    slash, 
    execute,
    personal
};