# Personal Discord Bot
Updated to discord.js 11.2.1.

[Test the bot](https://discord.gg/YpjRNZT)

[Invite the bot to a server](https://discordapp.com/oauth2/authorize?client_id=180762874593935360&scope=bot&permissions=4294967295)

## Commands
#### ping
Replies with "pong"
#### time
Responds with the current time in several time zones
#### .sv (search term)
Searches the Shadowverse card database and returns with the card art and stats
#### .remindme ("message") (date)
Sets a reminder and responds with the id
#### .cancelremindme (id)
Cancels the reminder
#### .gw2api key (key)
Sets the Guild Wars 2 API key for the user
#### .gw2api search (term)
Searches all of the user's characters' inventory and bank and returns items that match the search term
#### .price [amt] (fromsym) [tosym]
Returns the current exchange rate and a chart of the exchange rate for the last 30 hours from `fromsym` to `tosym`. `fromsym` and `tosym` are symbols of any currency including cryptocurrency
#### .yt (youtube link or id)
Plays the YouTube audio in the user's current voice channel
#### .yts (search_term) [num_results]
Searches YouTube based on the search term and allows a follow up number to play that YouTube video in the current voice channel
#### .quote (message_id or num_of_messages_before_last_message)
Quotes a message based on ID or number of messages before the last message
#### .eval (JS code)
Runs JavaScript code. Admin only.
#### .weather (location)
Returns the current weather and the forecast for the next 7 days at location term
#### .pt (search_term) [online] [num_results]
Searches the cheapest results from poe.trade 
#### .roll (max_roll)
Rolls a `max_roll` sided die
#### .roll (#d#)
Rolls DnD style dice and adds them
#### (0:00 am est)
Responds with the time converted to other time zones
#### fuck (you|u) (something)
Responds with `I think its hilarious u kids talking shit about `...
#### whens...
Responds with `never`
#### wat
Responds with the message before but in all caps
#### jonio
Responds with my website that parses joniosan's Twitch archive
#### .addmeme (copy_pasta)
Adds another message to meme when someone says `meme`
#### .searchmeme (search_term)
Searches meme messages
#### meme (num)
Returns a specific meme message
#### meme
Returns a random meme message when a message contains `meme` anywhere
#### botlink
Returns the link to invite the bot to other servers
#### dat boi
Responds with some long dat boi response
#### animal
Uploads a random cute animal gif
#### setpoeleague
Sets or resets the user's Path of Exile league used to search poe.trade
#### stop
Stops currently played music

## To do
Port the rest of the code over: Mainly Overwatch charts and Spotify.
Async and await to improve readability
