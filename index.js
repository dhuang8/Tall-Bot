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
        } else message.channel.send({embeds: [msg]})
    } catch (e) {
        console.error(e);
    }
});

client.on('interactionCreate', async (interaction) => {
    //console.log(slash_commands);
    // If the interaction isn't a slash command, return
    try {
        if (!interaction.isCommand() && !interaction.isContextMenu()) {
            console.log(interaction_commands)
            let response = await interaction_commands.get("youtubebutton")?.execute(interaction);
            return response;
        }
        //console.log(interaction);
        let response = await slash_commands.get(interaction.commandName)?.execute(interaction);
        if (response != null) {
            console.log(response instanceof Discord.MessageEmbed)
            if (typeof response == "string") interaction.reply(response);
            else if (response instanceof Discord.MessageEmbed) interaction.reply({embeds: [response]})
            /*else if (response.execute) {
                let message = await interaction.reply({...response, fetchReply: true})
                const collector = message.createMessageComponentCollector();
                collector.on("collect", (interaction2)=>{
                    response.execute(interaction2, message);
                });
                collector.on("end", (interaction2)=>{
                    console.log("end")
                });
            }*/
            else interaction.reply(response)
        } else {
            interaction.reply("`Error`");
        }
    } catch (e) {
        console.error(e)
        //interaction.reply("`Error`");
    }
    /*
    // Check if it is the correct command
    if (interaction.commandName === 'echo2') {
      // Get the input of the user
      console.log(interaction);
      const input = interaction.options[0].value;
      // Reply to the command
      interaction.reply(input);
    }*/
});

async function clearSlashCommands() {
    let commands = await client.application.commands.set([]);
    client.guilds.cache.forEach((guild) => {
        guild.commands.set([])
    })
    /*.fetch();
    console.log(commands)
    commands.each(command=>{
        console.log("delete",command)
        command.delete();
    })
    console.log(commands)
    commands = await client.guilds.cache.get(config.guild_id).commands.fetch();
    commands.each(command=>{
        console.log("delete",command)
        command.delete();
    })*/
}

async function createSlashCommands() {
    slash_commands.each(command=>{
        //console.log("create", command.slash_command);
        if (config.test) {
            client.guilds.cache.get(config.guild_id).commands.create(command.slash_command);
        } else if (command.guild) {
            client.guilds.cache.get(command.guild).commands.create(command.slash_command);
        } else {
            client.application.commands.create(command.slash_command);
        }
    });
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
    //client.application.commands.create(commandData);
    /*
    setTimeout(()=>{
        console.log(client.application.commands)
    },5000)*/
})

client.login(config.token).catch(console.error);