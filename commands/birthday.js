import { SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import Command from '../util/Command.js';
import sql from '../util/SQLite.js';

let month_names = ["January","February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let months = month_names.map((name, index) =>{
    return {
        name,
        value: index
    }
})

function convertToYYYYMMDD(date) {
    return date.toISOString().substring(4,10)
}

function getDateFromYMD(y, m, d) {
    return new Date(y, m-1, d);
}

const slash = new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('birthday')
    .addSubcommand(subcommand => 
        subcommand.setName("set")
        .setDescription("set your birthday")
        .addIntegerOption(option =>
            option.setName('month')
            .setDescription('month')
            .setMinValue(1)
            .setMaxValue(12)
            .setRequired(true)
        ).addIntegerOption(option =>
            option.setName('day')
            .setDescription('day')
            .setMinValue(1)
            .setMaxValue(31)
            .setRequired(true)
        ).addIntegerOption(option =>
            option.setName('year')
            .setDescription('year')
            .setMinValue(0)
            .setMaxValue(3000)
            .setRequired(false)
        )
    ).addSubcommand(subcommand => 
        subcommand.setName("set2")
        .setDescription("set2 your birthday")
    ).addSubcommand(subcommand => 
        subcommand.setName("get")
        .setDescription("get birthday")
        .addUserOption(option => 
            option.setName('user')
            .setDescription('user')
            .setRequired(true)
        )
    )
/*
export default new Command({
	name: 'birthday',
    description: 'birthday',
    type: "CHAT_INPUT",
    options: [{
        name: 'set',
        description: 'set your birthday',
        type: 1,
        options: [{
            name: "month",
            description: "month",
            type: "INTEGER",
            required: true,
            choices: months,
        },{
            name: "day",
            description: "day",
            type: "INTEGER",
            required: true
        },{
            name: "year",
            description: "year",
            type: "INTEGER",
            required: true
        }]
    },{
        name: 'set2',
        description: 'set your birthday',
        type: 1
    },{
        name: "get",
        description: "get birthday",
        type: 1,
        options: [{
            name: "user",
            description: "get user's birthday",
            type: "USER",
            required: false
        }]
    }],

    */

const execute = async (interaction) => {
    switch (interaction.options.data[0].name) {
        case "set": {
            let args = interaction.options.data[0].options;
            let birthyear = args[2] ? args[2].value : 1990;
            let birthdate = getDateFromYMD(birthyear, args[0].value, args[1].value);
            sql.prepare("INSERT INTO users(user_id, birthday, birthday_channel) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET birthday=excluded.birthday, birthday_channel=excluded.birthday_channel;").run(interaction.user.id, convertToYYYYMMDD(birthdate), interaction.channelId);
            return `\`Birthday set to ${birthdate.toLocaleString('default', {
                month: 'short', day: 'numeric'
            })}\``;
        }
        case "get":
            let data = sql.prepare("SELECT birthday FROM users WHERE user_id = ?").get(interaction.options.data[0].options[0].user.id);
            if (data === undefined) return "`No birthday found`";
            let now = new Date();
            let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            let birthdate = getDateFromYMD(...data.birthday.split("-"));
            birthdate.setFullYear(now.getFullYear());
            if (birthdate < today)
                birthdate.setFullYear(now.getFullYear()+1);
            return `${interaction.options.data[0].options[0].user}'s birthday is <t:${birthdate.getTime()/1000}:R>`;
        default:
            break;
    }
    return "0";
}

export {
    slash, execute
};