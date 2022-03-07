"use strict";
import Command from '../util/Command.js';
import MessageResponse from '../util/MessageResponse.js';
import fs from 'fs';
import {MessageEmbed} from 'discord.js';
import fetch from 'node-fetch';

let pkmn;
try {
    pkmn = JSON.parse(fs.readFileSync("./data/pkmn.json", 'utf8'));
} catch (e) {
    console.error(e);
    console.error("Pokemon data not found");
}


async function search(term) {
    if (!isNaN(term)) {
        return await getPokemonByID(parseInt(term)-1);
    } else {
        term = term.toLowerCase().replace(/ /g,"-")
        let index = pkmn.pokemon_species.findIndex(entry=>{
            return entry.name == term
        });
        if (index>-1) return await getPokemonByID(index);
        let entry = pkmn.ability.find(entry=>{
            return entry.name == term
        });
        if (entry) return await getAbility(entry.name);
        entry = pkmn.move.find(entry=>{
            return entry.name == term
        });
        if (entry) return await getMove(entry.name);
    }
    return "`Not found`"
}

async function getMove(name) {
    let move = pkmn.move.find(entry=>{
        return entry.name == name
    });
    if (!move) return null;
    try {
        let data = fs.readFileSync(`../data/pokemon/move/${move.name}.json`, {encoding: 'utf8'})
        let obj = JSON.parse(data);
        return obj;
        //if (obj.version && obj.version == version) return obj;
    } catch (e) {
        let response = await fetch(move.url).then(res => res.json());
        let name = response.names.find(entry=>{
            return entry.language.name == "en"
        }).name
        let desc = "";
        if (response.damage_class) desc += `Class: ${response.damage_class.name.charAt(0).toUpperCase() + response.damage_class.name.substring(1)}\n`
        if (response.type?.name) desc += `Type: ${response.type.name.charAt(0).toUpperCase() + response.type.name.substring(1)}\n`
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
            embed
        };
        fs.writeFileSync(`./data/pokemon/move/${response.name}.json`,JSON.stringify(moveobj,null,4));
        return moveobj;
    }
}

async function getAbility(name) {
    let ability = pkmn.ability.find(entry=>{
        return entry.name == name
    });
    if (!ability) return null;
    try {
        let data = fs.readFileSync(`./data/pokemon/ability/${ability.name}.json`, {encoding: 'utf8'})
        data = JSON.parse(data);
        return data;
    } catch (e) {
        let response = await fetch(ability.url).then(res => res.json());
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
        fs.writeFileSync(`./data/pokemon/ability/${response.name}.json`,JSON.stringify(abilityobj,null,4));
        return abilityobj;
    }
}

async function getPokemonByID(id) {
    if (pkmn.pokemon_species.length <= id) return "`Pokemon not found`"
    let name = pkmn.pokemon_species[id].name;
    try {
        let data = fs.readFileSync(`./data/pokemon/pokemon/${name}.json`, {encoding: 'utf8'})
        return createPokemonEmbed(data.embed, data.pokedex);
    } catch (e) {
        let speciesresponse = await fetch(pkmn.pokemon_species[id].url).then(res => res.json());
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
        let pokeresponse = await fetch(speciesresponse.varieties[0].pokemon.url).then(res => res.json());
        //type
        desc += `Type: ${pkmn.type[pokeresponse.types[0].type.name].name}`;
        if (pokeresponse.types.length>1) {
            desc += ` / ${pkmn.type[pokeresponse.types[1].type.name].name}`
        }
        desc += "\n";
        //abilities
        let abilitystrings = []
        for (let i=0;i<pokeresponse.abilities.length;i++) {
            let thisability = pokeresponse.abilities[i]
            let abilitystring = ""
            let ability = await getAbility(thisability.ability.name)
            abilitystring = ability.name;
            if (thisability.is_hidden) abilitystring += " (Hidden)"
            abilitystrings.push(abilitystring)
        }
        desc += `Abilities: ` + abilitystrings.join(", ")
        desc += "\n";
        //stats
        pokeresponse.stats.reverse().forEach(stat=>{
            desc += `${pkmn.stats[stat.stat.name]}: ${stat.base_stat}\n`
        })
        embed.image  = {url: `https://www.serebii.net/sunmoon/pokemon/${("00"+pokeresponse.id).slice(-3)}.png`};
        //}
        embed.description  = desc;
        let finalobj = {
            embed,
            pokedex
        }
        fs.writeFileSync(`./data/pokemon/pokemon/${speciesresponse.name}.json`,JSON.stringify(finalobj,null,4));
        //fs.writeFileSync(`../data/pokemon/pokemon/${speciesresponse.name}.json`,JSON.stringify(finalobj,null,4));
        return createPokemonEmbed(embed, pokedex);
    }
}

function createPokemonEmbed(embed, pokedex) {
    //embed.footer = pokedex[Math.floor(Math.random() * pokedex.length)].text;
    let dex = pokedex[Math.floor(Math.random() * pokedex.length)]
    embed.footer = {text: `${dex.text} -${pkmn.pokedex_game_name[dex.name]}`};
    let rich = new MessageEmbed(embed);
    return rich
}

export default new Command({
	name: 'pokemon',
    description: 'returns Pokemon, moves, etc',
    type: "CHAT_INPUT",
    options: [{
        name: 'pokedex',
        description: 'pokedex id',
        type: 1,
        options: [{
            name: "id",
            description: "pokedex number",
            type: "INTEGER",
            required: true
        }]
    },{
        name: "pokemon",
        description: "pokemon name",
        type: 1,
        options: [{
            name: "name",
            description: "pokemon name",
            type: "STRING",
            required: true
        }]
    },{
        name: "ability",
        description: "ability name",
        type: 1,
        options: [{
            name: "name",
            description: "ability name",
            type: "STRING",
            required: true
        }]
    },{
        name: 'move',
        description: 'move name',
        type: 1,
        options: [{
            name: "name",
            description: "move name",
            type: "STRING",
            required: true
        }]
    }],
	async execute(interaction) {
        let response;
        switch (interaction.options.data[0].name) {
            case "pokedex":
                return await getPokemonByID(interaction.options.data[0].options[0].value-1);
            case "pokemon":
                let term = interaction.options.data[0].options[0].value.toLowerCase().replace(/ /g,"-")
                let index = pkmn.pokemon_species.findIndex(entry=>{
                    return entry.name == term
                });
                response = await getPokemonByID(index);
                return await getPokemonByID(index);
            case "ability":
                let term2 = interaction.options.data[0].options[0].value.toLowerCase().replace(/ /g,"-")
                response = (await getAbility(term2))?.embed;
                response = response?await new MessageEmbed(response):null;
            case "move":
                let term3 = interaction.options.data[0].options[0].value.toLowerCase().replace(/ /g,"-")
                response = (await getMove(term3)).embed;
                response = response?await new MessageEmbed(response):null;
        }
        return response;
        //return await search(interaction.options.data[0].value)
    }
})