"use strict";
import Command from '../util/Command.js';
import {MessageEmbed} from 'discord.js';
import fetch from 'node-fetch';
import sql from '../util/SQLite.js';
import Database from "better-sqlite3";

const gw2sql = new Database('data/gw2.sqlite');

function item_search(api_key, url, var_name, item_ids, is_character=false) {
    let res;
    if (!is_character) {
        res = fetch(url,{
            headers: {
                Authorization: `Bearer ${api_key}`
            }
        }).then(res => res.json())
    } else {
        res = url;
    };
    
    return res.then(items=>{
        if (items.bags) {
            let flatten = []
            items.bags.forEach(bag=>{
                if (bag) flatten = flatten.concat(bag.inventory);
            })
            if (items.equipment) flatten = flatten.concat(items.equipment);
            items = flatten;
        }
        items.forEach(item => {
            if (item == null) return;
            let found = item_ids.find(item_id=>{
                return item_id.id == item.id
            })
            item.count = item.count ?? 1;
            if (found && item.count > 0) {
                if (item.charges) var_name.push(`${item.count} ${found.name} (${item.charges})`);
                else var_name.push(`${item.count} ${found.name}`);
            }
        });
    })
}

let timers = [{
    name: "Drakkar",
    start: 65,
    end: 100
},{
    name: "Dragonstorm",
    start: 60,
    end: 80
},{
    name: "Echovald Forest",
    start: 30,
    end: 65
},{
    name: "Seitung Province",
    start: 90,
    end: 120
},{
    name: "New Kaineng City",
    start: 0,
    end: 30
},{
    name: "Dragon's End prep",
    start: 0,
    end: 60
},{
    name: "Dragon's End",
    start: 60,
    end: 120
}/*,{
    name: "Dragonfall",
    start: 90,
    end: 180
}*/]

export default new Command({
	name: 'gw2',
    description: 'use gw2 api',
    type: "CHAT_INPUT",
    options: [{
        name: 'key',
        description: 'set or get your key',
        type: "SUB_COMMAND_GROUP",
        options: [{
            name: "set",
            description: "set your key",
            type: "SUB_COMMAND",
            options:[{
                name: "gw2-api-key",
                description: "gw2 api key",
                type: "STRING",
                required: true                
            }]
        },{
            name: "get",
            description: "get your key",
            type: "SUB_COMMAND"
        }]
    },{
        name: 'item',
        type: 'STRING',
        description: 'search for an item',
        type: "SUB_COMMAND",
        options: [{
            name: "search",
            description: "item to search for",
            type: "STRING",
            required: true
        }]
    },{
        name: 'full-mat',
        type: 'STRING',
        description: 'checks for full material storage',
        type: "SUB_COMMAND",
        options: []
    },{
        name: 'daily',
        type: 'STRING',
        description: 'checks which dailies you\'ve done',
        type: "SUB_COMMAND",
        options: []
    },{
        name: 'timer',
        type: 'STRING',
        description: 'displays upcoming metas',
        type: "SUB_COMMAND",
        options: []
    }],
    ephemeral(interaction) {
        if (interaction.options.data[0].name == "key") return true;
        return false;
    },
	async execute(interaction) {
        let embed;
        let api_key;
        let time;
        if (interaction.options.data[0].name == "key") {
            switch (interaction.options.data[0].options[0].name) {
                case "set":
                    let key = interaction.options.data[0].options[0].options[0].value;
                    try {
                        let achievements = await fetch(`https://api.guildwars2.com/v2/account/achievements?ids=6385,6409`,{
                            headers: {
                                Authorization: `Bearer ${key}`
                            }
                        }).then(res => res.text());
                        let stmt = sql.prepare("INSERT INTO users(user_id,gw2key,gw2tracker) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET gw2key=excluded.gw2key, gw2tracker=excluded.gw2tracker;");
                        stmt.run(interaction.user.id, key, achievements);
                        return {content: "`API key set`", ephemeral: true};
                    } catch (e) {
                        return {content: "`Failed to add API key`", ephemeral: true};
                    }
                case "get":
                    let response = sql.prepare("SELECT gw2key FROM users WHERE user_id=?").get(interaction.user.id);
                    return {content: `\`${response.gw2key}\``, ephemeral: true};
            }
        } else if (interaction.options.data[0].name == "full-mat") {
            api_key = sql.prepare(`SELECT gw2key FROM users WHERE user_id = ?`).get(interaction.user.id).gw2key;
            let response = await fetch(`https://api.guildwars2.com/v2/account/materials`,{
                headers: {
                    Authorization: `Bearer ${api_key}`
                }
            }).then(res => res.json());
            embed = new MessageEmbed();
            let stmt = gw2sql.prepare(`SELECT name FROM items WHERE id = ?`);
            let desc2 = response.filter(item => {
                return item.count == 250;
            }).map(item=>{
                let row = stmt.get(item.id)
                return `${item.count} ${row.name}`
            });
            embed.setTitle("Full materials in storage");
            embed.setDescription(desc2.join("\n"))
            return embed;
        } else if (interaction.options.data[0].name == "item") {
            api_key = sql.prepare(`SELECT gw2key FROM users WHERE user_id = ?`).get(interaction.user.id).gw2key;
            let item_ids = gw2sql.prepare(`SELECT * FROM items WHERE name LIKE ?`).all(`%${interaction.options.data[0].options[0].value}%`);
            let shared_inventory = [];
            let bank = [];
            let materials = [];
            let character_inventory = {};
            let promises = [
                item_search(api_key, `https://api.guildwars2.com/v2/account/inventory`, shared_inventory, item_ids),
                item_search(api_key, `https://api.guildwars2.com/v2/account/bank`, bank, item_ids),
                item_search(api_key, `https://api.guildwars2.com/v2/account/materials`, materials, item_ids),
            ]
            //characters
            /*
            await fetch(`https://api.guildwars2.com/v2/characters`,{
                headers: {
                    Authorization: `Bearer ${api_key}`
                }
            }).then(res => res.json()).then(characters=>{
                characters.forEach(character=>{
                    character_inventory[character] = []
                    promises.push(item_search(api_key, `https://api.guildwars2.com/v2/characters/${character}/inventory`, character_inventory[character], item_ids, true))
                })
            })*/

            
            await fetch(`https://api.guildwars2.com/v2/characters?ids=all`,{
                headers: {
                    Authorization: `Bearer ${api_key}`
                }
            }).then(res => res.json()).then(characters=>{
                characters.forEach(character=>{
                    character_inventory[character.name] = []
                    promises.push(item_search(api_key, new Promise(resolve=>resolve(character)), character_inventory[character.name], item_ids, true))
                })
            })
            await Promise.all(promises);
            embed = new MessageEmbed();
            if (bank.length > 0) embed.addField("Bank", bank.join("\n"));
            if (materials.length > 0) embed.addField("Material Storage", materials.join("\n"));
            Object.keys(character_inventory).forEach(character=>{
                if (character_inventory[character].length > 0) embed.addField(character, character_inventory[character].join("\n"));
            });
            embed.setTitle(`Item search - ${interaction.options.data[0].options[0].value}`)
            return embed;
        } else if (interaction.options.data[0].name == "daily") {
            let user = sql.prepare(`SELECT gw2key,gw2tracker FROM users WHERE user_id = ?`).get(interaction.user.id);
            api_key = user.gw2key;
            let eventsdone = [];
            let dailylist = ["Drakkar", "Verdant Brink", "Auric Basin", "Tangled Depths", "Dragon Stand", "Seitung Province", "New Kaineng City"]
            if (api_key != null) {
                try {
                    let achievements = fetch(`https://api.guildwars2.com/v2/account/achievements?ids=6385,6409`,{
                        headers: {
                            Authorization: `Bearer ${api_key}`
                        }
                    }).then(res => res.json());
                    let daily = fetch(`https://api.guildwars2.com/v2/achievements/daily`,{
                        headers: {
                            Authorization: `Bearer ${api_key}`
                        }
                    }).then(res => res.json());
                    let worldboss = fetch(`https://api.guildwars2.com/v2/account/worldbosses`,{
                        headers: {
                            Authorization: `Bearer ${api_key}`
                        }
                    }).then(res => res.json());
                    let mapchest = fetch(`https://api.guildwars2.com/v2/account/mapchests`,{
                        headers: {
                            Authorization: `Bearer ${api_key}`
                        }
                    }).then(res => res.json());
                    achievements = await achievements;
                    daily = await daily;
                    worldboss = await worldboss;
                    mapchest = await mapchest;
                    
                    if (mapchest.indexOf("verdant_brink_heros_choice_chest") > -1) eventsdone.push("Verdant Brink");
                    if (mapchest.indexOf("tangled_depths_heros_choice_chest") > -1) eventsdone.push("Tangled Depths");
                    if (mapchest.indexOf("auric_basin_heros_choice_chest") > -1) eventsdone.push("Auric Basin");
                    if (mapchest.indexOf("dragons_stand_heros_choice_chest") > -1) eventsdone.push("Dragon Stand");
                    if (mapchest.indexOf("crystal_oasis_heros_choice_chest") > -1) eventsdone.push("Crystal Oasis");
                    if (mapchest.indexOf("elon_riverlands_heros_choice_chest") > -1) eventsdone.push("Elon Riverlands");
                    if (mapchest.indexOf("the_desolation_heros_choice_chest") > -1) eventsdone.push("Desolation");
                    if (mapchest.indexOf("domain_of_vabbi_heros_choice_chest") > -1) eventsdone.push("Domain of Vabbi");
                    if (worldboss.indexOf("drakkar") > -1) eventsdone.push("Drakkar");

                    let lastachievements = JSON.parse(user.gw2tracker);
                    let lastkaineng = lastachievements.find(achievement => {
                        return achievement.id == 6385
                    });
                    let curkaineng = achievements.find(achievement => {
                        return achievement.id == 6385
                    });
                    if (lastkaineng?.current != curkaineng?.current) eventsdone.push("New Kaineng City");
                    let lastseitung = lastachievements.find(achievement => {
                        return achievement.id == 6409
                    });
                    let curseitung = achievements.find(achievement => {
                        return achievement.id == 6409
                    });
                    if (lastseitung?.current != curseitung?.current) eventsdone.push("Seitung Province");
                    embed = new MessageEmbed();
                    embed.setTitle("Dailies")
                    let desc = dailylist.map(daily=>{
                        return (eventsdone.indexOf(daily) > -1) ? `~~${daily}~~` : daily
                    })
                    embed.setDescription(desc.join("\n"));
                    return embed;
                } catch (e) {
                    console.log(e);
                    return "`Error`";
                }
            }
            return "`Missing API Key";
        } else if (interaction.options.data[0].name == "timer") {
            time = (new Date()).valueOf()/1000/60 % 120;
            embed = new MessageEmbed();

            let progresstext = timers.map(timer=>{
                if ((time+120) < timer.end) {
                    timer.start -= 120;
                    timer.end -= 120;
                } else if (timer.end < time) {
                    timer.start += 120;
                    timer.end += 120;
                }
                return timer;
            }).filter(timer=>{
                return timer.start < time;
            }).sort((a,b)=>{
                return a.end - b.end;
            }).map(timer=>{
                let line = `**${timer.name}** ending in ${Math.round(timer.end-time)} min`;
                return line;
            }).join("\n");
            embed.addField("**__In progress__**", progresstext)

            let upcomingtext = timers.map(timer=>{
                if (timer.start < time) {
                    timer.start += 120;
                    timer.end += 120;
                }
                return timer;
            }).sort((a,b)=>{
                return a.start - b.start;
            }).map(timer=>{
                let line = `**${timer.name}** starting in ${Math.round(timer.start-time)} min`
                return line;
            }).join("\n");
            embed.addField("**__Upcoming__**", upcomingtext)
            embed.setTitle(`Timer`);
            let message = await interaction.channel.send({embeds: [embed]});
            let stmt = sql.prepare("INSERT INTO channels(channel_id,gw2timer) VALUES (?,?) ON CONFLICT(channel_id) DO UPDATE SET gw2timer=excluded.gw2timer;");
            stmt.run(message.channel.id, message.id);
            return "set";
        }
    }
})