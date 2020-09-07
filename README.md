# Tall Bot
A Discord bot that does a lot of things

[Test the bot](https://discord.gg/YpjRNZT)

[Invite the bot to a server](https://discordapp.com/oauth2/authorize?client_id=180762874593935360&scope=bot&permissions=4294967295)

# How to run

`npm install`

`node discord.js`

paste token into config.json

`node discord.js` again
## time
responds with the time in UTC, CST, EST, PST, NZST, and JST
## sv
.sv (search term)

returns shadowverse card info
## ygo
.ygo (card_name or random)

returns yu-gi-oh card data
## hs
.hs (card name)

returns hearthstone card data
## art
.art (search_term or random)

return artifact cards
## mtg
returns Magic the Gathering card
### .mtg __search_term or random__
#### search_term
The card name. For split, double-faced and flip cards, just the name of one side of the card. Basically each ‘sub-card’ has its own record.
#### random
returns a random card
#### Examples
.mtg saheeli

.mtg random

## teppen
.teppen (search)
## ahdb
.ahdb (search)
## t7
returns information on a Tekken 7 character's move string
### .t7 __character_name__ __condition__
#### character_name
full or part of a character's name
#### **condition**
**__commandstring__ or __movename__** - returns moves which contain the commandstring or movename. same as command:commandstring or name:movename

**__fieldname__>__searchstring__** - fieldname begins with searchstring

**__fieldname__<__searchstring__** - the field end with searchstring

**__fieldname__:__searchstring__** - the value of fieldname begins with searchstring

**__fieldname__=__searchstring__** - value of fieldname is exactly the searchstring

**__fieldname__>__num__** - the value of fieldname is greater than num

**__fieldname__<__num__** - the value of fieldname is less than num

**__fieldname__=__num__** - the value of fieldname is equal to num

**i__num__** - same as startup=__num__

multiple conditions can be linked together using condition1&condition2&condition3...
#### Examples
**.t7 aku 11** - returns information on Akuma's 1,1

**.t7 aku com:11** - returns strings that contains 1,1

**.t7 aku hadoken** - returns moves where the name contains "hadoken"

**.t7 aku hit level>m** - returns moves that begin with a mid

**.t7 aku hit level<m** - returns moves that end with a mid

**.t7 aku name=gohadoken** - returns moves where the name is exactly gohadoken

**.t7 aku i13** - returns moves that have a startup of 13

**.t7 aku startup<12** - returns moves that have a startup < 12

**.t7 aku notes:special cancel** - returns moves that say special cancel in the notes

**.t7 aku block<10 & startup<15 & hitlevel>m** - returns moves that are < 10 on block, startup > 15, and begin with a mid

## sts
.sts (card_name or relic_name)

returns information on a Slay the Spire card or relic. Matches by substring
## osfe
.osfe (spell, artifact, or keyword)

returns information on a One Step From Eden spell, artifact, or keyword. Matches by substring
## lor
returns Legends of Runeterra card
### .runeterra __search_term or random__
#### __search_term or random__
search term for a Legends of Runeterra card name or a random card

## pokemon
return info on pokemon, moves, and abilities
### .pokemon __search__
#### __search__
search term for a pokemon name, move, or ability

## price
.price \[amount] (from_symbol) \[to_symbol]

returns a 30 hour graph of the price of a cryptocurrency

amount (optional) - the amount of from_symbol currency. Default is 1.

from_symbol - the currency symbol you are exchanging from. ex: BTC

to_symbol (optional) - the currency symbol you are exchanging to. Default is USD.
## curr
.curr \[amount] (from_symbol) \[to_symbol]

returns of the price of a foreign currency

amount (optional) - the amount of from_symbol currency. Default is 1.

from_symbol - the currency symbol you are exchanging from. ex: CAD

to_symbol (optional) - the currency symbol you are exchanging to. Default is USD.
## yt
returns or plays audio from YouTube video to a voice channel
### .yt __youtube link, id, or search term__
#### __youtube link, id, or search term__
can be an entire YouTube URL, just the ID, or a string to search
#### Examples
**.yt DN9YncMIr60** - plays <https:/​/youtu.be/DN9YncMIr60> in a voice channel

**.yt <https:/​/www.youtube.com/watch?v=DN9YncMIr60>** - same as above

**.yt Tokyo Daylight (Atlus Kozuka Remix)** - same as above or returns the video if not in a voice channel

## yts
.yts (search_term)

returns list of YouTube videos based on the search term
## quote
.quote (message_id or previous_nth_message)

returns a link to and a quote of a past message

message_id - get the id by selecting "copy id" from the settings of the message

previous_nth_message - the number of messages to go back to reach the message you want to quote. 1 is the last message, 2 is the one before, etc
## weather
.weather (location)

returns the 8 day forecast and a chart of the temperature for the next 2 days

location - can be several things like the name of a city or a zip code
## covid
returns covid-19 counts for area
### .covid __place__
#### place
"all" or country name or state initial/name

## pt
.pt (item)

returns poe.trade based on item name or stats

can paste item text after copying it from poe. add x at the end of the item text to ignore stats. add f at the end of the item text to search by formose score
## setpoeleague
.setpoeleague

sets your PoE league for .pt
## poe
search poe wiki
### .poe (search)

## define
define (term)

returns urban dictionary definition
## roll
rolls dice between 1 and max_num
### .roll \[(num_dice)d](max_num)\[+(add)]
#### num_dice
number of dice to roll
#### max
the max roll
#### add
number to add at the end
#### Examples
**.roll 6** - rolls a die between 1 to 6 inclusive

**.roll d6** - same as .roll d6

**.roll 10d6** - rolls 10 6-sided dice and adds them together

**.roll 10d6+10** - rolls 10 6-sided dice and then adds 10 to the total

## rss
Subscribing to a feed will allow me to automatically post when updates occur
### .rss (action) (args)
#### rss add (rss_link or any type of steam_page_url)
Subscribes to an RSS feed

**Examples**

__.rss add \[https]()://steamcommunity.com/games/389730/__ - subscribes to Tekken 7 steam news

__.rss add \[http]()://rss.cnn.com/rss/cnn_topstories.rss__ - subscribes CNN top stories (enjoy the spam)
#### rss subs
Lists all subscriptions
#### rss news
Lists all recent news from subscriptions
#### rss remove (num)
Remove a subscription from this channel. Get the number from ".rss subs"

## egs
returns free epic game store games list or alerts
### .egs (action) (args)
#### .egs on
turns on reminder of new egs games
#### .egs off
turns off reminder
#### .egs list
returns the current list of free games

## cog
.cog (imageurl) or .cog (emoji) or .cog while attaching an image

returns a gif of the image in a spinning cogwheel
## translate
.translate (string)

translate a string to english
## rank
.rank

have a trophy
## image
.image (term)

returns the first image result. safesearch is off if the channel is nsfw. add gif to the search if you want gifs
## gif
.gif (term)

returns the first gif search result. safesearch is off if the channel is nsfw.
## stock
.stock (symbol)

returns price and chart of stock symbol
## news
returns news articles containing search term
### .news __search_term__
#### search_term
Surround phrases with quotes (") for exact match.

Prepend words or phrases that must appear with a + symbol. Eg: +bitcoin

Prepend words that must not appear with a - symbol. Eg: -bitcoin

Alternatively you can use the AND / OR / NOT keywords, and optionally group these with parenthesis. Eg: crypto AND (ethereum OR litecoin) NOT bitcoin.
#### Examples
.news trump - returns news containing "trump"

.news "yang gang" - return news containing the phrase "yang gang"

## ff14
returns character data
### .ff14 __character_name__ __server_name_or_data_center__
#### character_name
The name to search for.
#### server_name or data_center
The server or data center which the character resides in. Not required.

## patchnotes
.patchnotes

lists recent changes
## 00:00am est
(00:00)\[am or pm] (time_zone)

returns the time converted to different time zones. can be anywhere in a message
## help
.help

returns a list of commands. respond with the number for details on a specific command