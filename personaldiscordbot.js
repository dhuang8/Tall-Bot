"use strict";
var Discord = require("discord.js");
var request = require('request');
var fs = require('fs');
var moment = require ('moment-timezone')
moment.tz.setDefault("America/New_York");
var Quiche = require('quiche');
var CronJob = require('cron').CronJob;
var Deezer = require("node-deezer-api");
var streamifier = require('streamifier')

//text channel for logging users
var botChannel="";
//text channel for logging errors
var errorChannel="";
//owner of the bot
var main="";

//bot token prepended with "Bot " from https://discordapp.com/developers/applications/me
var botToken="Bot ";
var client_id="";
var client_secret="";

global.btoa = function (str) {return new Buffer(str).toString('base64');};

var Spotify = function(){
	this.token;
	this.getToken();
}

Spotify.prototype ={
		apiUrl: "https://api.spotify.com/v1/",
		getToken: function(callback){
			var this1=this;
			var options = {
					url:'https://accounts.spotify.com/api/token',
					method:'POST',
					form: {grant_type:"client_credentials"}
					headers:{
						Authorization: "Basic " + btoa(client_id+":"+client_secret)
					}
			}

			request(options,function(error, response, body){
				if (error) {
					err(error);
					return;
				}
				try {
					var data = JSON.parse(body);
					if (data.error) {
						var e = new Error(data.error + " " + data.error_description);
						err(e);
						return;
					}
					this1.token=data.access_token;
					if (callback!=null) callback();
				}
				catch (e){
					err(e);
				}
			})
		},
		call: function(endpoint,parameterObj,callback){
			var this1=this;
			if (this1.token==null){
				this1.getToken(function(){
					this1.call(endpoint,parameterObj,callback);
				})
				return;
			}
			var options = {
					url:'https://api.spotify.com/v1/'+endpoint,
					method:'GET',
					qs: parameterObj,
					//proxy: 'http://localhost:8888',
					headers:{
						Authorization: "Bearer " + this1.token
					}
			}

			request(options,function(error, response, body){
				if (error) {
					err(error);
					return;
				}
				try {
					//console.log(thisST);
					var data = JSON.parse(body);
					if (data.error) {
						if (data.error.status==401){
							this1.token=null;
							this1.getToken(function(){
								this1.call(endpoint,parameterObj,callback);
							})
						}
						else {
							var e = new Error(data.error.status + " " + data.error.message);
							err(e);
						}
					}
					else callback(data);
				}
				catch (e){
					err(e);
				}
			})
		}
}

var SongTrivia2 = function(text,voice,bot){
	this.textChannel = text;
	this.voiceChannel = voice;
	this.phase = 0;
	this.token;
	this.bot = bot;
	this.currCustom = null;
}

SongTrivia2.prototype = {
		onMessage: function(message){			
			var thisST=this;
			var a;
			if (thisST.currCustom!=null){
				if (thisST.currCustom.onMessage(message)){
					return;
				}
			}
			if (a=/^spotify search (.*)$/.exec(message.content)) {
				var params = {
						type: "track",
						limit:3,
						q:a[1]
				}

				spotify.call("search",params,function(data){
					var msg="```";
					for (var i=0;i<data.tracks.items.length;i++){
						msg+=(i+1)+". "+data.tracks.items[i].name+" - "+data.tracks.items[i].artists[0].name+"\n";
					}
					msg+="```";
					thisST.bot.sendMessage(thisST.textChannel,msg);
					thisST.currCustom = new CustomCommand(/^(\d+)$/,function(message){
						var num = parseInt(message.content);
						if (num<data.tracks.items.length+1 && num>0){
							playSound(thisST.voiceChannel,data.tracks.items[num-1].preview_url,10);
							//thisST.currCustom=null;
						}
					})
				})
			}
			return false;
		}
}

var SongTrivia = function(text,voice,data,bot){
	this.textChannel = text;
	this.voiceChannel = voice;
	this.phase = 0;
	this.token;
	this.bot = bot;
	this.currCustom = null;
	this.currentSong = 0;
	this.voiceConnection;
	this.volume=10;
	this.data=data;
	this.hint = [];
	this.hintmessage = null;
	this.time = 1;
	this.answer = null;
	this.important = true;
	this.hintsOn = true;
	this.hintInt=10000;
	bot.sendMessage(this.textChannel, '```Populating song list...\nHints on, turn off with "hints off"```').catch(err);

	function shuffleArray(array) {
		for (var i = array.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
		return array;
	}
	this.radiolist = shuffleArray(data);

	var thisST = this;

	for (var i = 0;i<thisST.bot.voiceConnections.length;i++){
		if (thisST.bot.voiceConnections[i].voiceChannel.equals(thisST.voiceChannel)){
			thisST.bot.voiceConnections[i].playingIntent.removeAllListeners("end");
			thisST.bot.voiceConnections[i].stopPlaying();
			break;
			//return;
		}
		else if (thisST.bot.voiceConnections[i].voiceChannel.server.equals(thisST.voiceChannel.server)){
			thisST.bot.voiceConnections[i].playingIntent.removeAllListeners("end");
			thisST.bot.leaveVoiceChannel(thisST.bot.voiceConnections[i].voiceChannel).catch(err)
			break;
		}
	}

	thisST.bot.joinVoiceChannel(thisST.voiceChannel,function(e,conn){
		thisST.voiceConnection = conn;
		thisST.playTrack();
	})
}

SongTrivia.prototype = {
		loadSongList: function(list){
			this.radiolist;
		},
		onMessage: function(message){
			var thisST=this;
			var a;
			if (thisST.currCustom!=null){
				if (thisST.currCustom.onMessage(message)){
					return;
				}
			}
			//guess
			if (thisST.answer!=null && message.content.toLowerCase().replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~\s]/g,'')===thisST.answer) {
				if (true){
					thisST.bot.sendMessage(thisST.textChannel,"`"+thisST.data[thisST.currentSong].title_short+" — "+thisST.data[thisST.currentSong].artist.name+"`").catch(err);
					thisST.voiceConnection.playingIntent.removeAllListeners("end");
					thisST.voiceConnection.stopPlaying();
					thisST.currentSong++;
					thisST.playTrack();
					return true;
				}
			}
			if (a=/^skip$/.exec(message.content)) {
				if (true){
					thisST.voiceConnection.stopPlaying();
					return true;
				}
			}
			else if (a=/^stop$/.exec(message.content)) {
				thisST.stop();
				return true;
			}
			else if (a=/^hints on$/.exec(message.content)) {
				thisST.hintsOn = true;
				bot.sendMessage(thisST.textChannel, "`Hints on`").catch(err);
				return true;
			}
			else if (a=/^hints off$/.exec(message.content)) {
				thisST.hintsOn = false;
				bot.sendMessage(thisST.textChannel, "`Hints off`").catch(err);
				return true;
			}
			else if (a=/^volume$/.exec(message.content)) {
				var msg="Volume is at "+thisST.volume;
				bot.sendMessage(thisST.textChannel, msg).catch(err);
				return true;
			}
			else if (a=/^(?:volume|setvolume) (\d{1,3})$/.exec(message.content)) {
				if (a[1] && parseInt(a[1])>0 && parseInt(a[1])<101){
					thisST.volume=parseInt(a[1])
					thisST.voiceConnection.setVolume(parseInt(a[1])/100);
					bot.sendMessage(thisST.textChannel, "`Volume is at " +thisST.volume+ "`").catch(err);
				}
				else {
					var msg="`" + a[1] + " is not a valid parameter.`";
					bot.sendMessage(thisST.textChannel, msg).catch(err);
				}
			}
			return false;
		},
		playTrack: function(){	
			var thisST=this;
			this.hintmessage = null;
			thisST.time=20000;
			thisST.voiceConnection.stopPlaying();
			if (this.currentSong>=this.data.length) {
				thisST.bot.sendMessage(thisST.textChannel,"`songs done`").catch(err);
				thisST.stop();
				return;
			}

			thisST.hint=thisST.data[thisST.currentSong].title_short.replace(/[^\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~\s]/g,'_');
			thisST.answer = thisST.data[thisST.currentSong].title_short.toLowerCase().replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~\s]/g,'');
			Deezer.getTrack(thisST.data[thisST.currentSong].id,function(error,res2){
				if (error) return err(error);
				Deezer.decryptTrackStream(res2,function(error,stream){
					if (error) return err(error);
					thisST.play(stream)
				})
			})
		},
		play: function(stream){
			var thisST=this;
			try {
				var start = 0;
				var duration = null

				var vol=thisST.volume/100;

				thisST.voiceConnection.playRawStream(stream, {volume:vol}, function(error, intent){
					if (error) {
						err(error);
						return;
					}
					intent.on("end", function(){
						thisST.bot.sendMessage(thisST.textChannel,"`"+thisST.data[thisST.currentSong].title_short+" — "+thisST.data[thisST.currentSong].artist.name+"`").catch(err);
						thisST.currentSong++;
						thisST.playTrack();
					})
					intent.on("error", function(e){
						err(e);
					})

					intent.on("time", function(t){
						if (thisST.hintsOn && t>thisST.time+thisST.hintInt){
							thisST.time=t;
							var listofunderscore = [];
							for (var i=0;i<thisST.hint.length;i++){
								if (thisST.hint.charAt(i)==="_") listofunderscore.push(i);
							}
							if (listofunderscore.length>1){
								var randchar = listofunderscore[Math.floor(Math.random()*listofunderscore.length)];
								thisST.hint = thisST.hint.substr(0, randchar) + thisST.data[thisST.currentSong].title_short.charAt(randchar) + thisST.hint.substr(randchar+1);

								if (thisST.hintmessage==null){
									bot.sendMessage(thisST.textChannel, "`"+thisST.hint.split("").join(" ")+"`", undefined , function(error,loadingMessage){
										if (error){
											err(error);
											return;
										}
										thisST.hintmessage = loadingMessage;
									})
								}
								else {
									bot.updateMessage(thisST.hintmessage,"`"+thisST.hint.split("").join(" ")+"`").catch(err);
								}
							} else if (listofunderscore.length===1){
								var randchar = listofunderscore[0];
								thisST.hint = thisST.hint.substr(0, randchar) + thisST.data[thisST.currentSong].title_short.charAt(randchar) + thisST.hint.substr(randchar+1);
								if (thisST.hintmessage==null){
									bot.sendMessage(thisST.textChannel, "`"+thisST.hint.split("").join(" ")+"`").catch(err)
								}
								else {
									bot.updateMessage(thisST.hintmessage,"`"+thisST.hint.split("").join(" ")+"`").catch(err);
								}
								thisST.voiceConnection.stopPlaying();
							} else {
								thisST.voiceConnection.stopPlaying();
							}
						}
					})
				})
			}
			catch (e){
				err(e);
			}
		},
		stop: function(){
			var thisST=this;
			thisST.bot.sendMessage(thisST.textChannel,"`Song trivia ended`").catch(err);
			if (thisST.voiceConnection.playingIntent!=null)	thisST.voiceConnection.playingIntent.removeAllListeners("end");
			thisST.voiceConnection.stopPlaying();
			thisST.bot.leaveVoiceChannel(thisST.voiceConnection.voiceChannel).catch(err);
			runningProcess[thisST.textChannel.server]=null;
		}
}

var CustomCommand = function(regex,callback){
	this.regex=regex;
	this.callback=callback;
	this.important = false;
}

CustomCommand.prototype.onMessage = function(message){
	var a;
	if (a=this.regex.exec(message.content)){
		this.callback(message);
		return true;
	}
	return false;
}

var runningProcess=[];

var bot = new Discord.Client({autoReconnect: true, forceFetchUsers: true, largeThreshold: 50, maxCachedMessages: 25});

var copypasta=[];
fs.readFile("copypasta.txt", 'utf8', function(e,data){
	if (e) {
		return console.log(e);
	}
	copypasta=data.split("\x0d\x0a\x0d\x0a\x20\x0d\x0a\x0d\x0a")
	//console.log( copypasta[Math.floor(Math.random()*copypasta.length)])
})

function htmldecode(a){
	function replaceAll(str, find, replace) {
		return str.replace(new RegExp(find, 'g'), replace);
	}
	a=replaceAll(a,"&#39;","'")
	a=replaceAll(a,"&amp;","&")
	a=replaceAll(a,"&gt;",">")
	a=replaceAll(a,"&lt;","<")
	a=replaceAll(a,"&quote;",'"')
	return a;
}

function getFirstVoiceChannel(server,userid){
	try {
		var chanlist = server.channels.getAll("type","voice")//.getAll("members").getAll("id",userid);
		for (var i=0;i<chanlist.length;i++){
			if (chanlist[i].members.get("id",userid)) return chanlist[i];
		}
		return null;
		//return server.channels.get("type","voice");
	}
	catch (e){
		err(e);
		return null;
	}
}

function playSound(channel,URL,setvolume,setstart,setduration,setgame){
	try {
		if (runningProcess[channel.server]!=null && runningProcess[channel.server].important) {
			return;
		}
		if (channel.members.length>0){
			for (var i = 0;i<bot.voiceConnections.length;i++){
				if (bot.voiceConnections[i].voiceChannel.equals(channel)){
					bot.voiceConnections[i].playingIntent.removeAllListeners("end");
					bot.voiceConnections[i].stopPlaying();
					break;
					//return;
				}
				else if (bot.voiceConnections[i].voiceChannel.server.equals(channel.server)){
					bot.voiceConnections[i].playingIntent.removeAllListeners("end");
					bot.leaveVoiceChannel(bot.voiceConnections[i].voiceChannel).catch(err)
					break;
				}
			}
			bot.joinVoiceChannel(channel,function(e,conn){
				if (e) {
					err(e)
					return;
				}
				try {
					var volume=.3;
					var start = 0;
					var duration = null

					if (setvolume && setvolume>0 && setvolume<101) volume=setvolume/100
					if (setstart && setstart>-1) start=setstart
					if (setduration && setduration>0) duration = setduration;

					//console.log(volume,start,duration,setgame);
					//conn.playArbitraryFFmpeg(options, function(err, intent){
					if (typeof URL == "string") {
						conn.playFile(URL, {volume:volume, seek: start}, function(error, intent){
							if (error) {
								err(error);
								return;
							}
							try{
								if (setgame) bot.setPlayingGame(setgame).catch(err)

								if (duration !==null){
									intent.on("time", function(t){
										if (duration !==null && t>duration*1000) conn.destroy();
									})
								}
								intent.once("end", function(){
									bot.setPlayingGame("nothing").catch(err)
									//console.log("end")
									//conn.destroy();
									bot.leaveVoiceChannel(conn.voiceChannel).catch(err)
								})
								intent.once("error", function(e){
									err(e);
								})
							}
							catch (e){
								err(e);
							}
						})
					}
					else {
						conn.playRawStream(URL, {volume:volume, seek: start}, function(error, intent){
							if (error) {
								err(error);
								return;
							}
							try{
								if (setgame) bot.setPlayingGame(setgame).catch(err)

								if (duration !==null){
									intent.on("time", function(t){
										if (duration !==null && t>duration*1000) conn.destroy();
									})
								}
								intent.on("end", function(){
									bot.setPlayingGame("nothing").catch(err)
									//console.log("end")
									//conn.destroy();
									bot.leaveVoiceChannel(conn.voiceChannel).catch(err)
								})
								intent.on("error", function(e){
									err(e);
								})
							}
							catch (e){
								err(e);
							}
						})
					}
				}
				catch (e){
					err(e);
				}
			})
		} else {
			console.log("no one in channel");
		}
	}
	catch (e){
		err(e);
	}
}


bot.on('presence', function(oldUser, newUser) {
	try {
		var msg=moment().format('h:mma') + " ";
		msg+=newUser.username + " (" + newUser.id +") ";
		//if (oldUser.status !== newUser.status) msg+=oldUser.status + "→" + newUser.status;
		//console.log(newUser);
		var oldgame = (oldUser.game ? oldUser.game.name : oldUser.game)
		var newgame = (newUser.game ? newUser.game.name : newUser.game)
		if (oldUser.status == "idle" && newUser.status=="online") msg+= "returned from " + oldUser.status;
		else if (oldUser.status !== newUser.status) msg+= "went " + newUser.status;
		else if (oldgame!==newgame) {
			if (oldgame===null) msg += "started playing "+ newgame;
			else if (newgame===null) msg += "stopped playing "+ oldgame;
			else {
				msg += "switched from playing "+ oldgame + " to " + newgame;
			}
		}
		if (oldUser.username!==newUser.username) msg+= "changed his username from " + oldUser.username + " to " + newUser.username;
		if (oldUser.avatarURL!==newUser.avatarURL) {/*
		if (oldUser.avatarURL) oldUser.avatarURL= "<"+oldUser.avatarURL+">"
		if (newUser.avatarURL) newUser.avatarURL= "<"+newUser.avatarURL+">"*/
			msg+= "changed his avatar from <" + oldUser.avatarURL + "> to <" + newUser.avatarURL + ">.";
		}

		bot.sendMessage(botChannel, msg);
	}
	catch (e){
		err(e)
	}
});

bot.on('messageDeleted', function(message, channel) {
	try {
		if (message.author.equals(bot.user)) return;
		var msg=moment().format('h:mma') + " ";
		msg+=message.author.username + ' deleted message "' + message.content +'" in channel ' + channel.id;
		bot.sendMessage(botChannel, msg);
	}
	catch (e) {
		err(e);
	}
})

bot.on('messageUpdated', function(oldmes, newmes) {
	try {
		if (newmes.author.equals(bot.user)) return;
		var msg=moment().format('h:mma') + " ";
		if (oldmes == null) msg+=newmes.author.username + ' changed message to "' + newmes.cleanContent + '" in channel ' + newmes.channel.id;
		else msg+=newmes.author.username + ' changed message from "' + oldmes.cleanContent +'" to "' + newmes.cleanContent + '" in channel ' + newmes.channel.id;
		bot.sendMessage(botChannel, msg);
	}
	catch (e){
		err(e);
	}
})

bot.on("message", function(message) {
	try{
		if (message.author.equals(bot.user)) return;
		var a;
		if (runningProcess[message.channel.server]!=null) {
			if (runningProcess[message.channel.server].onMessage(message)) return;
		}
		if (a=/^(?:yt|YT) (?:([a-zA-Z0-9_-]{11})|(?:https?:\/\/)?(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:[^\/\s]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11}))\S*(?: (\d{1,6}))?(?: (\d{1,6}))?(?: (\d{1,3}))?$/.exec(message.content)) {
			request('http://127.0.0.1/video/youtubedl.php?id='+(a[1] || a[2])+'&callback=a&f=bestaudio%20-e', function (error, response, body) {
				try {
					if (error || response.statusCode != 200) {
						err(error);
						var msg="`Error loading video " + a[1] +"`";
						bot.sendMessage(message, msg).catch(err);
						return;
					}
					var jsn;
					jsn=JSON.parse(body.substring(2,body.length-1));
					if (jsn.length<2) {
						var msg=body.substring(2,body.length-1);
						console.log(msg)
						return;
					}
					//console.log(jsn);

					//play
					var channel = getFirstVoiceChannel(message.channel.server,message.author.id);
					if (channel){
						playSound(channel,jsn[1],parseInt(a[3]),parseInt(a[4]),parseInt(a[5]),jsn[0])
					} else {
						var msg="`No voice channel`";
						bot.sendMessage(message, msg).catch(err);
					}

				}
				catch(e){
					console.log(body);
					err(e);
				}
			})
		}
		else if (a=/^(?:yt|YT) .*?$/.exec(message.content)) {
			var msg = '`yt (youtube id or link) [volume 1-100] [start in seconds] [duration in seconds]`';
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^(?:pt|PT) ([^\n\r]+?)( online)?(?: ([\d]{1,2}))?$/.exec(message.content)){
			bot.sendMessage(message, "`Loading...`", undefined , function(error,loadingMessage){
				if (error){
					err(error);
					return;
				}
				try {
					var online="";
					if (a[2] && a[2]==" online") online = "x"
						var count=4;
					if (a[3] && parseInt(a[3])<21 && parseInt(a[3])>0) count=parseInt(a[3])
					var r = request.post({
						url: "http://poe.trade/search",
						followRedirect: false,
						headers:{
							"Content-Type": "application/x-www-form-urlencoded"
						},
						body:"league=Essence&type=&base=&name="+a[1]+"&dmg_min=&dmg_max=&aps_min=&aps_max=&crit_min=&crit_max=&dps_min=&dps_max=&edps_min=&edps_max=&pdps_min=&pdps_max=&armour_min=&armour_max=&evasion_min=&evasion_max=&shield_min=&shield_max=&block_min=&block_max=&sockets_min=&sockets_max=&link_min=&link_max=&sockets_r=&sockets_g=&sockets_b=&sockets_w=&linked_r=&linked_g=&linked_b=&linked_w=&rlevel_min=&rlevel_max=&rstr_min=&rstr_max=&rdex_min=&rdex_max=&rint_min=&rint_max=&mod_name=&mod_min=&mod_max=&group_type=And&group_min=&group_max=&group_count=1&q_min=&q_max=&level_min=&level_max=&mapq_min=&mapq_max=&rarity=&seller=&thread=&identified=&corrupted=&online="+online+"&buyout=x&altart=&capquality=x&buyout_min=&buyout_max=&buyout_currency=&crafted=&ilvl_min=&ilvl_max=" },
						function (error, res, body) {
							if (error){
								err(error);
								bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
								return;
							}
							try{
								var link = res.headers.location
								var r = request.post({
									url: res.headers.location, 
									followRedirect: false,
									method:"post",
									body:"sort=price_in_chaos&bare=true",
									headers:{
										"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
									}},
									function (err, res, body) {
										try {
											var regex=/<tbody[\s\S]+?data-buyout=\"([^\r\n]+)\"[\s\S]+?data-name=\"([^\r\n]+)\"[\s\S]+?<td class="item-cell">[\s\S]+?(?:<span class="label success corrupted">(corrupted)<\/span>[\s\S]+?)?<span class=\"found-time-ago\">([0-9a-zA-Z ]*?)<\/span>[\s\S]+?(?:<span class="success label">(online)<\/span>[^\r\n]+)?<\/tbody>/g;
											var a;
											if (a=regex.exec(body)){
												var msg="";
												while(a && count>0){
													msg+= htmldecode(a[2]);
													if (a[3]) msg+=" (" + a[3]+")"
													msg+=" : " +a[1];
													if (a[4] && a[4].length>0) msg += ", " + a[4]
													if (a[5]) msg+= ", " + a[5]
													msg+="\n"
														count--;
													a=regex.exec(body)
												}
												msg += link
												bot.updateMessage(loadingMessage, msg).catch(err);
											} else{
												var msg= "```No search results found\n" + link + "```";
												bot.updateMessage(loadingMessage, msg).catch(err);
											}
										}
										catch (e){
											err(e);
											bot.updateMessage("`Error. Check the logs.`", msg).catch(err);
										}
									}
								);
							}
							catch (e){
								err(e);
								bot.updateMessage("`Error. Check the logs.`", msg).catch(err);
							}
						}
					);
				}
				catch (e){
					err(e);
					bot.updateMessage("`Error. Check the logs.`", msg).catch(err);
				}
			})
		}
		else if (a=/^pt|PT help$/.exec(message.content)) {
			var msg = '`pt (search term) [online] [number of search results 1-20]`';
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^(?:yts|YTS) ([^\n\r]+?)(?: ([\d]{1,2}))?$/.exec(message.content)) {
			a[1]=encodeURIComponent(a[1]);
			var max=5;
			if (a[2] && parseInt(a[2])>0 && parseInt(a[2])<51) max = parseInt(a[2]);
			request('https://www.googleapis.com/youtube/v3/search?part=snippet&key=AIzaSyB2Nmz6ZrK39f4GbRnB4PwjEdXOtlZwgLQ&type=video&maxResults='+max+'&q='+a[1], function (error, response, body) {

				if (error){
					err(error);
					var msg=error;
					bot.sendMessage(message, msg).catch(err);
					return;
				}
				try {
					var data = JSON.parse(body);
					var msg="";
					for (var i=0;i<data.items.length;i++){
						msg+="<https://youtu.be/"+data.items[i].id.videoId+"> "+ data.items[i].snippet.title + "\n"
					}
					bot.sendMessage(message, msg).catch(err);
				}
				catch (e){
					err(e);
				}
			})
		}
		else if (a=/^(?:yts|YTS) help$/.exec(message.content)) {
			var msg = '`yts (search term)`';
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^ow help$/.exec(message.content)) {
			var msg = '`ow (bnet id) [comp|quick] [hero name|all|winrate] [stat name]`';
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^(?:ow|OW) (\S+)(?: (comp|competitive|quick|quickplay)?(?: (\S+))?(?: (\S+))?)?$/.exec(message.content)) {
			var max=5;
			var system = "pc";
			if (a[1].search("#")<0) system="psn";
			var tag=encodeURIComponent(a[1].replace("#","-"));
			var mode="competitive-play";
			if (a[2]=="quick" || a[2]=="quickplay") mode="quick-play"
				bot.sendMessage(message, "`Loading...`", undefined , function(error,loadingMessage){
					if (error){
						err(error);
						return;
					}
					try {
						if (a[3] && a[3]=="all") {
							request('https://api.lootbox.eu/'+system+'/us/'+tag+'/'+mode+'/allHeroes/', function (error, response, body) {
								if (err){
									err(error);
									var msg=error;
									bot.updateMessage(loadingMessage, msg).catch(err);
									return;
								}
								try {
									var data = JSON.parse(body);
									var keys = Object.keys(data);
									var msg="";
									for (var i=0;i<keys.length;i++){
										msg+=keys[i]+ ": " + data[keys[i]] + "\n";
									}
									bot.updateMessage(loadingMessage, "```xl\n"+msg+"```").catch(err);
								}
								catch (e){
									err(e);
									bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
								}
							})
						}
						else if (a[3] && a[3]=="winrate") {
							var heroes= ["Genji","McCree","Pharah","Reaper","Soldier76","Tracer","Bastion","Hanzo","Junkrat","Mei","Torbjoern","Widowmaker","DVa","Reinhardt","Roadhog","Winston","Zarya","Lucio","Mercy","Symmetra","Zenyatta","Ana"];
							var promiseList = [];
							function heroData(hero){
								return new Promise(function(resolve,reject){
									request("https://api.lootbox.eu/"+system+'/us/'+tag+'/'+mode+'/hero/'+hero+"/", function (error, response, body) {

										if (error){
											reject(Error("It broke"));
										}
										try {
											var data = JSON.parse(body);
											if (data.statusCode && data.statusCode==404){
												reject(Error(data.error));
												return;
											}
											if ("GamesPlayed" in data){
												var win=0;
												var winpercent=0
												if ("GamesWon" in data) win=parseInt(data["GamesWon"]);
												if ("WinPercentage" in data) winpercent=parseInt(data["WinPercentage"]);
												resolve([hero,win,parseInt(data["GamesPlayed"]),winpercent])
											}
											else {
												resolve([hero,0,0,0]);
											}
										}
										catch (e){
											reject(e);
										}
									})
								})
							}
							for (var i=0;i<heroes.length;i++){				
								promiseList.push(heroData(heroes[i]));
							}

							Promise.all(promiseList).then(function(values){
								values.sort(function(a,b){
									/*
						var first=a[2];
						var second=b[2];
						if (first<1) first=1;
						if (second<1) second=1;
						return (b[1]/second)-(a[1]/first);*/
									return b[3]-a[3];
								})

								var chart = new Quiche('bar');
								chart.setTransparentBackground(); // Make background transparent
								chart.setLegendHidden();
								chart.setBarSpacing(0);
								chart.setBarWidth(6);
								chart.setWidth(1000);
								chart.setHeight(250);
								var playtimearray=[];
								var namearray=[];
								var chm="";
								var color="ff00ff";

								for (var j=0;j<values.length;j++){
									var heroName = decodeURIComponent(values[j][0].replace(/&#([\w]{1,3});/g,function(match,p1){
										return String.fromCharCode("0"+p1);
									}));

									playtimearray.push(values[j][3]);
									/*
						if (values[j][2]<1) playtimearray.push(0);
						else playtimearray.push(values[j][1]/values[j][2]);*/

									namearray.push(heroName);
									chm+="t"+values[j][1]+"-"+(values[j][2]-values[j][1])+","+color+",0,"+j+",9|";
								}
								chm = chm.substring(0, chm.length - 1);
								chart.addData(playtimearray, 'blah', 'FF0000');
								chart.addAxisLabels('x', namearray);    
								chart.addAxisLabels('y', [0,50,100]);

								var imageUrl = chart.getUrl(true); // First param controls http vs. https
								imageUrl+="&chtt=Hero%20winrate";
								imageUrl+="&chxs=0,"+color+",9,0,lt";
								imageUrl+='&chds=0,100';
								imageUrl+='&chg=0,50,4,0';				
								imageUrl+="&chm=" + encodeURIComponent(chm);
								//msg+=imageUrl;
								//console.log(imageUrl)
								//bot.sendMessage(message, imageUrl).catch(err);
								bot.deleteMessage(loadingMessage);
								bot.sendFile(message, imageUrl, "chart.png").catch(err);

								//var msg=JSON.stringify(values);
								//bot.sendMessage(message, imageUrl).catch(err);
							}).catch(function(error){
								err(e);
								bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
							})
						}
						else if (a[3]) {
							a[3]=a[3].charAt(0).toUpperCase()+a[3].substring(1).toLowerCase();
							if (a[3]=="Torbjorn") a[3]="Torbjoern";
							else if (a[3]=="Soldier" || a[3]=="76" || a[3]=="Soldier:76") a[2]="Soldier76";
							else if (a[3]=="Mccree") a[3]="McCree";
							else if (a[3]=="Dva" || a[3]=="D.va") a[3]="DVa";
							request('https://api.lootbox.eu/'+system+'/us/'+tag+'/'+mode+'/hero/'+a[3]+'/', function (error, response, body) {
								if (error){
									err(error);
									var msg=error;
									bot.updateMessage(loadingMessage, msg).catch(err);
									return;
								}
								try {
									var data = JSON.parse(body);
									var keys = Object.keys(data);
									if (keys.length<1){
										bot.updateMessage(loadingMessage, "Hero not found").catch(err);
									}
									if (a[4]){
										if (a[4] in data){
											var msg=a[4]+": "+data[a[4]];
										}
										else {
											var msg="Key not found";
										}
										bot.updateMessage(loadingMessage, "```xl\n"+msg+"```").catch(err);
										return;
									}
									var msg="";
									for (var i=0;i<keys.length;i++){
										msg+=keys[i]+ ": " + data[keys[i]] + "\n";
									}
									bot.updateMessage(loadingMessage, "```xl\n"+msg+"```").catch(err);
								}
								catch (e){
									bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
									err(e);
								}
							})
						}
						else if (a[2]){
							request('https://api.lootbox.eu/'+system+'/us/'+tag+'/'+mode+'/heroes', function (e, response, body) {
								if (e){
									err(e);
									bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
									return;
								}
								try {
									var data = JSON.parse(body);					
									if (data.statusCode && data.statusCode==404){
										var msg=data.error;
										bot.updateMessage(loadingMessage, msg).catch(err);
										return;
									}
									var msg="";
									var chart = new Quiche('bar');
									chart.setTransparentBackground(); // Make background transparent
									chart.setAutoScaling();
									chart.setLegendHidden();
									chart.setBarSpacing(0);
									chart.setBarWidth(6);
									chart.setWidth(1000);
									chart.setHeight(250);
									var playtimearray=[];
									var namearray=[];
									var chm="";
									var color="ff00ff";

									for (var j=0;j<data.length;j++){

										var heroName = decodeURIComponent(data[j].name.replace(/&#([\w]{1,3});/g,function(match,p1){
											return String.fromCharCode("0"+p1);
										}))
										namearray.push(heroName);
										playtimearray.push(data[j].percentage);

										chm+="t"+data[j].playtime+","+color+",0,"+j+",9|";
										//chart.addData(data[j].percentage, data[j].name, "00FF00");
										/*var keys = Object.keys(data[j]);;
							for (var i=0;i<keys.length;i++){
								//decodeURIComponent(data[j][keys[i]].replace(/&#([\w]{1,3});/g,"\$1"))
								if (keys[i]=="image") continue;
								else if (keys[i]=="name") msg+=decodeURIComponent(data[j][keys[i]].replace(/&#([\w]{1,3});/g,function(match,p1){
									return String.fromCharCode("0"+p1);
								})) + "\n";
								else if (keys[i]=="percentage") {
									msg+=keys[i]+ ": " + data[j][keys[i]]*100 + "%\n";
								}
								else msg+=keys[i]+ ": " + data[j][keys[i]] + "\n";
							}*/
									}
									chm = chm.substring(0, chm.length - 1);
									chart.addData(playtimearray, 'blah', 'FF0000');     
									chart.addAxisLabels('x', namearray);

									var imageUrl = chart.getUrl(true); // First param controls http vs. https
									imageUrl+="&chtt=Hero%20playtime";
									imageUrl+="&chxs=1,"+color+",9,0,lt";
									imageUrl+="&chm=" + encodeURIComponent(chm);
									//msg+=imageUrl;
									//console.log(imageUrl)
									bot.deleteMessage(loadingMessage);
									bot.sendFile(message, imageUrl, "chart.png").catch(err);
								}
								catch (e){
									err(e);
									bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
								}
							})
						}
						else {
							request('https://api.lootbox.eu/'+system+'/us/'+tag+'/profile', function (e, response, body) {	
								if (e){
									err(e);
									bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
									return
								}
								try{
									var data = JSON.parse(body);	
									if (data.statusCode && data.statusCode==404){
										var msg=data.error;
										bot.updateMessage(loadingMessage, msg).catch(err);
										return;
									}
									var keys = Object.keys(data);
									if (keys.length<1 || !"data" in data){
										bot.updateMessage(loadingMessage, "No data").catch(err);
										return;
									}
									var dataString = ""
										function getData(obj,num){
										var keys = Object.keys(obj);
										for (var i=0;i<keys.length;i++){
											dataString+="\n"+" ".repeat(num*3)+keys[i];
											if (typeof(obj[keys[i]])=="object") getData(obj[keys[i]],num+1);
											else if (typeof(obj[keys[i]])=="string" && obj[keys[i]].indexOf("http")>-1) dataString+=": <" + obj[keys[i]]+">";
											else dataString+=": " + obj[keys[i]];
										}
									}
									getData(data.data,0);
									bot.updateMessage(loadingMessage, "```xl\n"+dataString.substring(1)+"```").catch(err);
								}
								catch(e){
									err(e);
									bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
								}
							})
						}
					}
					catch(e){
						err(e);
						bot.updateMessage(loadingMessage, "`Error. Check the logs.`").catch(err);
					}
				})
		}
		else if (a=/^!play ([^\n\r]+?)(?: (\d{1,6}))?(?: (\d{1,6}))?(?: (\d{1,3}))?$/.exec(message.content)) {
			request.head(a[1], function (error, response, body) {
				if (error) {
					err(error)
					return;
				}
				try{
					if (response.headers['content-type'].indexOf("audio")>-1 || response.headers['content-type'].indexOf("video")>-1) {
						var channel = getFirstVoiceChannel(message.channel.server,message.author.id);
						if (channel){
							playSound(channel,a[1],parseInt(a[2]),parseInt(a[3]),parseInt(a[4]))

							/*bot.joinVoiceChannel(channel,function(err,conn){
						if (err) console.log("joinVoiceChannel e",err)
						var volume=.3;
						var start = 0;
						var duration = null

						if (a[4] && parseInt(a[4])>0) duration = parseInt(a[4]);
						if (a[2] && parseInt(a[2])<101 && parseInt(a[2])>0) volume=parseInt(a[2])/100
						if (a[3] && parseInt(a[3])>0) start=parseInt(a[3])
						//conn.playArbitraryFFmpeg(options, function(err, intent){
						conn.playFile(a[1], {volume:volume, seek: start}, function(error, intent){
							if (error) err(error);
							bot.setPlayingGame(a[1]).catch(err)

							if (duration !==null){
								intent.on("time", function(t){
									if (duration !==null && t>duration*1000) conn.destroy();
								})
							}
							intent.on("end", function(){
								bot.setPlayingGame("nothing").catch(err)
								//conn.destroy();
								bot.leaveVoiceChannel(conn.voiceChannel).catch(err)
							})
							intent.on("error", function(t){
								console.log("error",t)
							})
						})
					})*/
						} else {
							bot.sendMessage(message, "`No voice channel.`").catch(err);
						}
					}
					else bot.sendMessage(message, "`Not a video. "+response.headers['content-type']+"`").catch(err);
				}
				catch(e){
					err(e)
				}
			})
		}
		/*
	else if (a=/^(?:play|PLAY) .*?$/.exec(message.content)) {
		var msg = '`play (url) [volume 0-100] [start in seconds] [duration in seconds]`';
		bot.sendMessage(message, msg).catch(err);
	}*/
		else if (a=/^(addmeme|memeadd) help$/.exec(message.content)) {
			var msg = '`addmeme (copypasta)`';
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^addmeme ([\s\S]+)$/.exec(message.content)) {
			fs.appendFileSync("copypasta.txt", "\x0d\x0a\x0d\x0a\x20\x0d\x0a\x0d\x0a"+a[1], 'utf8')
			copypasta.push(a[1]);
			var msg="added meme " + (copypasta.length-1);
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^(?:searchmeme|memesearch) help$/.exec(message.content)) {
			var msg = '`searchmeme (search string)`';
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^searchmeme ([^\n\r]+?)$/.exec(message.content)) {
			var copylist=[];
			for (var n=0;n<copypasta.length;n++){
				if (copypasta[n].indexOf(a[1])>-1) {
					copylist.push(n);
				}
			}
			var msg="`None found`";
			if (copylist.length===1){
				msg = copylist[0] + "\n";
				msg += copypasta[copylist[0]];
			}
			else if (copylist.length>1){
				msg = "`Multiple memes found: ";
				for (var m=0;m<copylist.length;m++){
					msg+=copylist[m] + " ";
				}
				msg+="`";
			}
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^meme ([\d]+?)$/.exec(message.content)) {
			a[1]=parseInt(a[1]);
			var msg="";
			if (a[1]>=copypasta.length) msg="`Meme overload. Max meme is " + (copypasta.length-1) + "`";
			else msg=copypasta[a[1]];
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^translate ([^\r\n]+?)$/.exec(message.content)) {
			a[1]=encodeURIComponent(a[1]);
			request('https://api.betterttv.net/2/translate?target=en&q='+a[1], function (error, response, body) {
				if (error){
					err(error);
					var msg=err;
					bot.sendMessage(message, msg).catch(err);
					return;
				}
				try {
					var data = JSON.parse(body);
					var msg="";
					if (data.translation) msg = data.translation;
					else if (data.message) msg = data.message;
					else msg=body;
					bot.sendMessage(message, msg).catch(err);
				}
				catch (e){
					err(e);
				}
			})
		}
		else if (a=/^song search ([^\r\n]+?)$/.exec(message.content)) {
			Deezer.search(encodeURIComponent(a[1]),"track",function(error,res){
				if (error){
					return err(error);
				}
				//console.log(res);
				try {
					if (res.data.length<1) {
						bot.sendMessage(message, "`No results.`").catch(err);
						return;
					}

					var msg="```";
					for (var i=0;i<res.data.length;i++){
						var append = ""+(i+1)+": " + res.data[i].title+" — "+res.data[i].artist.name +"\n";
						if ((msg.length+append.length)>1997) break;
						msg += append;
					}
					msg+="```";
					bot.sendMessage(message, msg).catch(err);

					if (runningProcess[message.channel.server]==null || runningProcess[message.channel.server].important===false) {
						runningProcess[message.channel.server] = new CustomCommand(/^(\d+)$/,function(message){
							try {
								var num = parseInt(message.content);
								if (num<res.data.length+1 && num>0){


									var chan = getFirstVoiceChannel(message.channel.server,message.author.id);
									//var stream = streamifier.createReadStream(buffer);
									//playSound(chan, res.data[num-1].preview,10);


									Deezer.getTrack(res.data[num-1].id,function(error,res2){
										if (error) return err(error);
										/*
								Deezer.decryptTrack(res2,function(error,buffer){
									if (error) return err(error);
									var chan = getFirstVoiceChannel(message.channel.server,message.author.id);
									var stream = streamifier.createReadStream(buffer);
									playSound(chan, stream,10);
								})*/
										Deezer.decryptTrackStream(res2,function(error,stream){
											if (error) return err(error);
											var chan = getFirstVoiceChannel(message.channel.server,message.author.id);
											//var stream = streamifier.createReadStream(buffer);
											playSound(chan, stream,10);
										})

									})
								}
							}
							catch (e){
								err(e)
							}
						})
					}
					else {
						bot.sendMessage(message, "`Something else important is running.`").catch(err);
					}
				}
				catch (e){
					err(e);
				}
			})
		}
		else if (a=/^song trivia ([^\r\n]+)$/.exec(message.content)) {
			Deezer.search(encodeURIComponent(a[1]),"track",function(error,res){
				if (error) return err(error);
				try {
					if (res.data.length<1) {
						bot.sendMessage(message, "`No results.`").catch(err);
						return;
					}

					var msg="```";
					for (var i=0;i<res.data.length;i++){
						var append = ""+(i+1)+": " + res.data[i].title+" — "+res.data[i].artist.name+"\n";
						if ((msg.length+append.length)>1997) break;
						msg += append;
					}
					msg+="```";
					bot.sendMessage(message, msg).catch(err);
					if (runningProcess[message.channel.server]==null || runningProcess[message.channel.server].important===false) {
						runningProcess[message.channel.server] = new CustomCommand(/^(\d+)$/,function(message){
							try {
								var num = parseInt(message.content);
								var voice = getFirstVoiceChannel(message.channel.server,message.author.id);
								if (num<res.data.length+1 && num>0 && voice!=null){
									Deezer.getArtistRadio(res.data[num-1].artist.id,function(error,res2){
										runningProcess[message.channel.server] = new SongTrivia(message.channel,voice,res2.data,bot);
									})
								}
							}
							catch (e){
								err(e)
							}
						})
					}
					else {
						bot.sendMessage(message, "`Something else important is running.`").catch(err);
					}
				}
				catch (e){
					err(e)
				}
			})
		}
		else if (a=/^song trivia$/.exec(message.content)) {
			Deezer.getRadioList(function(error,res){
				if (error) return err(error);
				try {
					if (res.data.length<1) {
						bot.sendMessage(message, "`No results.`").catch(err);
						return;
					}

					var msg="```";
					for (var i=0;i<res.data.length;i++){
						var append = ""+(i+1)+": " + res.data[i].title+"\n";
						if ((msg.length+append.length)>1997) break;
						msg += append;
					}
					msg+="```";
					bot.sendMessage(message, msg).catch(err);
					if (runningProcess[message.channel.server]==null || runningProcess[message.channel.server].important===false) {
						runningProcess[message.channel.server] = new CustomCommand(/^(\d+)$/,function(message){
							var num = parseInt(message.content);
							var voice = getFirstVoiceChannel(message.channel.server,message.author.id);
							if (num<res.data.length+1 && num>0 && voice!=null){
								Deezer.getRadio(res.data[num-1].id,function(error,res2){
									runningProcess[message.channel.server] = new SongTrivia(message.channel,voice,res2.data,bot);
								})
							}
						})
					}
					else {
						bot.sendMessage(message, "`Something else important is running.`").catch(err);
					}
				}
				catch (e){
					err(e)
				}
			})
		}
		else if (a=/^jonio/.exec(message.content)) {
			var msg="link to jonio archives";
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^ping$/.exec(message.content)) {
			var msg="pong";
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^volume$/.exec(message.content)) {
			for (var i = 0;i<bot.voiceConnections.length;i++){
				if (bot.voiceConnections[i].voiceChannel.server.equals(message.channel.server)){
					var msg="Volume is at "+bot.voiceConnections[i].getVolume()*100;
					bot.sendMessage(message, msg).catch(err);
					return;
				}
			}
			var msg="`Voice connection not found`";
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^(?:volume|setvolume) (\d{1,3})$/.exec(message.content)) {
			if (a[1] && parseInt(a[1])>0 && parseInt(a[1])<101){
				for (var i = 0;i<bot.voiceConnections.length;i++){
					if (bot.voiceConnections[i].voiceChannel.server.equals(message.channel.server)){
						bot.voiceConnections[i].setVolume(parseInt(a[1])/100);
						return;
					}
				}
				var msg="`Voice connection not found`";
				bot.sendMessage(message, msg).catch(err);
			}
			else {
				var msg="`" + a[1] + " is not a valid parameter.`";
				bot.sendMessage(message, msg).catch(err);
			}
		}
		else if (message.content.toLowerCase().indexOf("dat boi")>-1) {
			var msg="o shit waddup!";
			bot.sendMessage(message, msg).catch(err);
		}
		else if (message.content.toLowerCase().indexOf("stop")>-1) {
			//stop music
			if (runningProcess[message.channel.server]!=null && runningProcess[message.channel.server].important) return;
			for (var i = 0;i<bot.voiceConnections.length;i++){
				if (bot.voiceConnections[i].voiceChannel.server.equals(message.channel.server)){
					bot.voiceConnections[i].destroy();
					return;
				}
			}
		}
		else if (a=/^voicechannelid$/.exec(message.content)) {
			//stop music
			var channel = getFirstVoiceChannel(message.channel.server);
			var msg = channel.id
			bot.sendMessage(message,msg).catch(err)
		}
		else if (message.content.toLowerCase().indexOf("animal")>-1) {
			bot.sendFile(message, "html/animalgifs/"+Math.floor(Math.random()*61+1)+".gif").catch(err);
		}
		else if (message.content.toLowerCase().indexOf("meme")>-1) {
			var msg=copypasta[Math.floor(Math.random()*copypasta.length)];
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^(cmds|commands)$/.exec(message.content)) {
			if (message.author.id!==main) return;
			function longstring(){/*yts (search term)
pt (search term) [online] [number of search results 1-20]
yt (youtube id or link) [volume 1-100] [start in seconds] [duration in seconds]
ow (bnet id) [comp|quick] [hero name|all|winrate] [stat name]
addmeme (meme string)
searchmeme (search string)
translate (string)
meme (number)
play (url) [volume 0-100] [start in seconds] [duration in seconds]
volume (0-100)
volume
ping
dat boi
jonio
stop
animal
meme*/}
			var msg=longstring.toString().substring(24,longstring.toString().length-3);
			bot.sendMessage(message, msg).catch(err);
		}
		else if (a=/^botlink$/.exec(message.content)) {
			if (message.author.id!==main) return;
			var msg="link to inviting bot";
			bot.sendMessage(message, msg).catch(err);			
		}
		else if (a=/^(whens|when's|when is|when are).+$/.exec(message.content.toLowerCase())) {
			var msg="never";
			bot.sendMessage(message, msg).catch(err);
		}
		else if(message.content === "ping") {
			bot.sendMessage(message.channel, "pong");
		}
	}
	catch (e){
		err(e);
	}
});

var spotify = new Spotify();

bot.on("ready", function(){
	bot.setPlayingGame("nothing").catch(err);
	console.log("ready");
	bot.sendMessage(botChannel,"`ready`").catch(err)
})

function err(error){
	bot.sendMessage(errorChannel, error.stack,function(e){
		console.log(error.stack);
		console.log(e.stack);
		console.log("maybe missing bot channel");
	})
}

bot.loginWithToken(botToken).catch(err);