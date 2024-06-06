import { SlashCommandBuilder } from 'discord.js';

const slash = new SlashCommandBuilder()
    .setName('alarm')
    .setDescription('alarm')
    .addSubcommand(subcommand => 
        subcommand.setName("list")
        .setDescription("list alarms")
    )
    .addSubcommand(subcommand => 
        subcommand.setName("delete")
        .setDescription("delete alarm")
        .addStringOption(option =>
            option.setName('alarm')
            .setDescription('toggle alarm')
            .setRequired(true)
            .addChoices(
                {name: 'Genshin Daily Commissions', value: 'Genshin Daily Commissions'}
            )
        )
    )

const execute = async (interaction, client) => {
    switch (interaction.options.data[0].name) {
        case "list": {
            return {embeds: [client.alarm_manager.createUserAlarmEmbed(interaction.user.id)]};
        }
    }
}

export {
    slash, 
    execute
};