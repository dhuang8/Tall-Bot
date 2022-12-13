"use strict";
const Discord = require('discord.js');
const rp = require('request-promise');
const moment = require('moment-timezone');
/*
  query promotionsQuery($namespace: String!, $country: String!, $locale: String!) {
	Catalog {
	  catalogOffers(namespace: $namespace, locale: $locale, params: {category: "freegames", country: $country, sortBy: "effectiveDate", sortDir: "asc"}) {
		elements {
		  title
		  description
		  id
		  namespace
		  categories {
			path
		  }
		  keyImages(type: DieselStoreFrontTall) {
			type
			url
		  }
		  productSlug
		  promotions {
			promotionalOffers {
			  promotionalOffers {
				startDate
				endDate
				discountSetting {
				  discountType
				  discountPercentage
				}
			  }
			}
			upcomingPromotionalOffers {
			  promotionalOffers {
				startDate
				endDate
				discountSetting {
				  discountType
				  discountPercentage
				}
			  }
			}
		  }
		}
	  }
	}
  }
*/
function err(error, loadingMessage, content) {
	if (config.errorChannelID) {
		bot.channels.resolve(config.errorChannelID).send(`${error.stack}`, {
			code: true,
			split: true,
			reply: config.adminID || null
		}).catch(function (e) {
			console.error(error.stack);
			console.error(e.stack);
			console.error("maybe missing bot channel");
		})
		if (loadingMessage != null) loadingMessage.edit(content).catch(err)
	} else {
		console.error(error);
	}
}

class EpicStore {
	constructor(bot, sql, error_channel) {
		try {
			this.sql = sql;
			sql.prepare("CREATE TABLE IF NOT EXISTS channels (channel_id TEXT PRIMARY KEY NOT NULL, disable BOOLEAN DEFAULT false, egs BOOLEAN DEFAULT false) WITHOUT ROWID;").run();
			this.bot = bot
			this.error_channel = error_channel;
			this.lastlist = [];
			this.__setup(true);
		} catch (e) {
			console.error(e);
		}
	}

	async __setup(firsttime = false) {
		let gamelist = await this.__getList();
		let curtime = new Date();
		let isnew = gamelist.curlist.some(game => {
			return this.lastlist.indexOf(game.title) < 0;
		})
		if (isnew && !firsttime) {
			let channels = this.sql.prepare("SELECT channel_id FROM channels WHERE egs=1").all();
			let rich = this.createRich(gamelist);
			let sub = this;
			channels.forEach(channel => {
				sub.bot.channels.resolve(channel.channel_id).send(rich).catch(err);
			})
		}
		let waittime = 0;
		if (gamelist.upcominglist.length > 0) {
			waittime = gamelist.upcominglist[0].start.valueOf() - curtime.valueOf()
		}
		//add an extra 10 minutes just in case
		waittime = waittime + 60 * 1000 * 10
		//minimum 10 minutes, maximum 1 week
		waittime = Math.max(600000, waittime)
		waittime = Math.min(60000 * 60 * 24 * 7, waittime)
		this.lastlist = gamelist.curlist.map(game => {
			return game.title;
		})
		setTimeout(() => {
			this.__setup(false);
		}, waittime)
	}

	async list() {
		let gamelist = await this.__getList();
		return this.createRich(gamelist)
	}

	createRich(gamelist) {
		let rich = new Discord.RichEmbed()
			.setTitle("Free Epic Game Store games")
			.setURL("https://www.epicgames.com/store/en-US/free-games")
		if (gamelist.curlist.length > 0) {
			let desc = gamelist.curlist.map(cur => {
				return `[${cur.title}](${cur.url}) — ends ${cur.end.fromNow()}`
			}).join("\n");
			rich.addField("Current free games", desc)
		}
		if (gamelist.upcominglist.length > 0) {
			let desc = gamelist.upcominglist.map(cur => {
				return `[${cur.title}](${cur.url}) — begins ${cur.start.fromNow()}`
			}).join("\n");
			rich.addField("Upcoming free games", desc)
		}
		/*
		if (gamelist.unknownlist.length > 0) {
		    let desc = gamelist.unknownlist.map(cur=>{
		        return `[${cur.title}](${cur.url})`
		    }).join("\n");
		    rich.addField("Unknown", desc)
		}*/
		return rich;
	}

	async on(channel_id) {
		let stmt = this.sql.prepare("INSERT INTO channels(channel_id,egs) VALUES (?,?) ON CONFLICT(channel_id) DO UPDATE SET egs=excluded.egs;")
		stmt.run(channel_id, 1);
		return `\`EGS updates will now be posted to this channel.\``
	}

	async off(channel_id) {
		let stmt = this.sql.prepare("INSERT INTO channels(channel_id,egs) VALUES (?,?) ON CONFLICT(channel_id) DO UPDATE SET egs=excluded.egs;")
		stmt.run(channel_id, 0);
		return `\`EGS updates will no longer be posted to this channel.\``
	}

	async __getList() {
		let qr = `
        query searchStoreQuery($allowCountries: String, $category: String, $count: Int, $country: String!, $keywords: String, $locale: String, $namespace: String, $sortBy: String, $sortDir: String, $start: Int, $tag: String, $withPrice: Boolean = false, $withPromotions: Boolean = false) {
            Catalog {
              searchStore(allowCountries: $allowCountries, category: $category, count: $count, country: $country, keywords: $keywords, locale: $locale, namespace: $namespace, sortBy: $sortBy, sortDir: $sortDir, start: $start, tag: $tag) {
                elements {
                  title
                  keyImages {
                    type
                    url
                  }
                  productSlug
                  urlSlug
                  price(country: $country) @include(if: $withPrice) {
                    lineOffers {
                      appliedRules {
                        id
                      }
                    }
                  }
                  promotions(category: $category) @include(if: $withPromotions) {
                    promotionalOffers {
                      promotionalOffers {
                        startDate
                        endDate
                        discountSetting {
                          discountType
                          discountPercentage
                        }
                      }
                    }
                    upcomingPromotionalOffers {
                      promotionalOffers {
                        startDate
                        endDate
                        discountSetting {
                          discountType
                          discountPercentage
                        }
                      }
                    }
                  }
                }
              }
            }
          }`;
		let vr = {
			"category": "freegames",
			"sortBy": "effectiveDate",
			"sortDir": "asc",
			"count": 1000,
			"country": "US",
			"allowCountries": "US",
			"locale": "en-US",
			"withPrice": true,
			"withPromotions": true
		};
		let body = {
			"query": qr,
			"variables": vr
		}
		let response = await rp({
			url: "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=US&allowCountries=US",
			//            url: "https://www.epicgames.com/store/backend/graphql-proxy",
			json: true
		})
		let curlist = [];
		let upcominglist = [];
		let unknownlist = [];
		response.data.Catalog.searchStore.elements.forEach(ele => {
			let image = ele.keyImages.find(keyImage => {
				return keyImage.type == "DieselStoreFrontTall"
			})
			if (image) {
				image = image.url
			} else {
				image = null;
			}

			let url = getUrl();
			//ele.productSlug
			function getUrl() {
				if (ele.offerMappings?.length > 0) return `https://www.epicgames.com/store/en-US/p/${ele.offerMappings[0].pageSlug}`
				if (ele.catalogNs?.mappings?.length > 0) {
					let cat = ele.catalogNs.mappings.find(cat => {
						return cat.pageType == "productHome"
					})
					return `https://www.epicgames.com/store/en-US/p/${cat.pageSlug}`
				}
				if (ele.categories?.some((cat) => {
					return cat.path == "bundles"
				})) {
					return `https://www.epicgames.com/store/en-US/bundles/${ele.productSlug}`
				}
				return "";
			}

			function check(offers, thislist) {
				return thislist.concat(offers.flatMap(offer=>{
					return offer.promotionalOffers;
				}).filter(promo => {
					return promo.discountSetting?.discountType === 'PERCENTAGE' && promo.discountSetting?.discountPercentage === 0;
				}).map(promo => {
					return {
						title: ele.title,
						image: image,
						url,
						start: moment(promo.startDate),
						end: moment(promo.endDate)
					}
				}))
			}
			if (ele.promotions != null) {
				curlist = check(ele.promotions.promotionalOffers, curlist);
				upcominglist = check(ele.promotions.upcomingPromotionalOffers, upcominglist);
			} else {
				unknownlist.push({
					title: ele.title,
					image: image,
					url
				})
			}
		})
		curlist.sort((a, b) => {
			return a.end.isSameOrAfter(b.end);
		})
		upcominglist.sort((a, b) => {
			return a.start.isSameOrAfter(b.start);
		})
		return {
			curlist,
			upcominglist,
			unknownlist
		};
	}
}
module.exports = EpicStore;