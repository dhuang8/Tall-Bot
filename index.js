"use strict";
import Discord from 'discord.js';
import fs from 'fs';
import config from './util/config.js';
import MessageResponse from './util/MessageResponse.js';
import cron from './util/gw2tracker.js';

const Collection = Discord.Collection;
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.DIRECT_MESSAGES, Discord.Intents.FLAGS.GUILD_VOICE_STATES]
});

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return;
        let msg = await MessageResponse.execute(message);
        if (msg == null) {
            return;
        }
        //check max length
        if (typeof msg == "string"){
            if (msg.length > 0) message.channel.send(msg).catch(err);
            else console.error("Empty message");
        } else if (msg instanceof Discord.MessageEmbed) message.channel.send({embeds: [msg]}).catch(err);
        else message.channel.send(response).catch(err);
    } catch (e) {
        console.error(e);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        //todo differentiate between other interactions
        if (!interaction.isCommand() && !interaction.isContextMenu()) {
            await interaction_commands.get("youtubebutton")?.execute(interaction);
            return;
        }
        if (slash_commands.get(interaction.commandName)) {
            let defer = interaction.deferReply();
            try {
                let response = await slash_commands.get(interaction.commandName)?.execute(interaction);
                await defer;
                if (typeof response == "string") {
                    let contents = Discord.Util.splitMessage(response,{maxLength: 9999});
                    interaction.followUp(contents[0]).catch(err);
                    contents.slice(1).forEach(res=>{
                        interaction.followUp(res).catch(err);
                    })
                } else if (response instanceof Discord.MessageEmbed) interaction.followUp({embeds: [response]})
                else if (response instanceof Discord.MessageAttachment) interaction.followUp({files: [response]})
                else interaction.followUp(response).catch(err);
            } catch (e) {
                await defer;
                err(e);
                interaction.followUp("`Error`").catch(err);
            }
        } else throw new Error("Missing command", interaction.commandName);
    } catch (e) {
        err(e);
        console.error(e)
        if (interaction.deferred) interaction.followUp("`Error`").catch(err);
        else interaction.reply("`Error`").catch(err);
    }
});

function err(error) {
    if (config.channel_id) {
        let contents = Discord.Util.splitMessage("```"+Discord.Util.escapeMarkdown(error.stack)+"```", {prepend: "```", append: "```"});
        let channel = client.channels.resolve(config.channel_id)
        contents.forEach(content=>{
            channel?.send(content).catch(function (e) {
                console.error(error.stack);
                console.error(e.stack);
                console.error("maybe missing bot channel");
            })
        })
    } else {
        console.error(error);
    }
}

async function clearSlashCommands() {
    await client.application.commands.set([]).catch(err);
    await Promise.all(client.guilds.cache.map((guild)=>{
        return guild.commands.set([]).catch(err);
    }));
}

async function createSlashCommands() {
    let global_slash_commands = [];
    let guild_slash_commands = {};
    slash_commands.each(command=>{
        //console.log("create", command.slash_command);
        if (config.test) {
            //client.guilds.cache.get(config.guild_id).commands.create(command.slash_command);
            if (guild_slash_commands[config.guild_id]) guild_slash_commands[config.guild_id].push(command.slash_command)
            else guild_slash_commands[config.guild_id] = [command.slash_command];
        } else if (command.guild) {
            //client.application.commands.create(command.slash_command,command.guild);
            if (guild_slash_commands[command.guild]) guild_slash_commands[command.guild].push(command.slash_command)
            else guild_slash_commands[command.guild] = [command.slash_command];
        } else {
            //client.application.commands.create(command.slash_command);
            global_slash_commands.push(command.slash_command);
        }
    });
    
    console.log("global commands",global_slash_commands.map(slash=>slash.name));
    client.application.commands.set(global_slash_commands).catch(err);
    for (let key in guild_slash_commands) {
        console.log("guild commands",key,guild_slash_commands[key].map(slash=>slash.name));
        client.application.commands.set(guild_slash_commands[key],key).catch(err);
    }
}

let slash_commands = new Collection();
let interaction_commands = new Collection();
//console.log(fs.readdirSync('./commands'))
fs.readdirSync('./commands').filter(file => file.endsWith('.js')).forEach(file=>{
    import(`./commands/${file}`).then(command=>{
        if (command.default.slash) slash_commands.set(command.default.name, command.default)
    }).catch(e=>{
        console.log(`could not load ${file} ${e}`)
    });
});
//console.log(fs.readdirSync('./interactions'))
fs.readdirSync('./interactions').filter(file => file.endsWith('.js')).forEach(file=>{
    import(`./interactions/${file}`).then(command=>{
        interaction_commands.set(command.default.name, command.default)
    }).catch(e=>{
        console.log(`could not load ${file} ${e}`);
    });
});

client.once("ready", async ()=>{
    console.log(`\`${process.platform} ready\``)
    //await clearSlashCommands();
    client.channels.resolve(config.channel_id).send(`\`${process.platform} ready\``);
    createSlashCommands();
    new cron(client);
})

client.login(config.token).catch(console.error);