# Tall Bot
A Discord bot that does a lot of things

[Test the bot](https://discord.gg/YpjRNZT)

[Invite the bot to a server](https://discordapp.com/oauth2/authorize?client_id=180762874593935360&scope=bot&permissions=4294967295)

# How to run

`npm install`

`node discord.js`

paste token into config.json

`node discord.js` again
## ping

## time

## sv
returns shadowverse card info
## remindme
sends a reminder after specified time. Returns the ID.



.remindme "(message)" (00:00am est)

sends a reminder at specified time. Returns the ID.



.remindme "(message)" (datestring)

sends a reminder at specified date. datestring is any string accepted for making a new Date object in JS. Returns the ID.
## cancelremindme
cancels a remindme reminder with id
## ygo
returns yu-gi-oh card data
## hs
returns hearthstone card data
## art
return artifact cards
## mtg
returns mtg
### .mtg __search_term__
#### search_term
The card name. For split, double-faced and flip cards, just the name of one side of the card. Basically each ‘sub-card’ has its own record.
#### Examples
.mtg saheeli

## gundam

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

## sc6
returns information about a Soulcalibur 6 character's attack string
### .sc6 __character_name__ __condition__
#### character_name
full or part of a character's name
#### **condition**
**__commandstring__ or __movename__** - returns moves which contain the commandstring or movename. same as command:commandstring or attack:movename

**__fieldname__>__searchstring__** - the field begins with searchstring

**__fieldname__<__searchstring__** - the field ends with fieldvalue

**__fieldname__=__searchstring__** - the field contains searchstring

**__fieldname__>__num__** - the value of fieldname is greater than num

**__fieldname__<__num__** - the value of fieldname is less than num

**__fieldname__=__num__** - the value of fieldname is equal to num

**i__num__** - same as imp=__num__

multiple conditions can be linked together using condition1&condition2&condition3...
#### Examples
**.sc6 tal aaba** - returns information on Talim's AABA

**.sc6 ivy ivy** - returns Ivy moves where the name contains "ivy"

**.sc6 nigh imp<15** - returns Nightmare moves that are faster than 15 frames

**.sc6 nigh hit level<m&hit level>h** - returns Nightmare moves that begin with a mid and end with a low

## sts
returns information on a Slay the Spire card or relic. Matches by substring
## price
returns a 30 hour graph of the price of a foreign currency or cryptocurrency

amount (optional) - the amount of from_symbol currency. Default is 1.

from_symbol - the currency symbol you are exchanging from. ex: CAD

to_symbol (optional) - the currency symbol you are exchanging to. Default is USD.
## yt
plays audio from a YouTube link in a voice channel

youtube_id - can either be the full YouTube URL or the unique 11 characters at the end of the URL
## yts
returns list of YouTube videos based on the search term

number_of_results - the number of results to return. Default is 6.
## quote
returns a link to and a quote of a past message

message_id - get the id by selecting "copy id" from the settings of the message

previous_nth_message - the number of messages to go back to reach the message you want to quote. 1 is the last message, 2 is the one before, etc
## weather
returns the 8 day forecast and a chart of the temperature for the next 2 days

location - can be several things like the name of a city or a zip code
## pt
returns poe.trade based on item name or stats
## setpoeleague
sets your PoE league for .pt
## define
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
returns posted feeds since last week
## cog
returns a gif of the image in a spinning cogwheel
## translate
translate a string to english
## image
returns the first image result. safesearch is off if the channel is nsfw
## stock
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
returns nothing
### .ff14 __character_name__
#### character_name
The name to search for

## patch notes
added mtg, stock, news, ff14

added random argument to mtg, ygo, art

2019-05-30`
## 00:00am est
returns the time converted to different time zones. can be anywhere in a message
## help
returns a list of commands. respond with the number for details on a specific command
## stop
stops the current song playing