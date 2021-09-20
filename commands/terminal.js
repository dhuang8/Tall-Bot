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
    options: [],
	async execute(interaction) {
        return (new Promise((res, rej) => {
            let cmdpart = args[1].split(" ")
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