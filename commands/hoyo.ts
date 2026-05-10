import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { GenshinClient} from '../util/hoyo/GenshinClient.ts';
import { HoyoClient, Resource } from '../util/hoyo/HoyoClient.ts';
import { ZzzClient } from '../util/hoyo/ZzzClient.ts';
import { HsrClient } from '../util/hoyo/HsrClient.ts';

const slash = new SlashCommandBuilder()
    .setName('hoyo')
    .setDescription('general hoyo stuff')
    .addSubcommand(subcommand => 
        subcommand.setName("timers")
        .setDescription("see all timers")
    )

async function getGameTimers(client: HoyoClient) {
    client.getTimers()
}

async function createTimerEmbed(user_id: string) {
    let timers: Resource[] = [];
    let proms = [];
    try {
        const genshin = new GenshinClient(user_id);
        proms.push(
            genshin.getTimers().then(thistimers => {
                timers = timers.concat(thistimers);
            }).catch(e => {
                
            })
        )
    } catch (e) {

    }
    try {
        const zzz = new ZzzClient(user_id);
        proms.push(
            zzz.getTimers().then(thistimers => {
                timers = timers.concat(thistimers);
            }).catch(e => {
                
            })
        )
    } catch (e) {
        
    }
    try {
        const hsr = new HsrClient(user_id);
        proms.push(
            hsr.getTimers().then(thistimers => {
                timers = timers.concat(thistimers);
            }).catch(e => {

            })
        )
    } catch (e) {
        
    }
    await Promise.all(proms);
    const embed = new EmbedBuilder()
        .setTitle('Hoyo Timers')
        .setTimestamp();
    let desc = timers.filter(timer => !timer.done).sort((a, b) => {
        return a.recovery_time - b.recovery_time || a.name.localeCompare(b.name);
    }).map(timer => {
        if (timer.max > 1)
            return `**${timer.name}** ${timer.current}/${timer.max} <t:${timer.recovery_time}:R>`
        else
            return `**${timer.name}** <t:${timer.recovery_time}:R>`
    }).join('\n')
    embed.setDescription(desc || "No timers")
    const refreshButton = new ButtonBuilder()
        .setCustomId(`hoyo|${user_id}`)
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(refreshButton);
    return { embeds: [embed], components: [row] };
}

const execute = async (interaction: ChatInputCommandInteraction) => {
    switch (interaction.options.getSubcommand()) {
        case 'timers': {
            const defer = interaction.deferReply();
            const response = await createTimerEmbed(interaction.user.id);
            await defer;
            return response;
        }
    }
}

const buttonClick = async (interaction: ButtonInteraction) => {
    let args = interaction.customId.split("|");
    if (interaction.user.id != args[1]) return interaction.reply({content: "`only the user can refresh`", ephemeral: true});
    const defer = interaction.deferUpdate();
    try {
        const response = await createTimerEmbed(interaction.user.id);
        await defer;
        interaction.editReply(response);
    } catch(e) {
        await defer;
        return interaction.followUp({content: "`Error`", ephemeral: true});
    }
}
export {
    slash, execute, buttonClick
};