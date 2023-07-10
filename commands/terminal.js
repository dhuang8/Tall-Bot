"use strict";
import Command from '../util/Command.js';
import config from '../util/config.js';
import {execFile} from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default new Command({
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
            execFile(cmdpart[0], cmdpart.slice(1), {cwd: dirname(fileURLToPath(import.meta.url))}, (e, stdout, stderr) => {
                if (e) {
                    rej(e)
                } else {
                    res({content:`${stdout} ${stderr}`.slice(0,2000), code:true, split: true});
                }
            })
        }))
	},
});