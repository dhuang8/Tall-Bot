import { SlashCommandBuilder } from 'discord.js';
import AlarmManager from '../util/alarm-manager.js';

const slash = new SlashCommandBuilder()
    .setName('alarm-all')
    .setDescription('alarm')

const execute = async (interaction, client) => {
    return {embeds: [AlarmManager.createAlarmEmbed()]};
}

const personal = true;

export {
    slash, 
    execute,
    personal
};