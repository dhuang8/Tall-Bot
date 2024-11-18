import { Client, TextChannel, Embed, User, MessageCreateOptions, EmbedBuilder, ChannelType, APIEmbed } from 'discord.js';
import config from '../config.json' with { type: "json" };

class DiscordHelperClass {
    client?: Client;
    logChannel?: TextChannel;

    async attachClient(client: Client): Promise<void> {
        this.client = client;
        this.logChannel = await client.channels.fetch(config.channel_id) as TextChannel || undefined;
    }

    sendToLog(...lines: string[]): void {
        this.logChannel?.send(lines.join("\n").substring(0, 2000));
    }

    sendEmbedToLog(embed: Embed): void {
        this.logChannel?.send({embeds: [embed]});
    }

    whisper(userId: string, text: string | MessageCreateOptions): void {
        this.client?.users.fetch(userId).then(user => {
            user.send(text);
        }).catch(e => {
            this.sendToLog("Could not DM", `user: ${userId}`, e);
        })
    }

    async send(channelId: string, message: string | MessageCreateOptions) {
        this.client?.channels.fetch(channelId).then(async (channel) => {
            if (channel != null && channel.isTextBased()) {
                channel = channel as TextChannel;
                if (typeof message === "object" && message.embeds) {
                    let newEmbeds: APIEmbed[] = [];
                    let response_copy = message;
                    let text_length = 0;
                    for (let count=0; count < message.embeds.length; count++) {
                        let embed = EmbedBuilder.from(message.embeds[count]);
                        if (embed.length > 6000) throw new Error("embed length > 6000");
                        if ((text_length + embed.length) > 6000 || (newEmbeds.length > 9)) {
                            response_copy.embeds = newEmbeds;
                            await channel.send(response_copy);
                            newEmbeds = [];
                            text_length = 0;
                            response_copy = {};
                        }
                        newEmbeds.push(embed.toJSON());
                        text_length += embed.length;
                    }
                    await channel.send(response_copy);
                } else {
                    channel.send(message);
                }
            }
            this.sendToLog("not a text channel", `channel: ${channelId}`);
        }).catch(e => {
            this.sendToLog("Could not send to channel", `channel: ${channelId}`, e);
        })
    }
}

const DiscordHelper = new DiscordHelperClass();
export default DiscordHelper;