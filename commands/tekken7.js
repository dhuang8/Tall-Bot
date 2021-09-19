"use strict";
const Command = require('../util/Command');
const fs = require('fs');
const MessageResponse = require('../util/MessageResponse');
const {MessageEmbed} = require('discord.js');

let t7;
try {
    t7 = JSON.parse(fs.readFileSync("./data/t7.json", 'utf8'));
} catch (e) {
    console.error(e);
    console.error("Tekken 7 data not found");
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

function simplifyMove(s) {
    s = s.toLowerCase();
    s = replaceAll(s, " ", "");
    s = replaceAll(s, "\\/", "");
    s = replaceAll(s, ",", "");
    s = replaceAll(s, ":", "");
    s = replaceAll(s, "~", "");
    s = s.replace(/\*/g, "");
    s = replaceAll(s, "(\\D)\\+(\\d)", "$1$2");
    s = replaceAll(s, "(\\D)\\+(\\D)", "$1$2");
    if (s.indexOf("run") == 0) s = "fff" + s.slice(3);
    if (s.indexOf("running") == 0) s = "fff" + s.slice(6);
    if (s.indexOf("wr") == 0) s = "fff" + s.slice(2);
    if (s.indexOf("cd") == 0) s = "fnddf" + s.slice(2);
    if (s.indexOf("rds") == 0) s = "bt" + s.slice(3);
    if (s.indexOf("qcf") == 0) s = "ddff" + s.slice(3);
    if (s.indexOf("qcb") == 0) s = "ddbb" + s.slice(3);
    if (s.indexOf("hcf") == 0) s = "bdbddff" + s.slice(3);
    if (s.indexOf("hcb") == 0) s = "fdfddbb" + s.slice(3);
    return s;
}
function simplifyfield(s) {
    s = s.toLowerCase();
    s = s.trim();
    s = replaceAll(s, " ", "");
    return s;
}
function simplifyname(s) {
    s = s.toLowerCase();
    s = s.trim();
    s = s.replace(/[ \\-]/g, "");
    return s;
}

function parseCharList(charfound, move_string, channel_id) {
    if (charfound.length == 1) return getMove(charfound[0], move_string, channel_id);
    else if (charfound.length > 1) {
        let char_response = charfound.map(char=>{
            return {
                title: t7[char].name,
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
    char = t7[char];
    let simplifiedinput = simplifyMove(move);
    if (char.moves[simplifiedinput]) {
        poslist = char.moves[simplifiedinput];
    } else {
        function getMoveList(conditions) {
            let movelist = []
            //for each {moveshorthand:[array of moves]}
            Object.entries(char.moves).forEach((entry) => {
                //for each move {command, name, etc}
                entry[1].forEach((moveobj) => {
                    //check if move satisfies all conditions
                    let match = conditions.every((cur) => {
                        //condition has to return true for at least 1 field:value
                        return Object.entries(moveobj).some((field) => {
                            //field[0] is the field name and field[1] is the field value
                            //ignore gfycat and cell columns during comparison
                            if (field[0] !== "gfycat" && field[0] !== "cell") {
                                return cur(field[0], field[1]);
                            }
                            return false;
                        })

                    })

                    if (match) {
                        movelist.push(moveobj)
                    };

                })
            })
            return movelist;
        }

        //returns a function that returns true if given field matches current field and satisfies value comparison
        function parseConditionArgs(userfield, comparison, uservalue) {

            //compares the field value to the given value
            function comparefunc(value, comparison, valuestring, isnumfield) {
                if (isnumfield) {
                    if (comparison == "<") {
                        return value < valuestring;
                    } else if (comparison == ">") {
                        return value > valuestring;
                    } else if (comparison == "=" || comparison == ":") {
                        return value == valuestring;
                    } else if (comparison == "<=") {
                        return value <= valuestring;
                    } else if (comparison == ">=") {
                        return value >= valuestring;
                    }
                    return false;
                }

                if (comparison == "<" || comparison == "<=") {
                    return value.endsWith(valuestring);
                } else if (comparison == "=") {
                    return value == valuestring;
                } else if (comparison == ">" || comparison == ">=") {
                    return value.startsWith(valuestring);
                } else if (comparison == ":") {
                    return value.indexOf(valuestring) > -1;
                }
            }

            function checkregex(thisvalue, comparison, uservalue) {
                if (comparison == "=") {
                    let reg = new RegExp("^" + thisvalue + "$");
                    if (reg.test(uservalue)) return true;
                    return false
                }
                return false;
            }

            return (thisfield, thisvalue) => {
                thisfield = simplifyfield(thisfield);
                userfield = simplifyfield(userfield);
                //special case of comparing a command value to the regexp value of the move

                if (thisfield == "regexp" && "command".indexOf(userfield) > -1) {
                    uservalue = simplifyMove(uservalue);
                    let check = checkregex(thisvalue, comparison, uservalue);
                    return check;
                }


                if (thisfield.indexOf(userfield) !== 0) return false;
                let numfields = ["damage", "startupframe", "blockframe", "hitframe", "counterhitframe", "post-techframes", "speed"];
                let isnumfield = false;
                let tmpthisvalue;
                let tmpuservalue;
                if (numfields.indexOf(thisfield) > -1 && !isNaN(uservalue)) {
                    isnumfield = true;
                    tmpthisvalue = parseInt(thisvalue);
                    tmpuservalue = parseInt(uservalue);
                } else {
                    if (thisfield.indexOf("command") == 0) {
                        tmpthisvalue = simplifyMove(thisvalue);
                        tmpuservalue = simplifyMove(uservalue);
                    } else {
                        tmpthisvalue = simplifyfield(thisvalue);
                        tmpuservalue = simplifyfield(uservalue);
                    }
                }
                if (comparefunc(tmpthisvalue, comparison, tmpuservalue, isnumfield)) {
                    return true;
                }
                return false;
            }
        }

        let conditions = [(arg1, arg2) => {
            return parseConditionArgs("command", "=", move)(arg1, arg2);
        }]
        poslist = getMoveList(conditions);

        if (poslist.length < 1) {
            let conditionstring = move.split("&");
            conditions = conditionstring.map((cur) => {
                let b;
                if (b = /^(.+?)([<>]=|[:=<>])(.+)$/.exec(cur)) {
                    return parseConditionArgs(b[1], b[2], b[3]);
                } else if (b = /^i(\d+)$/i.exec(cur)) {
                    return parseConditionArgs("startupframe", ":", b[1]);
                } else {
                    return (arg1, arg2) => {
                        let defaultfields = ["command","name","notes","rbnorway","engrish"];
                        let found = defaultfields.find(field => {
                            return parseConditionArgs(field, ":", cur)(arg1, arg2)
                        })
                        if (!found && isNaN(cur)){
                            let otherfields = ["startup","hit","counter"];
                            found = otherfields.find(field => {
                                return parseConditionArgs(field, ":", cur)(arg1, arg2)
                            })
                        }
                        return found;
                    }
                }
            })
            poslist = getMoveList(conditions);
        }
    }

    if (poslist.length === 1) {
        return createMoveMessage(char, poslist[0]);
    } else if (poslist.length > 1) {
        let data_array = poslist.map((v, i) => {
            return {
                title: v.Command,
                response: () => createMoveMessage(char, v)
            }
        })
        let rich = MessageResponse.addList(channel_id, data_array);
        rich.setTitle("Multiple moves found");
        return rich;
    } else {
        let rich = new MessageEmbed();
        rich.setTitle(char.name)
        rich.setDescription(`Move not found\n**[Help improve the frame data here](https://docs.google.com/spreadsheets/d/${config.t7sheetid}#gid=${char.sheet_id})**\n\n**[or search rbnorway](${char.link})**`)
        return rich;
    }
}

function createMoveMessage(char, move) {
    let rich = new MessageEmbed();
    rich.setTitle(char.name)
    let mes = Object.keys(move).filter((v) => {
        return v != "gfycat" && v != "regexp" && v != "cell";
    }).map((key) => {
        return `**${key}**: ${move[key]}`
    }).join("\n");
    if (move.cell) {
        //mes += `\n**[Edit frame data](https://docs.google.com/spreadsheets/d/${config.t7sheetid}#gid=${char.sheet_id}&range=${move.cell})**`
    }
    rich.setDescription(mes);
    if (move.gfycat) {
        let gfycatid = /.+\/(.+?)$/.exec(move.gfycat);
        rich.setImage(`https://thumbs.gfycat.com/${gfycatid[1]}-size_restricted.gif`);
    }
    return rich;
    /*
    let gfycatlink = move.gfycat || "";
    let mes = `>>> __**${char.name}**__\n`
    mes += Object.keys(move).filter((v) => {
        return v != "gfycat" && v != "regexp" && v != "cell";
    }).map((key) => {
        return `**${key}**: ${move[key]}`
    }).join("\n");
    if (move.cell) {
        mes += `\n**Edit frame data:** <https://docs.google.com/spreadsheets/d/${config.t7sheetid}#gid=${char.sheet_id}&range=${move.cell}>`
    }
    mes += "\n" + gfycatlink;
    return mes;
    */
}

module.exports = new Command({
	name: 'tekken7',
    description: 'returns Tekken 7 frame data',
    type: "CHAT_INPUT",
    options: [{
        name: 'character',
        type: 'STRING',
        description: 'character name',
        required: true
    },{
        name: 'move-search',
        type: 'STRING',
        description: 'term to search',
        required: true,
    }],
	async execute(interaction) {
        //find character
        let charfound = [];
        let charfoundmid = [];
        let nameinput = simplifyname(interaction.options.data[0].value);
        let move_string = interaction.options.data[1].value || " ";
        if (nameinput == "dj") nameinput = "devil"
        else if (nameinput == "djin") nameinput = "devil"
        else if (nameinput == "dvj") nameinput = "devil"
        else if (nameinput == "panda") nameinput = "kuma"
        else if (nameinput == "ak") nameinput = "armor"

        //special move conversions
        if (move_string.toLowerCase() == "rd") move_string = "rage drive"
        else if (move_string.toLowerCase() == "ra") move_string = "rage art"

        Object.keys(t7).forEach((v, i) => {
            let charindex = simplifyname(t7[v].name).indexOf(nameinput);
            if (charindex === 0) charfound.push(v);
            else if (charindex > 0) charfoundmid.push(v);
        })

        let msg = parseCharList(charfound, move_string, interaction.channelID) || parseCharList(charfoundmid, move_string, interaction.channelID) || "`Character not found`";
        return msg;
    }
})