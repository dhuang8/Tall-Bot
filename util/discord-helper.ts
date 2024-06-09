import { Client, TextChannel, Embed, User, MessageCreateOptions } from 'discord.js';
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
}

const DiscordHelper = new DiscordHelperClass();
export default DiscordHelper;