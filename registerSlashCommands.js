import { REST, Routes } from 'discord.js';
import config from './config.json' with { type: "json" };

let commandsList = ["hsr", "youtube", "genshin", "birthday"];
let commands = [];

for (const commandName of commandsList) {
    try {
        const command = await import(`./commands/${commandName}.js`);
        commands.push(command);
        console.log(command.slash.toJSON());
    } catch (e) {
        console.log(`could not load ${commandName} ${e}`);
        throw e;
    }
}

const rest = new REST({ version: '10' }).setToken(config.token);
try {
    if (config.test) {
        console.log('Started refreshing application (/) commands.');
        console.log(commands);
        const data = await rest.put(Routes.applicationGuildCommands(config.client_id, config.guild_id), {
            body: commands 
        });
        console.log(data);
    } else {
        console.log('Started refreshing application (/) commands.');
        const data = await rest.put(Routes.applicationCommands(config.client_id), {
            body: commands
        });
        console.log('Successfully reloaded application (/) commands.');
        console.log(data);
    }
} catch (error) {
    console.error(error);
}