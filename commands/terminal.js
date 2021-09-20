"use strict";
const Command = require('../util/Command');
const config = require('../util/config');
const execFile = require('child_process').execFile;

module.exports = new Command({
	name: 'terminal',
    description: 'terminal input',
    guild: config.guild_id,
    type: "CHAT_INPUT",
    admin: true,
    options: [{
        name: 'terminal-command',
        type: 'STRING',
        description: 'command to run',
        required: true,
    }],
	async execute(interaction) {
        return (new Promise((res, rej) => {
            let cmdpart = interaction.options.data[0].value.split(" ")
            execFile(cmdpart[0], cmdpart.slice(1), {cwd: __dirname}, (e, stdout, stderr) => {
                if (e) {
                    rej(e)
                } else {
                    res([`${stdout} ${stderr}`, {code:true, split: true}]);
                }
            })
        }))
	},
});