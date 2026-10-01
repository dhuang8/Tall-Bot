import { ButtonInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import sql from '../util/SQLite.js';
import { listSubscribedSubreddits, normalizeSubreddit, subscribeToSubreddit, unsubscribeFromSubreddit } from '../util/reddit.js';

const slash = new SlashCommandBuilder()
    .setName('reddit')
    .setDescription('subreddit notifications for this channel')
    .addSubcommand(subcommand =>
        subcommand.setName('subscribe')
            .setDescription('post new threads from a subreddit here')
            .addStringOption(option =>
                option.setName('subreddit')
                    .setDescription('subreddit name or Reddit URL')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand.setName('unsubscribe')
            .setDescription('stop posting threads from a subreddit here')
            .addStringOption(option =>
                option.setName('subreddit')
                    .setDescription('subreddit name or Reddit URL')
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand.setName('list')
            .setDescription('show this channel’s subreddit subscriptions')
    );

const execute = async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guildId || !interaction.channelId) {
        return { content: 'Reddit subscriptions are only available in server channels.', ephemeral: true };
    }

    if (interaction.options.getSubcommand() === 'list') {
        const subreddits = listSubscribedSubreddits(sql, interaction.channelId);
        const visibleSubreddits = subreddits.slice(0, 70).map((subreddit: string) => `r/${subreddit}`);
        const extraCount = subreddits.length - visibleSubreddits.length;
        const content = subreddits.length === 0
            ? 'This channel is not subscribed to any subreddits.'
            : `Subreddits for this channel:\n${visibleSubreddits.join('\n')}${extraCount > 0 ? `\n…and ${extraCount} more.` : ''}`;
        return { content, ephemeral: true };
    }

    let subreddit: string;
    try {
        subreddit = normalizeSubreddit(interaction.options.getString('subreddit', true));
    } catch (error) {
        return { content: error instanceof Error ? error.message : 'Invalid subreddit.', ephemeral: true };
    }

    if (interaction.options.getSubcommand() === 'subscribe') {
        const created = subscribeToSubreddit(sql, interaction.channelId, subreddit);
        return {
            content: created
                ? `Subscribed this channel to r/${subreddit}. New threads will be checked hourly.`
                : `This channel is already subscribed to r/${subreddit}.`,
            ephemeral: true
        };
    }

    const removed = unsubscribeFromSubreddit(sql, interaction.channelId, subreddit);
    return {
        content: removed
            ? `Unsubscribed this channel from r/${subreddit}.`
            : `This channel was not subscribed to r/${subreddit}.`,
        ephemeral: true
    };
};

const buttonClick = async (interaction: ButtonInteraction) => {
    const [, action, subredditInput] = interaction.customId.split('|');
    if (action !== 'unsubscribe' || !subredditInput || !interaction.guildId || !interaction.channelId) {
        await interaction.reply({ content: 'This unsubscribe button is invalid or expired.', ephemeral: true });
        return;
    }

    const subreddit = normalizeSubreddit(subredditInput);
    const removed = unsubscribeFromSubreddit(sql, interaction.channelId, subreddit);
    await interaction.reply({
        content: removed
            ? `Unsubscribed this channel from r/${subreddit}.`
            : `This channel was already unsubscribed from r/${subreddit}.`,
        ephemeral: true
    });
};

const personal = true;

export { slash, execute, buttonClick, personal };