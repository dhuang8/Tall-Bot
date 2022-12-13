import {MessageEmbed} from 'discord.js';
import f from "./functions.js";

test('validate embed', () => {
    let embed = new MessageEmbed()
        .setTitle("title")
        .setDescription("w".repeat(5000))
    f.validateEmbed(embed);
    expect(embed.description).toBe("w".repeat(4093) + "...");
});

test('create interactionOptions', () => {
    let options = f.createInteractionOptions(["key", "set", "54BA92FB-DE02-9543-B592-A7ABC054A4ABF9182324-CDEC-47C6-A052-55D7B059EE4C"],
        "113060802252054528");
    let obj = {
        options: {
            data: [{
                name: "key",
                value: "key",
                options: [{
                    name: "set",
                    value: "set",
                    options: [{
                        name: "54BA92FB-DE02-9543-B592-A7ABC054A4ABF9182324-CDEC-47C6-A052-55D7B059EE4C",
                        value: "54BA92FB-DE02-9543-B592-A7ABC054A4ABF9182324-CDEC-47C6-A052-55D7B059EE4C"
                    }]
                }]
            }]
        },
        user: {
            id: "113060802252054528"
        }
    }
    expect(options).toEqual(obj);
});