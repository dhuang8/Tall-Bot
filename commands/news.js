"use strict";
const Command = require('../util/Command');
const MessageResponse = require('../util/MessageResponse');
const fs = require('fs');
const {MessageEmbed} = require('discord.js');
const fetch = require('node-fetch');
const { CanvasRenderService } = require('chartjs-node-canvas');
const moment = require('moment-timezone');
const config = require('../util/config');
const {escapeMarkdownText} = require('../util/functions');
var HttpsProxyAgent = require('https-proxy-agent');


moment.tz.setDefault("America/New_York");

let test = `The source of some apples, eggs and radishes at farmers’ markets in New York City, according to signs, can be something of a head-scratcher. Isn’t Red Hook in industrial Brooklyn?

Far from it. The produce hails from a Dutchess County town about 100 miles north that scatters just 11,000 people across 36 square miles — which means lots of extra room for growing fruits and vegetables.


NEW YORK

Red Hook

DUTCHESS

COUNTY

COLUMBIA

COUNTY

N.Y.

New

York

City

Tivoli

Heermance

Farm

Tivoli Bay Wildlife

Management Area

Greig Farm

Bard College

TOWN OF RED HOOK

Rose Hill

Farm

Village of

Red Hook

Hudson R.

DUTCHESS

COUNTY

Tradition at Red Hook

2 MILES

By The New York Times
For some recent émigrés, differentiating between the two Red Hooks is easy. “I feel more optimistic about connecting with people in Red Hook than I ever did in Brooklyn,” said Luke Schneiders, 39, a social worker who relocated this spring after a decade of renting in Williamsburg, Bushwick and Greenpoint, where his railroad-style apartment had a sink-less bathroom. “There’s a much higher quality of life than I’m used to.”

That sense of community seems hard won. For years, Mr. Schneiders and his wife, Karen Alsen, 35, the education director for an environmental nonprofit, would take weekend “reconnaissance missions” to scout potential future homes. Then 2020 hit, bringing two events that put a plan into action. One, obviously, was Covid-19, which allowed Ms. Alsen to work remotely. The other, last June, was the birth of a son.

Quickly, the couple whittled their list to two finalists: northern Vermont and the mid-Hudson Valley. The latter won out because it was closer to family and work.

In May, despite intense competition, the couple snagged a three-bedroom house with three bathrooms and radiant-heated floors on more than seven acres, for $559,000. There’s also a barn, “which makes me feel like I need to take up a hobby,” Mr. Schneiders joked.

If that pastime involves agriculture, he’ll be in good company. Much of Red Hook’s gentle terrain is checkered with farms, especially between Routes 9 and 9G, where the pairing of pastures and Catskills can seem worthy of a painting.

Editors’ Picks

Making Discovery, Not Distance, Travel’s Point

‘Pessoa’ Is the Definitive and Sublime Life of a Genius and His Many Alternate Selves

Want to Buy a PlayStation 5? Befriend a Bot.
Continue reading the main story

ImageLittle Pickles is a nearly-seven-year-old toy store and candy shop on North Broadway in Red Hook. A longtime resident described the town as “a little bit Mayberry.”
Little Pickles is a nearly-seven-year-old toy store and candy shop on North Broadway in Red Hook. A longtime resident described the town as “a little bit Mayberry.”Credit...Tony Cenicola/The New York Times
All told, crops sprout from more than 200 properties, said Cheryl Kaszluga, the town’s tax assessor. Some farms own multiple parcels, and the number of working farms in Red Hook is substantial, with about 70 large ones, Ms. Kaszluga said.

Newcomers also help keep the scene rustic. Under a 2006 law, buyers fork over a tax equal to 2 percent of the portion of a home purchase that exceeds the annual median for the town ($330,000 this year), to fund conservation. The money goes toward creating easements, paying farmers not to build housing on their land. As of 2019, officials said, deed restrictions by the town and not-for-profits have protected farmland representing about a quarter of the entire town, or 5,700 acres.

Still, Red Hook doesn’t feel like a museum piece. The aptly named Old Farm Road is the site of a 52-acre, 102-unit development called Tradition at Red Hook, from Kirchhoff Development and Bonura Hospitality Group, that is among the largest new housing projects in the area in years. In many ways, it breaks with tradition. Unlike the 1960s subdivision on next-door Cambridge Drive, blocks here are dense and lined with sidewalks. A grassy central rectangle that recalls a town green guarantees open space (in addition to the 33 acres that will remain undeveloped).

“There is always an idea, when something new comes to a small town, that the flavor of the town will change,” said Karen Giek, 74, a retired educational consultant and 41-year town resident who bought a home at Tradition in April, for $650,000. The single-story, two-bedroom house has an open floor plan and custom finishes, including granite counters.

“But change is inevitable,” Ms. Giek said. As a town, she added, “we are happy to share what we have.”


Image
12 WEST BARD AVENUE | A four-bedroom, four-bathroom house with an attached three-car garage, built in 1980 on 1.8 acres, listed for $975,000. 917-685-8575
12 WEST BARD AVENUE | A four-bedroom, four-bathroom house with an attached three-car garage, built in 1980 on 1.8 acres, listed for $975,000. 917-685-8575Credit...Tony Cenicola/The New York Times
What You’ll Find
Rolling upland from the Hudson River to hills to the east, Red Hook is not named for tomato-colored fishing tackle, although an illustration showing that image appears on many signs.

Instead, the name is derived from the Dutch phrase for “red point” — how the Hudson’s Cruger Island peninsula looked to explorers one autumn day in the 17th century when its sumac leaves were ablaze, according to historical accounts. Today, Cruger is part of the 1,722-acre Tivoli Bays Wildlife Management Area and Research Reserve, which allows hiking, kayaking and hunting along inviting shoreline curves.

The town’s hamlets and villages — two apiece — have distinct personalities. The quaint and quiet village of Tivoli is a draw for weekenders, as it was more than a century ago when New York’s gentry, many connected to the Livingston family, summered in country estates in the area.

Some of those estates survive as private homes, while Bard College, in the hamlet of Annandale-on-Hudson, has absorbed others into its eclectic campus — among them Montgomery Place, a neo-Classical Livingston getaway, and Blithewood, a columned Beaux-Arts mansion.


Image
8 SOUTHVIEW LANE | A four-bedroom, three-and-a-half-bathroom house with a heated saline pool, built in 2006 on 4.53 acres, listed for $925,000. 845-519-7016
8 SOUTHVIEW LANE | A four-bedroom, three-and-a-half-bathroom house with a heated saline pool, built in 2006 on 4.53 acres, listed for $925,000. 845-519-7016Credit...Tony Cenicola/The New York Times
But Kelly Road, which runs through the center of town, feels no-nonsense suburban, with its colonials and raised ranches.

A more down-to-earth crowd gravitates to the village of Red Hook, which offers a mix of restaurants, yoga studios and hardware stores on busy Broadway and Market Streets. A Hannaford grocery store is tucked discreetly behind trees, but shoppers in need of a big-box experience may be better served in Kingston, across the river.

What You’ll Pay
As the pandemic raged, housing inventory grew scarce. On July 1, 14 single-family homes were listed for sale, at an average of $881,000, according to data from the Mid-Hudson Multiple Listing Service, prepared by Mondello Upstate Properties.

At the low end was a bare-bones artist’s studio with a half-bathroom on 12 acres for $395,000, according to the data. The priciest, at $2.6 million, was Migliorelli Farm, a fixture both up- and downstate, that came with a five-bedroom residence, a cider house and two ponds across 210 acres (the listing didn’t include the farm stands, which line roads in the region).


Image
379 ROUTE 199 |A four-bedroom, three-and-a-half-bathroom ranch-style house with a deck, built in 1987 on three acres, listed for $445,000. 973-229-6875
379 ROUTE 199 |A four-bedroom, three-and-a-half-bathroom ranch-style house with a deck, built in 1987 on three acres, listed for $445,000. 973-229-6875Credit...Tony Cenicola/The New York Times
Sales have been brisk. Through June 30, 61 single-family houses had sold this year, at an average of $484,000, according to information provided by Margaret Niekrewicz, an associate broker with Mondello. In comparison, during the same period in 2019 (a more apt point of reference than 2020, which was hobbled by months without in-person showings), there were 43 sales, at an average of $327,000.

“It’s been city buyers, local buyers, a little bit of everything,” Ms. Niekrewicz said.`
//test = encodeURIComponent(test);
//test = test.replace(/%20/g,"+");
//console.log(test)

module.exports = new Command({
	name: 'news',
    description: 'search news articles',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: `"WORDS IN QUOTES" for exact match. +WORD must appear in article. -WORD must not appear.`,
        required: true,
    }],
	async execute(interaction) {
        async function smmry(e) {
            //&SM_URL=${e.url}
            //&SM_WITH_BREAK=true
            let response = await fetch(`http://api.smmry.com/&SM_API_KEY=${config.api.smmry}`, {
                method: "POST",
                body: `sm_api_input=${test}`,
                agent:new HttpsProxyAgent('http://127.0.0.1:8888'),
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then(res => {
                console.log(res)
                return res.json()
            });
            if (response.sm_api_error) {
                return `\`${response.sm_api_message}\``;
            }
            let summary = response.sm_api_content;
            summary = summary.replace(/\[BREAK\]/g, "\n\n");
            let rich = new MessageEmbed()
                .setTitle(`${e.title} (Summarized)`)
                .setURL(e.url)
                .setDescription(summary)
            return rich;
        }
        let response;
        if (interaction.options.data.length>0) {
            response = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(`${interaction.options.data[0].value}`)}&apiKey=${config.api.news}&sortBy=publishedAt&language=en&pageSize=20`).then(res => res.json());
        } else {
            response = await fetch(`https://newsapi.org/v2/top-headlines?apiKey=${config.api.news}&pageSize=20&language=en`).then(res => res.json());
        }
        let desc = response.articles.filter((e, i, arr) => {
            return arr.findIndex((that_e) => {
                return that_e.title.toLowerCase() === e.title.toLowerCase();
            }) === i;
        }).map(e => {
            return {
                title: `${e.source.name}: **[${escapeMarkdownText(e.title)}](${escapeMarkdownText(e.url)})**`,
                response: async () => { return smmry(e) }
            };
        })


        if (desc.length == 1) {
            return await desc[0].response()
        } else if (desc.length < 1) {
            return "`No results found`";
        } else {
            let rich = MessageResponse.addList(interaction.channelID, desc);
            rich.setTitle(`Recent News${interaction.options.data[0].value ? `: ${escapeMarkdownText(interaction.options.data[0].value)}` : ""}`);
            return rich;
        }
    }
})