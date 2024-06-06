import { SlashCommandBuilder } from 'discord.js';

const slash = new SlashCommandBuilder()
    .setName('alarm-all')
    .setDescription('alarm')

const execute = async (interaction, client) => {
    return {embeds: [client.alarm_manager.createAlarmEmbed()]};
}

const personal = true;

export {
    slash, 
    execute,
    personal
};