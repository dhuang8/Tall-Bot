"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fs = require('fs');
const {MessageEmbed} = require('discord.js');

function simplifyName(s) {
    s = s.toLowerCase();
    s = replaceAll(s, " ", "");
    return s.trim();
}

function simplifyMove(s) {
    s = s.toLowerCase();
    s = replaceAll(s, " ", "");
    s = replaceAll(s, "forward", "f");
    s = replaceAll(s, "back", "b");
    s = replaceAll(s, "up", "u");
    s = replaceAll(s, "down", "d");
    s = replaceAll(s, "neutral", "n");
    return s.trim();
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

function parseCharList(charfound, move_string, channel_id) {
    if (charfound.length == 1) return getMove(charfound[0], move_string, channel_id);
    else if (charfound.length > 1) {
        let char_response = charfound.map(char=>{
            return {
                title: char.name,
                response: ()=>{
                    return getMove(char,move_string, channel_id);
                }
            }
        })
        let rich = MessageResponse.addList(channel_id, char_response);
        rich.setTitle("Choose character");
        return rich;
    }
    return false;
}        

function getMove(char, move, channel_id) {
    let poslist = [];
    let simplifiedinput = simplifyMove(move);
    char.moves.forEach(move=>{
        if (!move.movename) return;
        //console.log(simplifyMove(move.movename),simplifiedinput)
        if (simplifyMove(move.movename) == simplifiedinput) {
            poslist.push(move);
        } else if (simplifyMove(move.movename).indexOf(simplifiedinput)>-1) {
            poslist.push(move)
        }
    })
    if (poslist.length == 1) return createMoveMessage(char, poslist[0]);
    else if (poslist.length > 1) {
        let data_array = poslist.map((v, i) => {
            return {
                title: v.movename,
                response: () => createMoveMessage(char, v)
            }
        })
        let rich = MessageResponse.addList(channel_id, data_array);
        rich.setTitle("Multiple moves found")
        return rich;
    }
    return "`Move not found`";
}

function createMoveMessage(char, move) {
    let rich = new MessageEmbed();
    rich.setTitle(char.name)
    let mes = Object.keys(move).filter(key=>{
        if (key == "gifs" || key == "hitbox") return false;
        if (move[key] == "" || move[key] == "--") return false
        return true;
    }).map((key) => {
        return `**${key}**: ${move[key]}`
    }).join("\n");
    rich.setDescription(mes);
    if (move.gifs!=null && move.gifs.length > 0) {
        rich.setImage(move.gifs[0]);
    }
    rich.setFooter("Data from ultimateframedata.com")
    return rich;
}

let ssbu;
try {
    ssbu = JSON.parse(fs.readFileSync("./data/ssbu.json", 'utf8'));
} catch (e) {
    console.error(e);
    console.error("SSBU data not found");
}

module.exports = new Command({
	name: 'ssbu',
    description: 'returns Super Smash Bros Ult frame data',
    type: "CHAT_INPUT",
    options: [{
        name: 'character',
        type: 'STRING',
        description: 'character',
        required: true,
    },{
        name: 'move-name',
        type: 'STRING',
        description: 'move name',
        required: true,
    }],
	async execute(interaction) {
        //find character
        let charfound = [];
        let charfoundmid = [];
        let nameinput = simplifyName(interaction.options.data[0].value);
        let move_string = interaction.options.data[1].value || " ";

        ssbu.forEach(char=>{
            if (simplifyName(char.name) == nameinput) {
                charfound.push(char);
            } else if (simplifyName(char.name).indexOf(nameinput)>-1) {
                charfoundmid.push(char)
            }
        })

        let msg = parseCharList(charfound, move_string, interaction.channelId) || parseCharList(charfoundmid, move_string, interaction.channelId) || "`Character not found`";
        return msg;
    }
})