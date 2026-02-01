import { request, timeOnNext } from '../functions.js';
import { ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageCreateOptions } from 'discord.js';
import { HoyoClient, HoyoEvent, Resource, User, hoyoPost, nextBimonthly, nextWeekly } from './HoyoClient.ts';
import { getPosts } from './HoyoClient.ts';
import { hoyoRequest } from './HoyoClient.ts';
import { crossIfTrue } from "./HoyoClient.ts";
import zzzBc from '../../alarms/zzz/zzz-bc.ts';
import zzzDaily from '../../alarms/zzz/zzz-daily.ts';
import zzzWeekly from '../../alarms/zzz/zzz-weekly.ts';
import zzzShiyuDefense from '../../alarms/zzz/zzz-shiyu-defense.ts';
import fs from 'fs';


let zzzCharIdToName: { [key: number]: string; } = {};
let zzzCharNameToId: { [key: string]: number; } = {};
let zzzBangbooMap: { [key: number]: string; } = {};

async function updateCharMap() {
    const body = await request("https://api.hakush.in/zzz/data/character.json") as { [key: string]: { EN: string } };
    Object.entries(body).forEach(entry => {
        zzzCharIdToName[parseInt(entry[0])] = entry[1].EN
        zzzCharNameToId[entry[1].EN] = parseInt(entry[0])
    })
}

async function updateBangbooMap() {
    const body = await request("https://api.hakush.in/zzz/data/bangboo.json") as { [key: string]: { EN: string } };
    Object.entries(body).forEach(entry => {
        zzzBangbooMap[parseInt(entry[0])] = entry[1].EN
    })
}

async function getCharNameFromId(id: number) {
    if (zzzCharIdToName[id]) return zzzCharIdToName[id];
    await updateCharMap();
    if (zzzCharIdToName[id]) return zzzCharIdToName[id];
    return `Unknown (${id})`;
}

async function getIdFromCharName(name: number) {
    if (zzzCharNameToId[name]) return zzzCharNameToId[name];
    await updateCharMap();
    if (zzzCharNameToId[name]) return zzzCharNameToId[name];
    return `Unknown (${name})`;
}

async function getBangbooNameFromId(id: number) {
    if (zzzBangbooMap[id]) return zzzBangbooMap[id];
    await updateBangbooMap();
    if (zzzBangbooMap[id]) return zzzBangbooMap[id];
    return `Unknown (${id})`;
}

updateCharMap();
updateBangbooMap();

class characterCdf {
    scores: Uint32Array[] = [];
    cdf: Float64Array[] = [];
    character_scores: { [key: string]: number; };
    constructor(file_path: string) {
        let json = JSON.parse(fs.readFileSync(file_path, "utf-8"));
        // console.log(json);
        for (let i=0; i<json.serialized.length; i++) {
            let {scores, cdf} = json.serialized[i];
	        let bytes = new Uint8Array(Buffer.from(scores, 'base64'));
	        this.scores[i] = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
	        bytes = new Uint8Array(Buffer.from(cdf, 'base64'));
	        this.cdf[i] = new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
        }
        this.character_scores = json.char_score;
    }

    getMinScore(slot: number) {
        return this.scores[slot][this.scores[slot].length - 1];
    }

    getMaxScore(slot: number) {
        return this.scores[slot][0];
    }

	getCdf(slot: number, dd: {
        main_properties: { property_id: number, level: number }[],
        properties: { property_id: number, level: number }[]
    }) {
        let main_score = this.character_scores[dd.main_properties[0].property_id] ?? 0;
        let dd_score = main_score*10;
        for (let prop of dd.properties) {
            let sub_score = this.character_scores[prop.property_id] ?? 0;
            dd_score += sub_score*prop.level;
        }
		let left = 0, right = this.scores[slot].length - 1;
		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			if (this.scores[slot][mid] <= dd_score) {
				right = mid - 1;
			} else {
				left = mid + 1;
			}
		}
		let chance = left < this.scores[slot].length ? this.cdf[slot][left] : 1;
        // console.log("score", dd_score, "chance", chance, "slot", slot, "left", left);
        return {
            cost: 288/chance,
            score: (dd_score-this.getMinScore(slot))*100/(this.getMaxScore(slot)-this.getMinScore(slot))
        };
	}
}

export class ZzzClient extends HoyoClient {
    bc?: ZzzBattleChronicle;
    hz?: ZzzHollowZero;
    cn?: ZzzCriticalNode;
    da?: ZzzDeadlyAssault;
    events?: HoyoEvent[];
    signIn?: { checked: boolean; };

    constructor(user_id: string) {
        super({
            discord_id: user_id,
            root_url: "https://sg-public-api.hoyolab.com/event/game_record_zzz/api/zzz/"
        })
    }

    getUid(user: User): number {
        return user.zzz_uid;
    }

    static listCharacters() {
        return zzzCharNameToId;
    }

    static getCharacterId(name: string) {
        return zzzCharNameToId[name];
    }

    static loadCharacterCdf(path: string) {
        return new characterCdf(path);
    }

    async dailySignIn() {
        const response = await hoyoPost(`https://sg-public-api.hoyolab.com/event/luna/zzz/os/sign`, this.cookie, {
            act_id: "e202406031448091",
            lang: "en-us"
        }, {
            "x-rpc-signgame": "zzz"
        });
        return response;
    }

    async dailyInfo() {
        const response = await hoyoRequest(`https://sg-public-api.hoyolab.com/event/luna/zzz/os/info?lang=en-us&act_id=e202406031448091`, this.cookie, {
            "x-rpc-signgame": "zzz",
        });
        this.signIn = { checked: response.is_sign };
        return this.signIn;
    }

    async battleChronicle(): Promise<ZzzBattleChronicle> {
        let cur = Math.floor(Date.now() / 1000);
        const response: {
			abyss_refresh: number,
            bounty_commission: {
                num: number,
 				total: number,
                refresh_time: number,
            },
            card_sign: "CardSignNo" | "CardSignDone",
			coffee: null,
            energy: {
                progress: {
                    max: number;
                    current: number;
                };
                restore: number;
            };
			survey_points: null,
            temple_running: {
                currency_next_refresh_ts: string,
                current_currency: number;
                weekly_currency_max: number;
            }
            vitality: {
                max: number;
                current: number;
            };
            vhs_sale: {
                sale_state: "SaleStateDone" | "SaleStateNo" | "SaleStateDoing";
            },
            weekly_task: {
                cur_point: number;
                max_point: number;
                refresh_time: number;
            } | null
        } = await hoyoRequest(this.root_url + `note?server=prod_gf_us&role_id=${this.uid}`, this.cookie);
        this.bc = {
            battery_charge: {
                current: response.energy.progress.current,
                max: response.energy.progress.max,
                recovery_time: cur + response.energy.restore,
            },
            daily: {
                engagement: {
                    current: response.vitality.current,
                    max: response.vitality.max,
                },
                scratch_card: {
                    current: response.card_sign == "CardSignDone" ? 1 : 0,
                    max: 1
                },
                video_store: {
                    current: response.vhs_sale.sale_state === "SaleStateDoing" ? 1 : 0,
                    max: 1
                },
                recovery_time: timeOnNext(24 * 60 * 60, 9 * 60 * 60)
            },
            weekly: {
				weekly_points: {
					current: response.weekly_task?.cur_point ?? 0,
					max: response.weekly_task?.max_point ?? 1300,
				},
				bounty_commission: {
					current: response.bounty_commission.num,
					max: response.bounty_commission.total
				},
                recovery_time: response.weekly_task ? cur + response.weekly_task.refresh_time : timeOnNext(7*24*60*60, 9*60*60+4*24*60*60),
            },
            omnicoins: {
                current: response.temple_running.current_currency,
                max: response.temple_running.weekly_currency_max,
                recovery_time: cur + parseInt(response.temple_running.currency_next_refresh_ts),
            }
        };
        zzzBc.updateNextTime(this.discord_id, this.bc.battery_charge.recovery_time);
        if (this.bc.daily.engagement.current >= this.bc.daily.engagement.max 
                && this.bc.daily.scratch_card.current >= this.bc.daily.scratch_card.max 
                && this.bc.daily.video_store.current >= this.bc.daily.video_store.max)
            zzzDaily.setInactive(this.discord_id);
		if (this.bc.weekly.bounty_commission.current >= this.bc.weekly.bounty_commission.max 
				&& this.bc.weekly.weekly_points.current >= this.bc.weekly.weekly_points.max)
			zzzWeekly.setInactive(this.discord_id);
        return this.bc;
    }

    async lostVoid() {
        let cur = Math.floor(Date.now() / 1000);
        const response: {
            abyss_duty: {
                cur_duty: number;
                max_duty: number;
            } | null;
            refresh_time: number;
        } = await hoyoRequest(this.root_url + `abysss2_abstract?server=prod_gf_us&role_id=${this.uid}`, this.cookie);
        return response;
    }

    async witheredDomain() {
        let cur = Math.floor(Date.now() / 1000);
        const response: {
            abyss_duty: {
                cur_duty: number;
                max_duty: number;
            } | null;
            abyss_point: {
                cur_point: number;
                max_point: number;
            };
            refresh_time: number;
        } = await hoyoRequest(this.root_url + `abyss_abstract?server=prod_gf_us&role_id=${this.uid}`, this.cookie);
        return response;
    }

    async hollowZero(): Promise<ZzzHollowZero> {
        let cur = Math.floor(Date.now() / 1000);
        let [lv, wd] = await Promise.all([this.lostVoid(), this.witheredDomain()]);
        let recovery_time = lv.refresh_time || wd.refresh_time;
        if (recovery_time == 0) {
            recovery_time += cur;
        } else {
            recovery_time = nextWeekly();
        }
        this.hz = {
            commission: {
                cur: lv.abyss_duty?.cur_duty ?? wd.abyss_duty?.cur_duty ?? 0,
                max: lv.abyss_duty?.max_duty ?? wd.abyss_duty?.max_duty ?? 4
            },
            // investigation: {
            //     cur: response.abyss_point.cur_point,
            //     max: response.abyss_point.max_point
            // },
            recovery_time
        };
        if (this.hz.commission.cur >= this.hz.commission.cur) zzzWeekly.setInactive(this.discord_id);
        return this.hz;
    }

    async newShiyu(type: number = 1): Promise<ZzzCriticalNode> {
        const response: {
            hadal_info_v2: {
                brief: {
                    max_score: number,
                    rank_percent: number,
                    rating: string,
                    score: number
                },
                begin_time: string,
                end_time: string,
                fitfh_layer_detail: null | {
                    layer_challenge_info_list: {
                        avatar_list: {
                            avatar_profession: number,
                            element_type: number,
                            id: number,
                            level: number,
                            rank: number,
                            rarity: string,
                            sub_element_type: number
                        }[],
                        battle_time: number,
                        buddy: {
                            id: number,
                            level: number,
                            rarity: string
                        },
                        buffer: {
                            title: string,
                            text: string
                        },
                        max_score: number,
                        rating: string,
                        score: number,
                    }[]
                },
                hadal_end_time: {
                    year: number,
                    month: number,
                    day: number,
                    hour: number,
                    minute: number,
                    second: number
                },
                pass_fifth_floor: boolean
            }
        } = await hoyoRequest(this.root_url + `hadal_info_v2?server=prod_gf_us&role_id=${this.uid}&schedule_type=${type}`, this.cookie);
        if (!response.hadal_info_v2.fitfh_layer_detail) {
            this.cn = {
                recovery_time: parseInt(response.hadal_info_v2.end_time),
                score: 0
            }
            return this.cn;
        };
        const nodes = await Promise.all(response.hadal_info_v2.fitfh_layer_detail.layer_challenge_info_list.map(async node => {
            return {
                team: {
                    chars: await Promise.all(node.avatar_list.map(async char => {
                        return {
                            level: char.level,
                            name: await getCharNameFromId(char.id),
                            cinema: char.rank
                        };
                    })),
                    bangboo: {
                        name: await getBangbooNameFromId(node.buddy.id),
                        level: node.buddy.level
                    }
                },
                buff: node.buffer.title,
                score: node.score,
            }
        }))
        this.cn = {
            recovery_time: parseInt(response.hadal_info_v2.end_time),
            score: response.hadal_info_v2.brief.score,
            rating: response.hadal_info_v2.brief.rating,
			top: response.hadal_info_v2.brief.rank_percent/100,
            nodes
        };
        if (this.cn.score >= 100_000) zzzShiyuDefense.setInactive(this.discord_id);
        return this.cn;
    }

    async deadass(type: number = 1): Promise<ZzzDeadlyAssault> {
        const response: {
            end_time: {
                year: number,
                month: number,
                day: number,
                hour: number,
                minute: number,
                second: number
            },
			list: {
				avatar_list: {
					id: number,
					level: number,
					rank: number
				}[],
				boss: {
					name: string
				}[],
				buddy: {
					id: number,
					level: number
				},
				buffer: {
					name: string
				}[],
				score: number,
				star: 3,
				total_star: 3
			}[],
			rank_percent: number,
			total_score: number,
			total_star: number
        } = await hoyoRequest(this.root_url + `mem_detail?region=prod_gf_us&uid=${this.uid}&schedule_type=${type}`, this.cookie);
		let end_time = response.end_time;
        let recovery_time = end_time ? new Date(end_time.year, end_time.month - 1, end_time.day, end_time.hour + 5, end_time.minute).getTime() / 1000 : timeOnNext(7*24*60*60*2, 9*60*60+8*24*60*60);
        const floors = await Promise.all(response.list.map(async node => {
			let boss = node.boss[0].name;
			let bangboo = {
				name: await getBangbooNameFromId(node.buddy.id),
				level: node.buddy.level
			}
			let buff = node.buffer[0].name;
			let chars = await Promise.all(node.avatar_list.map(async char => {
				return {
					level: char.level,
					name: await getCharNameFromId(char.id),
					cinema: char.rank
				}
			}))
			return {
				score: node.score,
				stars: {
					cur: node.star,
					max: node.total_star
				},
				boss,
				team: {
					chars,
					bangboo
				},
				buff
			}
        }));
        this.da = {
			stars: {
				// total_star might be the max or cur idk
				cur: response.total_star,
				max: 9
			},
			score: response.total_score,
			top: response.rank_percent/100,
			recovery_time,
			nodes: floors,

        };
        return this.da;
    }

    async actCalendar() {
        const response: {
            activity_list: {
                activity_id: number,
                end_ts: number,
                left_end_ts: number,
                left_start_ts: number,
                monochrome_cnt: number,
                monochrome_got_cnt: number,
                name: string,
                start_ts: number,
                state: "STATE_IN_PROGRESS" | "STATE_NOT_START" | "STATE_COMPLETED"
            }[]
        } = await hoyoRequest(this.root_url + `activity_calendar?region=prod_gf_us&uid=${this.uid}`, this.cookie);
        let now = Math.floor(Date.now() / 1000);
        this.events = response.activity_list.map(event => {
            return {
                name: event.name,
                start_time: event.start_ts,
                done: event.monochrome_got_cnt >= event.monochrome_cnt,
                recovery_time: event.end_ts,
                current: event.monochrome_got_cnt,
                max: event.monochrome_cnt,
                started: event.state == "STATE_IN_PROGRESS"
            }
        }).sort((a,b)=>{
            if (a.start_time < now && b.start_time < now) {
                return a.recovery_time-b.recovery_time;
            }
            return +b.started - +a.started;
        })
        return this.events;
    }

    async buildUserEmbed(): Promise<BaseMessageOptions> {
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.cn) prom.push(this.newShiyu());
        if (!this.signIn) prom.push(this.dailyInfo());
        if (!this.da) prom.push(this.deadass());
        // if (!this.hz) prom.push(this.hollowZero());
        await Promise.all(prom);

        if (!this.bc) throw new Error('bc is undefined');
        if (!this.signIn) throw new Error('signIn is undefined');
        if (!this.cn) throw new Error('cn is undefined');
        if (!this.da) throw new Error('da is undefined');
        // if (!this.hz) throw new Error('hz is undefined');

        let descLines = [];
        descLines.push(`**Battery Power**: ${this.bc.battery_charge.current}/${this.bc.battery_charge.max}, capped <t:${this.bc.battery_charge.recovery_time}:R>`);

        const embed = new EmbedBuilder()
            .setTitle(`Zenless Zone Zero — ${this.uid}`)
            .setDescription(descLines.join("\n"))
            .setTimestamp();

        embed.addFields({ name: `Web check-in reset <t:${timeOnNext(24 * 60 * 60, 16 * 60 * 60)}:R>`, value: crossIfTrue(this.signIn.checked, `Check-in`) });

        let dailyLines = [];
        dailyLines.push(crossIfTrue(
            this.bc.daily.scratch_card.current >= this.bc.daily.scratch_card.max,
            `Scratch Card Mania`
        ));
        dailyLines.push(crossIfTrue(
            this.bc.daily.video_store.current >= this.bc.daily.video_store.max,
            `Video Store Open`
        ));
        dailyLines.push(crossIfTrue(
            this.bc.daily.engagement.current >= this.bc.daily.engagement.max,
            `**Engagement**: ${this.bc.daily.engagement.current}/${this.bc.daily.engagement.max}`
        ));
        embed.addFields({ name: `Daily reset <t:${this.bc.daily.recovery_time}:R>`, value: dailyLines.join("\n") });

        let weeklyLines = [];
        // weeklyLines.push(crossIfTrue(
        //     this.hz.investigation.cur >= this.hz.investigation.max,
        //     `**Investigation Points**: ${this.hz.investigation.cur}/${this.hz.investigation.max}`
        // ));
        weeklyLines.push(crossIfTrue(
            this.bc.weekly.bounty_commission.current >= this.bc.weekly.bounty_commission.max,
            `**Bounty Commissions**: ${this.bc.weekly.bounty_commission.current}/${this.bc.weekly.bounty_commission.max}`
        ));
        weeklyLines.push(crossIfTrue(
            this.bc.weekly.weekly_points.current >= this.bc.weekly.weekly_points.max,
            `**Ridu Weekly Points**: ${this.bc.weekly.weekly_points.current}/${this.bc.weekly.weekly_points.max}`
        ));
        embed.addFields({ name: `Weekly reset <t:${this.bc.weekly.recovery_time}:R>`, value: weeklyLines.join("\n") });

        let monthlyLines = [];
        monthlyLines.push(crossIfTrue(
            this.bc.omnicoins.current >= this.bc.omnicoins.max,
            `**Omnicoins**: ${this.bc.omnicoins.current}/${this.bc.omnicoins.max}`
        ));
        embed.addFields({ name: `Omnicoin reset <t:${this.bc.omnicoins.recovery_time}:R>`, value: monthlyLines.join("\n") });

        let endgameLines = [];
        endgameLines.push(crossIfTrue(
            this.cn.score >= 100_000,
            `**Score**: ${this.cn.score}/300000`
        ));
        embed.addFields({ name: `Critical Node reset <t:${this.cn.recovery_time}:R>`, value: endgameLines.join("\n") });

        let daLines = [];
        daLines.push(crossIfTrue(
            this.da.stars.cur >= this.da.stars.max,
            `**Stars**: ${this.da.stars.cur}/${this.da.stars.max}`
        ));
        embed.addFields({ name: `Deadly Assault reset <t:${this.cn.recovery_time}:R>`, value: daLines.join("\n") });

        const refreshButton = new ButtonBuilder()
            .setCustomId(`zzz|${this.discord_id}`)
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(refreshButton);
        return { embeds: [embed], components: [row] };
    }

    async getTimers(): Promise<Resource[]> {
        const prom = [];
        if (!this.bc) prom.push(this.battleChronicle());
        if (!this.cn) prom.push(this.newShiyu());
        if (!this.signIn) prom.push(this.dailyInfo());
        if (!this.da) prom.push(this.deadass());
        if (!this.events) prom.push(this.actCalendar());
        // if (!this.hz) prom.push(this.hollowZero());
        await Promise.all(prom);

        if (!this.bc) throw new Error('bc is undefined');
        if (!this.signIn) throw new Error('signIn is undefined');
        if (!this.cn) throw new Error('cn is undefined');
        if (!this.da) throw new Error('da is undefined');
        if (!this.events) throw new Error('events is undefined');
        // if (!this.hz) throw new Error('hz is undefined');

        let timers = [];
        timers.push({
            name: "ZZZ Battery Power",
            current: this.bc.battery_charge.current,
            max: this.bc.battery_charge.max,
            done: false,
            recovery_time: this.bc.battery_charge.recovery_time
        })
        timers.push({
            name: "ZZZ Scratch Card",
            current: this.bc.daily.scratch_card.current,
            max: this.bc.daily.scratch_card.max,
            done: this.bc.daily.scratch_card.current == this.bc.daily.scratch_card.max,
            recovery_time: this.bc.daily.recovery_time
        })
        timers.push({
            name: "ZZZ Video Store",
            current: this.bc.daily.video_store.current,
            max: this.bc.daily.video_store.max,
            done: this.bc.daily.video_store.current == this.bc.daily.video_store.max,
            recovery_time: this.bc.daily.recovery_time
        })
        timers.push({
            name: "ZZZ Engagement",
            current: this.bc.daily.engagement.current,
            max: this.bc.daily.engagement.max,
            done: this.bc.daily.engagement.current == this.bc.daily.engagement.max,
            recovery_time: this.bc.daily.recovery_time
        })
        timers.push({
            name: "ZZZ Bounty Commissions",
            current: this.bc.weekly.bounty_commission.current,
            max: this.bc.weekly.bounty_commission.max,
            done: this.bc.weekly.bounty_commission.current == this.bc.weekly.bounty_commission.max,
            recovery_time: this.bc.weekly.recovery_time
        })
        timers.push({
            name: "ZZZ Ridu Weekly Points",
            current: this.bc.weekly.weekly_points.current,
            max: this.bc.weekly.weekly_points.max,
            done: this.bc.weekly.weekly_points.current == this.bc.weekly.weekly_points.max,
            recovery_time: this.bc.weekly.recovery_time
        })
        timers.push({
            name: "ZZZ Critical Node",
            current: this.cn.score,
            max: 100_000,
            done: this.cn.score >= 100_000,
            recovery_time: this.cn.recovery_time
        })
        timers.push({
            name: "ZZZ Deadly Assault",
            current: this.da.stars.cur,
            max: this.da.stars.max,
            done: this.da.stars.cur == this.da.stars.max,
            recovery_time: this.da.recovery_time
        })
        let now = Math.floor(Date.now() / 1000);
        this.events.filter(event => {
            return now > event.start_time;
        }).forEach(event => {
            timers.push({
                name: `ZZZ ${event.name}`,
                current: event.current,
                max: event.max,
                done: event.done,
                recovery_time: event.recovery_time
            })
        })
        return timers;
    }

    async getCharacter(char_id: number) {
        const response: {
            avatar_list: {
                name_mi18n: string,
                level: number,
                rank: number,
                hollow_icon_path: string,
                weapon?: {
                    name: string,
                    star: number,
                    level: number
                }
                properties: {
                    property_name: string,
                    add: string,
                    base: string,
                    final: string
                }[],
                equip: {
                    level: number,
                    name: string,
                    rarity: string,
                    main_properties: {
                        property_name: string,
                        property_id: number,
                        level: number,
                        base: string
                    }[],
                    properties: {
                        property_name: string,
                        property_id: number,
                        level: number,
                        base: string
                    }[],
                    equip_suit: {
                        desc1: string,
                        desc2: string,
                        name: string,
                        own: number
                    },
                    equipment_type: number
                }[]
            }[]
        } = await hoyoRequest(this.root_url + `avatar/info?id_list[]=${char_id}&need_wiki=false&server=prod_gf_us&role_id=${this.uid}`, this.cookie);
        if (response.avatar_list.length < 1) return null;
        const char = response.avatar_list[0];
        
        let cdf = null;
        let path = `./data/hoyo/zzz/cdfs/${char.name_mi18n}.json`
        if (fs.existsSync(path)) {
            cdf = ZzzClient.loadCharacterCdf(path);
        }
        return {
            name: char.name_mi18n,
            image: char.hollow_icon_path,
            w_engine: {
                name: char.weapon?.name,
                level: char.weapon?.level
            },
            stats: char.properties.map(prop => {return {name: prop.property_name, value: prop.final}}),
            disk_drives: char.equip.map(dd => {
                const scores = cdf ? cdf.getCdf(dd.equipment_type - 1, dd) : undefined;
                let this_dd = {
                    name: dd.name,
                    level: dd.level,
                    main_stat: {
                        name: dd.main_properties[0].property_name,
                        value: dd.main_properties[0].base
                    },
                    sub_stats: dd.properties.map(prop => {return {name: prop.property_name, value: prop.base}}),
                    ...(scores !== undefined && { cost: scores.cost, score: scores.score })
                }
                return this_dd;
            })
        };
    }
    static redeem(code: string) {
        //https://public-operation-nap.hoyolab.com/common/apicdkey/api/webExchangeCdkeyHyl?cdkey=${code}&game_biz=nap_global&lang=en&region=prod_gf_us&t=1748041243087&uid=${this.uid}
    }

    static async news() {
        return getPosts(219270333, '');
    }
}
export interface ZzzHollowZero {
    commission: {
        cur: number;
        max: number;
    };
    recovery_time: number;
}
export interface ZzzBattleChronicle {
    battery_charge: {
        current: number;
        max: number;
        recovery_time: number;
    };
    daily: {
        engagement: {
            current: number;
            max: number;
        },
        scratch_card: {
            current: number;
            max: number;
        },
        video_store: {
            current: number;
            max: number;
        };
        recovery_time: number;
    },
    weekly: {
		bounty_commission: {
			current: number;
			max: number;
		},
		weekly_points: {
			current: number;
			max: number;
		},
        recovery_time: number;
    },
    omnicoins: {
        current: number;
        max: number;
        recovery_time: number;
    };
}
export interface ZzzCriticalNode {
    score: number;
    top?: number;
    recovery_time: number;
    rating?: string;
    nodes?: {
		score: number,
        buff: string;
        team: ZzzTeam;
    }[]
}
export interface ZzzDeadlyAssault {
    stars: {
        cur: number,
        max: number
    },
	score: number,
	top: number,
    recovery_time: number;
    nodes: {
		score: number,
		stars: {
			cur: number,
			max: number
		},
        boss: string;
        buff: string;
        team: ZzzTeam;
    }[];
}
interface ZzzTeam {
	chars: ZzzCharacter[],
	bangboo: Bangboo
}
interface ZzzCharacter {
	level: number,
	name: string,
	cinema: number
}
interface Bangboo {
	name: string,
	level: number
}
async function banners(id: number, cookie: string): Promise<any> {
    const response = await hoyoRequest(`https://bbs-api-os.hoyolab.com/community/painter/wapi/banner/list?gids=${id}`, cookie);
    return response;
}
