import Command from '../util/Command.js';
import moment from 'moment-timezone';
import sql from '../util/SQLite.js';

moment.tz.setDefault("America/New_York");

let month_names = ["January","February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let months = month_names.map((name, index) =>{
    return {
        name,
        value: index
    }
})

export default new Command({
	name: 'birthday',
    description: 'birthday',
    type: "CHAT_INPUT",
    options: [{
        name: 'set',
        description: 'set your birthday',
        type: 1,
        options: [{
            name: "year",
            description: "year",
            type: "INTEGER",
            required: true
        },{
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
        }]
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
	async execute(interaction) {
        switch (interaction.options.data[0].name) {
            case "set":
                let args = interaction.options.data[0].options;
                let date = moment(new Date(args[0].value,args[1].value,args[2].value+1));
                sql.prepare("INSERT INTO users(user_id, birthday, birthday_channel) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET birthday=excluded.birthday, birthday_channel=excluded.birthday_channel;").run(interaction.user.id, date.format("YYYY-MM-DD"), interaction.channelId);
                return `\`Birthday set to ${date.format("MMMM D, YYYY")}\``;
            case "get":
                let data = sql.prepare("SELECT birthday FROM users WHERE user_id = ?").get(interaction.options.data[0].options[0].user.id);
                if (data === undefined) return "`No birthday found`";
                let now = moment();
                let birthdate = moment(data.birthday, "YYYY-MM-DD");
                let birthday = birthdate.clone();
                birthday.year(now.year());
                if (birthday.dayOfYear() < now.dayOfYear()) birthday.year(birthday.year()+1);
                return `${interaction.options.data[0].options[0].user} turns ${birthday.year()-birthdate.year()} ${birthday.fromNow()} on ${birthday.format("MMMM D")}`;
            default:
                break;
        }
        return "0";
    }
})