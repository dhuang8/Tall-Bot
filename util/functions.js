import {Embed} from 'discord.js';

export function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

export async function request(param) {
    if (typeof param == "string") {
        param = {
            url: param
        }
    }
    return fetch(param.url, param).then(response => {
        if (response.headers.get('content-type')?.includes('application/json')) {
            return response.json();
        }
        return response.text();
    });
}

export function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}

export function htmldecode(a) {
    a = f.replaceAll(a, "&#39;", "'")
    a = f.replaceAll(a, "&amp;", "&")
    a = f.replaceAll(a, "&gt;", ">")
    a = f.replaceAll(a, "&lt;", "<")
    a = f.replaceAll(a, "&quote;", '"')
    a = f.replaceAll(a, "&apos;", "'")
    return a;
}

    /**
     * slices strings to fit the MessageEmbed limits
     * https://discordjs.guide/popular-topics/embeds.html#embed-limits
     * @param {Embed} embed Discord embed
     * @return new embed
     */
export function validateEmbed(embed) {
    if (embed.title?.length > 256) embed.setTitle(`${embed.title.slice(0,253)}...`);
    if (embed.description?.length > 4096) embed.setDescription(`${embed.description.slice(0,4093)}...`);
    let new_fields = embed.fields?.slice(0,25).map(field => {
        return {
            name: field.name.length > 256 ? field.name.slice(0,253) + "..." : field.name,
            value: field.value.length > 1024 ? field.value.slice(0,1021) + "..." : field.value
        }
    })
    embed.setFields(new_fields);
    if (embed.footer?.length > 2048) embed.setFooter(`${embed.footer.slice(0,2045)}...`);
    if (embed.author?.length > 256) embed.setAuthor(`${embed.author.slice(0,253)}...`);
    function checkTotal() {
        let total = embed.title?.length + embed.description?.length + embed.footer?.text + embed.author?.name + 
            embed.fields?.reduce(
                (prev, curr) => prev + curr.name.length + curr.value.length, 0
            )
    }
    //TODO: slice only the remaining amount
    while (checkTotal() > 6000) {
        if (embed.fields?.length > 0) embed.setFields(embed.fields.pop())
        else if (embed.footer?.length > 0) embed.setFooter("")
        else if (embed.author?.name.length > 0) embed.setAuthor("")
        else if (embed.description?.length > 0) embed.setDescription("")
    }
}
