"use strict";
const fs = require('fs');
const rp = require('request-promise');
const Discord = require('discord.js');

let json = {}
fs.readFile("./data/pkmn.json", 'utf8', function (e, data) {
    if (e) {
        console.error("Pokemon data not found");
    } else {
        json = JSON.parse(data);
    }
})

const version = "20191116"

class Pokemon{
    constructor() {
    }

    static async search(term) {
        if (!isNaN(term)) {
            return await Pokemon.getPokemonByID(parseInt(term)-1);
        } else {
            term = term.toLowerCase().replace(/ /g,"-")
            let index = json.pokemon_species.findIndex(entry=>{
                return entry.name == term
            });
            if (index>-1) return await Pokemon.getPokemonByID(index);
            let entry = json.ability.find(entry=>{
                return entry.name == term
            });
            if (entry) return await Pokemon.getAbility(entry.name);
            entry = json.move.find(entry=>{
                return entry.name == term
            });
            if (entry) return await Pokemon.getMove(entry.name);
        }
        return "`Not found`"
    }
    
    static async getMove(name) {
        let move = json.move.find(entry=>{
            return entry.name == name
        });
        if (!move) return null;
        try {
            let data = fs.readFileSync(`data/pokemon/move/${move.name}.json`, {encoding: 'utf8'})
            let obj = JSON.parse(data);
            if (obj.version && obj.version == version) return obj;
        } catch (e) {
            let response = await rp({url: move.url, json: true});
            let name = response.names.find(entry=>{
                return entry.language.name == "en"
            }).name
            /*
            let effectentry = response.effect_entries.find(entry=>{
                return entry.language.name == "en"
            })
            let effect_text = {
                long: effectentry.effect,
                short: effectentry.short_effect
            }*/
            let desc = "";
            if (response.damage_class) desc += `Type: ${response.damage_class.name.charAt(0).toUpperCase() + response.damage_class.name.substring(1)}\n`
            if (response.power) desc += `Power: ${response.power}\n`
            if (response.accuracy) desc += `Accuracy: ${response.accuracy}\n`
            let effectentry = response.effect_entries.find(entry=>{
                return entry.language.name == "en"
            })
            let effect_text = {
                long: effectentry.effect,
                short: effectentry.short_effect
            }
            desc += `Short: ${effect_text.short.replace(/\$effect_chance/g,response.effect_chance)}\n\nLong: ${effect_text.long.replace(/\$effect_chance/g,response.effect_chance)}`
            let embed = {
                title: name,
                description: desc
            }
            let moveobj = {
                name,
                embed,
                version
            };
            fs.writeFileSync(`data/pokemon/move/${response.name}.json`,JSON.stringify(moveobj,null,4));
            return moveobj;
        }
    }
    
    static async getAbility(name) {
        let ability = json.ability.find(entry=>{
            return entry.name == name
        });
        if (!ability) return null;
        try {
            let data = fs.readFileSync(`data/pokemon/ability/${ability.name}.json`, {encoding: 'utf8'})
            return JSON.parse(data);
        } catch (e) {
            let response = await rp({url: ability.url, json: true});
            let name = response.names.find(entry=>{
                return entry.language.name == "en"
            }).name
            let effectentry = response.effect_entries.find(entry=>{
                return entry.language.name == "en"
            })
            let effect_text = {
                long: effectentry.effect,
                short: effectentry.short_effect
            }
            let embed = {
                title: name,
                description: `Short: ${effect_text.short}\n\nLong: ${effect_text.long}`
            }
            let abilityobj = {
                name,
                effect_text,
                embed
            };
            fs.writeFileSync(`data/pokemon/ability/${response.name}.json`,JSON.stringify(abilityobj,null,4));
            return abilityobj;
        }
    }
    
    static async getPokemonByID(id) {
        if (json.pokemon_species.length <= id) return "`Pokemon not found`"
        let name = json.pokemon_species[id].name;
        try {
            let data = fs.readFileSync(`data/pokemon/pokemon/${name}.json`, {encoding: 'utf8'})
            return createPokemonEmbed(data.embed, data.pokedex);
        } catch (e) {
            let speciesresponse = await rp({url: json.pokemon_species[id].url, json: true})
            let embed = {}
            //get name
            embed.title = speciesresponse.names.find(name=>{
                return name.language.name == "en"
            }).name + " #" + speciesresponse.id
            //fill pokedex
            let pokedex = speciesresponse.flavor_text_entries.filter(entry=>{
                return entry.language.name == "en"
            }).map(entry=>{
                return {
                    name: entry.version.name,
                    text: entry.flavor_text.replace(/\n/g," ").replace(/\f/g," ")
                }
            })
            let desc = "";
            //todo, varieties > 1
            //if (speciesresponse.varieties.length == 1) {
                let pokeresponse = await rp({url: speciesresponse.varieties[0].pokemon.url, json: true})
                //type
                desc += `Type: ${json.type[pokeresponse.types[0].type.name].name}`;
                if (pokeresponse.types.length>1) {
                    desc += ` / ${json.type[pokeresponse.types[1].type.name].name}`
                }
                desc += "\n";
                //abilities
                let abilitystrings = []
                for (let i=0;i<pokeresponse.abilities.length;i++) {
                    let thisability = pokeresponse.abilities[i]
                    let abilitystring = ""
                    let ability = await Pokemon.getAbility(thisability.ability.name)
                    abilitystring = ability.name;
                    if (thisability.is_hidden) abilitystring += " (Hidden)"
                    abilitystrings.push(abilitystring)
                }
                desc += `Abilities: ` + abilitystrings.join(", ")
                desc += "\n";
                //stats
                pokeresponse.stats.reverse().forEach(stat=>{
                    desc += `${json.stats[stat.stat.name]}: ${stat.base_stat}\n`
                })
                embed.image  = {url: `https://www.serebii.net/sunmoon/pokemon/${("00"+pokeresponse.id).slice(-3)}.png`};
            //}
            embed.description  = desc;
            let finalobj = {
                embed,
                pokedex
            }
            fs.writeFileSync(`data/pokemon/pokemon/${speciesresponse.name}.json`,JSON.stringify(finalobj,null,4));
            //fs.writeFileSync(`../data/pokemon/pokemon/${speciesresponse.name}.json`,JSON.stringify(finalobj,null,4));
            return createPokemonEmbed(embed, pokedex);
        }
    }
}



function createPokemonEmbed(embed, pokedex) {
    //embed.footer = pokedex[Math.floor(Math.random() * pokedex.length)].text;
    let dex = pokedex[Math.floor(Math.random() * pokedex.length)]
    embed.footer = {text: `${dex.text} -${json.pokedex_game_name[dex.name]}`};
    let rich = new Discord.MessageEmbed(embed).setColor("RANDOM");
    return rich
}

module.exports = Pokemon;