"use strict";
import { Client, Events, GatewayIntentBits, Collection} from 'discord.js';
//import fs from 'fs';
//import {token} from ('./config.json');
//import MessageResponse from './util/MessageResponse.js';
//import cron from './util/gw2tracker.js';
//import birthdayschedule from './schedule/birthday.js';
//import Util from './util/functions.js';
import config from './config.json' assert { type: "json" };
//import { createRequire } from 'node:module';
//const require = createRequire(import.meta.url);
//const {token} = require("./config.json");
// process.setMaxListeners(100)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();

let commandsList = ["hsr", "youtube", "genshin"];

commandsList.forEach(commandName => {
    import(`./commands/${commandName}.js`).then(command=>{
        client.commands.set(command.slash.name, command);
    }).catch(e=>{
        console.log(`could not load ${commandName} ${e}`);
        throw e;
    });
})

let scheduleList = ["hsr_dailies", "genshin_dailies", "hsr_cap", "genshin_cap"];
if (!config.test) {
    scheduleList.forEach(name => {
        import(`./schedule/${name}.js`).then(sche=>{
            new sche.default(client);
        }).catch(e=>{
            console.log(`could not load ${name} ${e}`);
            throw e;
        });
    })
}

function logMessage(...lines) {
    return `${lines.join("\n")}`
}

let logChannel = null;
client.sendToLog = function(...lines) {
    logChannel?.send(lines.join("\n"));
}

client.on(Events.Error, async (e) => {
    console.error("error event", e);
})

client.on(Events.InteractionCreate, async (interaction) => {
	if (interaction.isChatInputCommand()) {
        logChannel?.send(logMessage(interaction.user.id, interaction.commandName, JSON.stringify(interaction.options)));
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
        try {
            const response = await command.execute(interaction);
            if (typeof response == "string") {
                if (interaction.replied || interaction.deferred) {
                    interaction.editReply(response).catch(console.error);
                } else {
                    interaction.reply(response).catch(console.error);
                }
            } else {
                if (interaction.replied || interaction.deferred) {
                    interaction.editReply(response).catch(console.error);
                }  else {
                    interaction.reply(response).catch(console.error);
                }
            }
        } catch (error) {
            logChannel?.send(logMessage(interaction.user.id, interaction.commandName, error.stack));
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: '`There was an error while executing this command!`', ephemeral: true });
            } else {
                await interaction.reply({ content: '`There was an error while executing this command!`', ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        let args = interaction.customId.split("|");
        logChannel?.send(logMessage(interaction.user.id, interaction.customId));
        const command = interaction.client.commands.get(args[0]);
        await command.buttonClick(interaction);
    } else if (interaction.isStringSelectMenu()) {
        let args = interaction.customId.split("|");
        logChannel?.send(logMessage(interaction.user.id, interaction.customId));
        const command = interaction.client.commands.get(args[0]);
        await command.execute(interaction);
    }
})

async function clearSlashCommands() {
    await client.application.commands.set([]).catch(console.error);
    await Promise.all(client.guilds.cache.map((guild)=>{
        return guild.commands.set([]).catch(console.error);
    }));
}
client.once("ready", async ()=>{
    //console.log("not loaded", not_loaded)
    //await clearSlashCommands();
    if (config.test) {
        client.guilds.cache.get(config.guild_id).commands.set(
            client.commands.map(command => command.slash)
        );
    } else {
        client.application.commands.set(
            client.commands.map(command => command.slash)
        )
    }
    console.log(`\`${process.platform} ready\``)
    logChannel = await client.channels.fetch(config.channel_id);
    //client.channels.resolve(config.channel_id)?.send(`\`${process.platform} ready\``);
    //createSlashCommands();
    //new cron(client);
    //new birthdayschedule(client);
})

client.login(config.token).catch(console.error);
/*
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
            let isEphemeral = slash_commands.get(interaction.commandName).ephemeral(interaction);
            let defer = interaction.deferReply({ephemeral: isEphemeral});
            try {
                let response = await slash_commands.get(interaction.commandName)?.execute(interaction);
                await defer;
                if (typeof response == "string") {
                    let contents = Discord.Util.splitMessage(response,{maxLength: 9999});
                    interaction.followUp(contents[0]).catch(err);
                    contents.slice(1).forEach(res=>{
                        interaction.followUp(res).catch(err);
                    })
                } else if (response instanceof Discord.MessageEmbed) {
                    Util.validateEmbed(response);
                    interaction.followUp({embeds: [response]}).catch(err);
                } else if (response instanceof Discord.MessageAttachment) interaction.followUp({files: [response]}).catch(err);
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

async function createSlashCommands() {
    let global_slash_commands = [];
    let guild_slash_commands = {};
    slash_commands.each(command=>{
        //console.log("create", command.slash_command);
        if (config.test) {
            client.guilds.cache.get(config.guild_id).commands.create(command.slash_command);
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
let not_loaded = [];
//console.log(fs.readdirSync('./commands'))

fs.readdirSync('./commands').filter(file => file.endsWith('.js') || file.endsWith('.mjs')).filter(file => file.indexOf("test") < 0).forEach(file=>{
    import(`./commands/${file}`).then(command=>{
        if (command.default.slash) slash_commands.set(command.default.name, command.default)
    }).catch(e=>{
        console.log(`could not load ${file} ${e}`);
        not_loaded.push(`/commands/${file}`);
    });
});
//console.log(fs.readdirSync('./interactions'))

fs.readdirSync('./interactions').filter(file => file.endsWith('.js')).filter(file => file.indexOf("test") < 0).forEach(file=>{
    import(`./interactions/${file}`).then(command=>{
        interaction_commands.set(command.default.name, command.default)
    }).catch(e=>{
        console.log(`could not load ${file}`);
        not_loaded.push(`/interactions/${file}`);
    });
});
*/
