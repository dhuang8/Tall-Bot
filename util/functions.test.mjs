import {EmbedBuilder} from 'discord.js';
import {request, validateEmbed, nextMultiple} from "./functions.js";

test('fetch', async () => {
    const response = await request({
        url: 'https://api.github.com/users/dhuang8/repos',
        json: true
    });
    expect(response.length).toBeGreaterThan(0);
});

test('validate embed', () => {
    let embed = new EmbedBuilder()
        .setTitle("title")
        .setDescription("w".repeat(5000))
    validateEmbed(embed);
    expect(embed.description).toBe("w".repeat(4093) + "...");
});

test('next multiple', () => {
    let i = nextMultiple(Date.now()/1000, 10*60*60, 24*60*60);
    expect(i % (24*60*60)).toBe(10*60*60);
})