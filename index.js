"use strict";
const Discord = require('discord.js');
const fs = require('fs');
const config = require('./util/config');
const MessageResponse = require('./util/MessageResponse');

const Collection = Discord.Collection;
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, `GUILD_VOICE_STATES`]
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
            if (msg.length > 0) message.channel.send(msg);
            else console.error("Empty message");
        } else if (msg instanceof Discord.MessageEmbed) message.channel.send({embeds: [msg]})
        else message.channel.send(response)
    } catch (e) {
        console.error(e);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        //todo differentiate between other interactions
        if (!interaction.isCommand() && !interaction.isContextMenu()) {
            let response = await interaction_commands.get("youtubebutton")?.execute(interaction);
            return response;
        }
        let response = await slash_commands.get(interaction.commandName)?.execute(interaction);
        if (response != null) {
            if (typeof response == "string") interaction.reply(response);
            else if (response instanceof Discord.MessageEmbed) interaction.reply({embeds: [response]})
            else interaction.reply(response)
        } else {
            if (!interaction.replied) interaction.reply("`Error`");
        }
    } catch (e) {
        console.error(e)
        if (!interaction.replied) interaction.reply("`Error`");
    }
});

async function clearSlashCommands() {
    await client.application.commands.set([]);
    await Promise.all(client.guilds.cache.map((guild)=>{
        return guild.commands.set([]);
    }));
}

async function createSlashCommands() {
    //let global_slash_commands = [];
    let guild_slash_commands = {};
    slash_commands.each(command=>{
        //console.log("create", command.slash_command);
        if (config.test) {
            client.guilds.cache.get(config.guild_id).commands.create(command.slash_command);
        } else if (command.guild) {
            //client.application.commands.create(command.slash_command,command.guild);
            if (guild_slash_commands[command.guild]) guild_slash_commands[command.guild].push(command.slash_command)
            else guild_slash_commands[command.guild] = [command.slash_command];
        } else {
            //client.application.commands.create(command.slash_command);
            global_slash_commands.push(command.slash_command);
        }
    });
    
    client.application.commands.set(global_slash_commands);
    for (let key in guild_slash_commands) {
        client.application.commands.set(guild_slash_commands[key],key);
    }
}

let slash_commands = new Collection();
let interaction_commands = new Collection();
console.log(fs.readdirSync('./commands'))
fs.readdirSync('./commands').filter(file => file.endsWith('.js')).forEach(file=>{
    const command = require(`./commands/${file}`);
    if (command.slash) slash_commands.set(command.name, command)
});
console.log(fs.readdirSync('./interactions'))
fs.readdirSync('./interactions').filter(file => file.endsWith('.js')).forEach(file=>{
    const command = require(`./interactions/${file}`);
    interaction_commands.set(command.name, command)
});

client.once("ready", async ()=>{
    //await clearSlashCommands();
    client.channels.resolve(config.channel_id).send(`\`${process.platform} ready\``)
    createSlashCommands()
})

client.login(config.token).catch(console.error);