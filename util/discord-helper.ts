import { Client, TextChannel, Embed, User, MessageCreateOptions, EmbedBuilder } from 'discord.js';
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
        this.client?.channels.fetch(channelId).then(async channel => {
            if (channel != null && channel.isTextBased()) {
                if (typeof message === "object" && message.embeds) {
                    let embeds = message.embeds;
                    let response_copy = message;
                    response_copy.embeds = [];
                    let text_length = 0;
                    for (let count=0; count < embeds.length; count++) {
                        let embed = EmbedBuilder.from(embeds[count]);
                        if (embed.length > 6000) throw new Error("embed length > 6000");
                        if ((text_length + embed.length) > 6000 || (response_copy.embeds && response_copy.embeds.length > 9)) {
                            await channel.send(response_copy);
                            response_copy = {embeds: []}
                            text_length = 0;
                        }
                        response_copy.embeds?.push(embed);
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