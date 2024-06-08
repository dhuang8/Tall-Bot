"use strict";
import { Client, Events, GatewayIntentBits, Collection} from 'discord.js';
import AlarmManager from './util/alarm_manager.js';
import config from './config.json' with { type: "json" };

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
AlarmManager.attachClient(client);

let logChannel = null;
client.sendToLog = function(...lines) {
    logChannel?.send(lines.join("\n").substring(0, 2000));
}

client.sendEmbedToLog = function(embed) {
    logChannel?.send({embeds: [embed]});
}

let alarms = ["genshin_daily", "genshin_weekly", "genshin_spiral_abyss", "genshin_realm", "genshin_resin", "genshin_transformer"];

for (const alarm_name of alarms) {
    try {
        const alarm = (await import(`./alarms/${alarm_name}.js`)).default(client);
        AlarmManager.addAlarm(alarm);
    } catch (e) {
        console.log(`could not load alarm ${alarm_name} ${e}`);
        throw e;
    }
}

let commandsList = ["hsr", "youtube", "genshin", "birthday", "image", "alarm", "alarm_all"];

for (const commandName of commandsList) {
    try {
        const command = await import(`./commands/${commandName}.js`);
        client.commands.set(command.slash.name, command);
    } catch (e) {
        console.log(`could not load command ${commandName} ${e}`);
        throw e;
    }
}

let scheduleList = ["hsr_dailies", "genshin_login", "hsr_cap", "genshin_cap", "birthday", "hi3_dailies"];
scheduleList.forEach(name => {
    import(`./schedule/${name}.js`).then(sche=>{
        new sche.default(client);
    }).catch(e=>{
        console.log(`could not load schedule ${name} ${e}`);
        throw e;
    });
})

function logMessage(...lines) {
    return `${lines.join("\n")}`
}

async function interactionReply(interaction, response, replied = false) {
    if (replied) return interaction.followUp(response);
    if (interaction.deferred) return interaction.editReply(response);
    return interaction.reply(response);
}

client.on(Events.Error, async (e) => {
    console.error("error event", e);
})

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            logChannel?.send(logMessage(interaction.user.id, interaction.commandName, JSON.stringify(interaction.options))).catch(console.error);
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            try {
                const response = await command.execute(interaction, client);
                if (typeof response == "string") {
                    await interactionReply(interaction, response);
                } else if (typeof response === "object" && response.embeds) {
                    let embeds = response.embeds;
                    let response_copy = response;
                    response_copy.embeds = [];
                    let text_length = 0;
                    let replied = false;
                    for (let count=0; count < embeds.length; count++) {
                        let embed = embeds[count];
                        if (embed.length > 6000) throw new Error("embed length > 6000");
                        if (text_length + embed.length > 6000) {
                            await interactionReply(interaction, response_copy, replied);
                            replied = true;
                            response_copy = {embeds: []}
                            text_length = 0;
                        }
                        response_copy.embeds.push(embed);
                        text_length += embed.length;
                    }
                    await interactionReply(interaction, response_copy, replied);
                } else {
                    await interactionReply(interaction, response);
                }
            } catch (error) {
                console.error(error);
                logChannel?.send(logMessage(interaction.user.id, interaction.commandName, error.stack)).catch(console.error);
                await interactionReply(interaction, { content: '`Error`', ephemeral: true });
            }
        } else if (interaction.isButton()) {
            let args = interaction.customId.split("|");
            logChannel?.send(logMessage(interaction.user.id, interaction.customId)).catch(console.error);
            const command = interaction.client.commands.get(args[0]);
            await command.buttonClick(interaction);
        } else if (interaction.isStringSelectMenu()) {
            let args = interaction.customId.split("|");
            logChannel?.send(logMessage(interaction.user.id, interaction.customId)).catch(console.error);
            const command = interaction.client.commands.get(args[0]);
            await command.execute(interaction);
        }
    } catch (e) {
        console.error(e);
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
    try {
        if (config.test) {
            let response = await client.guilds.cache.get(config.guild_id).commands.set(
                client.commands.map(command => command.slash)
            );
        } else {
            await client.application.commands.set(
                client.commands.filter(command => !command.personal).map(command => command.slash)
            )
            await client.guilds.cache.get(config.guild_id).commands.set(
                client.commands.filter(command => command.personal).map(command => command.slash)
            )
        }
        console.log(`\`${process.platform} ready\``)
        logChannel = await client.channels.fetch(config.channel_id);
        AlarmManager.loop();
    } catch (e) {
        console.error(e);
    }
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
