"use strict";
import Command from '../util/Command.js';
import MessageResponse from '../util/MessageResponse.js';
import {MessageEmbed} from 'discord.js';
import fetch from 'node-fetch';
import moment from 'moment-timezone';
import sql from '../util/SQLite.js';

moment.tz.setDefault("America/New_York");

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

let poe_stats = {};
fetch("https://www.pathofexile.com/api/trade/data/stats",{
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
    }
}).then(res => res.json()).then(json => {
    poe_stats = json;
})

let poe_leagues = [];
fetch("https://www.pathofexile.com/api/trade/data/leagues",{
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
    }
}).then(res => res.json()).then(json => {
    poe_leagues = json.result.map(leag => {
        return leag.id
    });
})

async function setLeague(top, interaction, callback) {
    let leaguelist = poe_leagues.map(leagueid => {
        return {
            title: leagueid,
            response: async () => {
                let stmt = sql.prepare("INSERT INTO users(user_id,poeleague) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET poeleague=excluded.poeleague;")
                stmt.run(interaction.user.id, leagueid)
                return await callback();
            }
        }
    })

    let rich = MessageResponse.addList(interaction.channel.id, leaguelist, interaction.user.id);

    rich.setTitle(top);
    return rich;
}

async function poesearch(interaction) {
    function getModID(str, label) {
        let list = poe_stats.result.find(list => {
            return list.label === label
        })
        if (!list) return [];
        let mods = list.entries.filter(mod => {
            let compare_str = mod.text.replace(/-?\d+/g, "#").replace(/\+/g, "").replace(/ \(Local\)/g, "");
            return compare_str === str.replace(/-?\d+/g, "#").replace(/\+/g, "");
        })
        if (mods.length < 0) {
            return [];
        } else {
            return mods.map(mod => {
                let arr = mod.text.match(/-?\d+|#/g);
                if (arr) {
                    let is_num = arr.map(s => {
                        if (s == "#") return true;
                        return false
                    })
                    let sum = 0;
                    let count = 0;
                    str.match(/-?\d+|#/g).forEach((s, i) => {
                        if (is_num[i]) {
                            sum += parseInt(s);
                            count++;
                        }
                    })
                    return [mod.id, mod.text, sum / count];
                }
                return [mods[0].id, mods[0].text, null];
            })
        }
    }
    let stmt = sql.prepare("SELECT poeleague FROM users WHERE user_id = ?;");
    let poeleague = stmt.get(interaction.user.id).poeleague;

    if (poe_leagues.indexOf(poeleague) < 0) {
        return setLeague("Update your league", interaction, async () => {
            let itemsearch = await poesearch(interaction);
            return itemsearch;
        });
    }

    let body = {
        "query": {
            "status": { "option": "online" },
            "term": interaction.options.data[0].value,
            "stats": [
                { "type": "and", "filters": [] }
            ]
        },
        "sort": { "price": "asc" }
    }
    let rich = new MessageEmbed();
    let desc_list = []
    if (interaction.options.data[0].value.split("\n").length > 2) {
        let group = interaction.options.data[0].value.split("\n--------\n");
        group = group.map((e) => {
            return e.split("\n")
        })
        if (group[0][0] === "Rarity: Unique") {
            body.query.term = group[0][group[0].length - 2] + " " + group[0][group[0].length - 1]
            body.query.filters = {
                type_filters: {
                    filters: {
                        rarity: {
                            option: "unique"
                        }
                    }
                }
            }
            desc_list.push(`**Name: ${group[0][group[0].length - 2]} ${group[0][group[0].length - 1]}**`);
            desc_list.push(`**Rarity: Unique**`);
        } else if (group[0][group[0].length - 1] === "Stygian Vise") {
            desc_list.push(`**Name: Stygian Vise**`);
            body.query.term = group[0][group[0].length - 1];
        } else if (group[0][0] === "Rarity: Rare") {
            let bases = JSON.parse(`{"Helmet":["Aventail Helmet","Barbute Helmet","Battered Helm","Bone Circlet","Bone Helmet","Callous Mask","Close Helmet","Cone Helmet","Crusader Helmet","Deicide Mask","Eternal Burgonet","Ezomyte Burgonet","Fencer Helm","Festival Mask","Fluted Bascinet","Gilded Sallet","Gladiator Helmet","Golden Mask","Golden Wreath","Great Crown","Great Helmet","Harlequin Mask","Hubris Circlet","Hunter Hood","Iron Circlet","Iron Hat","Iron Mask","Lacquered Helmet","Leather Cap","Leather Hood","Lion Pelt","Lunaris Circlet","Magistrate Crown","Mind Cage","Necromancer Circlet","Nightmare Bascinet","Noble Tricorne","Pig-Faced Bascinet","Plague Mask","Praetor Crown","Prophet Crown","Raven Mask","Reaver Helmet","Regicide Mask","Royal Burgonet","Rusted Coif","Sallet","Samite Helmet","Scare Mask","Secutor Helm","Siege Helmet","Silken Hood","Sinner Tricorne","Solaris Circlet","Soldier Helmet","Steel Circlet","Torture Cage","Tribal Circlet","Tricorne","Ursine Pelt","Vaal Mask","Vine Circlet","Visored Sallet","Wolf Pelt","Zealot Helmet"],"One Hand Axe":["Arming Axe","Boarding Axe","Broad Axe","Butcher Axe","Ceremonial Axe","Chest Splitter","Cleaver","Decorative Axe","Engraved Hatchet","Etched Hatchet","Infernal Axe","Jade Hatchet","Jasper Axe","Karui Axe","Reaver Axe","Royal Axe","Runic Hatchet","Rusted Hatchet","Siege Axe","Spectral Axe","Tomahawk","Vaal Hatchet","War Axe","Wraith Axe","Wrist Chopper"],"Flask":["Amethyst Flask","Aquamarine Flask","Basalt Flask","Bismuth Flask","Colossal Hybrid Flask","Colossal Life Flask","Colossal Mana Flask","Diamond Flask","Divine Life Flask","Divine Mana Flask","Eternal Life Flask","Eternal Mana Flask","Giant Life Flask","Giant Mana Flask","Grand Life Flask","Grand Mana Flask","Granite Flask","Greater Life Flask","Greater Mana Flask","Hallowed Hybrid Flask","Hallowed Life Flask","Hallowed Mana Flask","Jade Flask","Large Hybrid Flask","Large Life Flask","Large Mana Flask","Medium Hybrid Flask","Medium Life Flask","Medium Mana Flask","Quartz Flask","Quicksilver Flask","Ruby Flask","Sacred Hybrid Flask","Sacred Life Flask","Sacred Mana Flask","Sanctified Life Flask","Sanctified Mana Flask","Sapphire Flask","Silver Flask","Small Hybrid Flask","Small Life Flask","Small Mana Flask","Stibnite Flask","Sulphur Flask","Topaz Flask"],"Fishing Rods":["Fishing Rod"],"One Hand Sword":["Ancient Sword","Antique Rapier","Apex Rapier","Baselard","Basket Rapier","Battered Foil","Battle Sword","Broad Sword","Burnished Foil","Charan's Sword","Copper Sword","Corsair Sword","Courtesan Sword","Cutlass","Dragonbone Rapier","Dragoon Sword","Dusk Blade","Elder Sword","Elegant Foil","Elegant Sword","Estoc","Eternal Sword","Fancy Foil","Gemstone Sword","Gladius","Graceful Sword","Grappler","Harpy Rapier","Hook Sword","Jagged Foil","Jewelled Foil","Legion Sword","Midnight Blade","Pecoraro","Primeval Rapier","Rusted Spike","Rusted Sword","Sabre","Serrated Foil","Smallsword","Spiraled Foil","Tempered Foil","Thorn Rapier","Tiger Hook","Twilight Blade","Vaal Blade","Vaal Rapier","Variscite Blade","War Sword","Whalebone Rapier","Wyrmbone Rapier"],"Claw":["Awl","Blinder","Cat's Paw","Double Claw","Eagle Claw","Eye Gouger","Fright Claw","Gemini Claw","Gouger","Great White Claw","Gut Ripper","Hellion's Paw","Imperial Claw","Nailed Fist","Noble Claw","Prehistoric Claw","Sharktooth Claw","Sparkling Claw","Terror Claw","Thresher Claw","Throat Stabber","Tiger's Paw","Timeworn Claw","Twin Claw","Vaal Claw"],"Breach":["Ancient Reliquary Key","Blessing of Chayula","Blessing of Esh","Blessing of Tul","Blessing of Uul-Netol","Blessing of Xoph","Chayula's Breachstone","Esh's Breachstone","Splinter of Chayula","Splinter of Esh","Splinter of Tul","Splinter of Uul-Netol","Splinter of Xoph","Tul's Breachstone","Uul-Netol's Breachstone","Xoph's Breachstone"],"Body Armour":["Arena Plate","Assassin's Garb","Astral Plate","Battle Lamellar","Battle Plate","Blood Raiment","Bone Armour","Bronze Plate","Buckskin Tunic","Cabalist Regalia","Carnal Armour","Chain Hauberk","Chainmail Doublet","Chainmail Tunic","Chainmail Vest","Chestplate","Colosseum Plate","Commander's Brigandine","Conjurer's Vestment","Conquest Chainmail","Copper Plate","Coronal Leather","Crimson Raiment","Crusader Chainmail","Crusader Plate","Crypt Armour","Cutthroat's Garb","Desert Brigandine","Destiny Leather","Destroyer Regalia","Devout Chainmail","Dragonscale Doublet","Eelskin Tunic","Elegant Ringmail","Exquisite Leather","Field Lamellar","Frontier Leather","Full Chainmail","Full Dragonscale","Full Leather","Full Plate","Full Ringmail","Full Scale Armour","Full Wyrmscale","General's Brigandine","Gladiator Plate","Glorious Leather","Glorious Plate","Golden Mantle","Golden Plate","Holy Chainmail","Hussar Brigandine","Infantry Brigandine","Lacquered Garb","Latticed Ringmail","Light Brigandine","Lordly Plate","Loricated Ringmail","Mage's Vestment","Majestic Plate","Necromancer Silks","Occultist's Vestment","Oiled Coat","Oiled Vest","Ornate Ringmail","Padded Jacket","Padded Vest","Plate Vest","Quilted Jacket","Ringmail Coat","Sacrificial Garb","Sadist Garb","Sage's Robe","Saint's Hauberk","Saintly Chainmail","Savant's Robe","Scale Doublet","Scale Vest","Scarlet Raiment","Scholar's Robe","Sentinel Jacket","Shabby Jerkin","Sharkskin Tunic","Silk Robe","Silken Garb","Silken Vest","Silken Wrap","Simple Robe","Sleek Coat","Soldier's Brigandine","Spidersilk Robe","Strapped Leather","Sun Leather","Sun Plate","Thief's Garb","Triumphant Lamellar","Vaal Regalia","Varnished Coat","War Plate","Waxed Garb","Widowsilk Robe","Wild Leather","Wyrmscale Doublet","Zodiac Leather"],"Map":["Abyss Map","Academy Map","Acid Lakes Map","Alleyways Map","Ancient City Map","Arachnid Nest Map","Arachnid Tomb Map","Arcade Map","Arena Map","Arid Lake Map","Armoury Map","Arsenal Map","Ashen Wood Map","Atoll Map","Barrows Map","Basilica Map","Bazaar Map","Beach Map","Beacon Map","Belfry Map","Bog Map","Bone Crypt Map","Burial Chambers Map","Cage Map","Caldera Map","Canyon Map","Carcass Map","Castle Ruins Map","Catacombs Map","Cavern Map","Cells Map","Cemetery Map","Channel Map","Chateau Map","City Square Map","Colonnade Map","Colosseum Map","Conservatory Map","Coral Ruins Map","Core Map","Courthouse Map","Courtyard Map","Coves Map","Crematorium Map","Crimson Temple Map","Crypt Map","Crystal Ore Map","Cursed Crypt Map","Dark Forest Map","Defiled Cathedral Map","Desert Map","Desert Spring Map","Dig Map","Dunes Map","Dungeon Map","Estuary Map","Excavation Map","Factory Map","Fields Map","Flooded Mine Map","Forge of the Phoenix Map","Gardens Map","Geode Map","Ghetto Map","Gorge Map","Graveyard Map","Grotto Map","Harbinger Map","Haunted Mansion Map","High Gardens Map","Iceberg Map","Infested Valley Map","Ivory Temple Map","Jungle Valley Map","Laboratory Map","Lair Map","Lair of the Hydra Map","Lava Chamber Map","Lava Lake Map","Leyline Map","Lighthouse Map","Lookout Map","Malformation Map","Marshes Map","Mausoleum Map","Maze Map","Maze of the Minotaur Map","Mesa Map","Mineral Pools Map","Moon Temple Map","Mud Geyser Map","Museum Map","Necropolis Map","Oasis Map","Orchard Map","Overgrown Ruin Map","Overgrown Shrine Map","Palace Map","Park Map","Pen Map","Peninsula Map","Phantasmagoria Map","Pier Map","Pit Map","Pit of the Chimera Map","Plateau Map","Plaza Map","Port Map","Precinct Map","Primordial Pool Map","Promenade Map","Quarry Map","Racecourse Map","Ramparts Map","Reef Map","Relic Chambers Map","Residence Map","Scriptorium Map","Sepulchre Map","Sewer Map","Shaped Academy Map","Shaped Acid Lakes Map","Shaped Arachnid Nest Map","Shaped Arachnid Tomb Map","Shaped Arcade Map","Shaped Arena Map","Shaped Arid Lake Map","Shaped Armoury Map","Shaped Arsenal Map","Shaped Ashen Wood Map","Shaped Atoll Map","Shaped Barrows Map","Shaped Beach Map","Shaped Bog Map","Shaped Burial Chambers Map","Shaped Canyon Map","Shaped Castle Ruins Map","Shaped Catacombs Map","Shaped Cavern Map","Shaped Cells Map","Shaped Cemetery Map","Shaped Channel Map","Shaped Colonnade Map","Shaped Courtyard Map","Shaped Coves Map","Shaped Crypt Map","Shaped Crystal Ore Map","Shaped Desert Map","Shaped Dunes Map","Shaped Dungeon Map","Shaped Factory Map","Shaped Ghetto Map","Shaped Graveyard Map","Shaped Grotto Map","Shaped Jungle Valley Map","Shaped Malformation Map","Shaped Marshes Map","Shaped Mesa Map","Shaped Mud Geyser Map","Shaped Museum Map","Shaped Oasis Map","Shaped Orchard Map","Shaped Overgrown Shrine Map","Shaped Peninsula Map","Shaped Phantasmagoria Map","Shaped Pier Map","Shaped Pit Map","Shaped Port Map","Shaped Primordial Pool Map","Shaped Promenade Map","Shaped Quarry Map","Shaped Racecourse Map","Shaped Ramparts Map","Shaped Reef Map","Shaped Sewer Map","Shaped Shore Map","Shaped Spider Forest Map","Shaped Spider Lair Map","Shaped Strand Map","Shaped Temple Map","Shaped Terrace Map","Shaped Thicket Map","Shaped Tower Map","Shaped Tropical Island Map","Shaped Underground River Map","Shaped Vaal City Map","Shaped Vaal Pyramid Map","Shaped Villa Map","Shaped Waste Pool Map","Shaped Wharf Map","Shipyard Map","Shore Map","Shrine Map","Siege Map","Spider Forest Map","Spider Lair Map","Springs Map","Strand Map","Sulphur Vents Map","Sulphur Wastes Map","Summit Map","Sunken City Map","Temple Map","Terrace Map","Thicket Map","Torture Chamber Map","Tower Map","Toxic Sewer Map","Tribunal Map","Tropical Island Map","Underground River Map","Underground Sea Map","Vaal City Map","Vaal Pyramid Map","Vaal Temple Map","Vault Map","Villa Map","Volcano Map","Waste Pool Map","Wasteland Map","Waterways Map","Wharf Map"],"One Hand Mace":["Ancestral Club","Auric Mace","Barbed Club","Battle Hammer","Behemoth Mace","Bladed Mace","Ceremonial Mace","Dragon Mace","Dream Mace","Driftwood Club","Flanged Mace","Gavel","Legion Hammer","Nightmare Mace","Ornate Mace","Pernarch","Petrified Club","Phantom Mace","Rock Breaker","Spiked Club","Stone Hammer","Tenderizer","Tribal Club","War Hammer","Wyrm Mace"],"Amulet":["Agate Amulet","Amber Amulet","Ashscale Talisman","Avian Twins Talisman","Black Maw Talisman","Blue Pearl Amulet","Bonespire Talisman","Breakrib Talisman","Chrysalis Talisman","Citrine Amulet","Clutching Talisman","Coral Amulet","Deadhand Talisman","Deep One Talisman","Fangjaw Talisman","Gold Amulet","Greatwolf Talisman","Hexclaw Talisman","Horned Talisman","Jade Amulet","Jet Amulet","Jet Amulet","Lapis Amulet","Lone Antler Talisman","Longtooth Talisman","Mandible Talisman","Marble Amulet","Monkey Paw Talisman","Monkey Twins Talisman","Onyx Amulet","Paua Amulet","Primal Skull Talisman","Rot Head Talisman","Rotfeather Talisman","Ruby Amulet","Spinefuse Talisman","Splitnewt Talisman","Three Hands Talisman","Three Rat Talisman","Turquoise Amulet","Undying Flesh Talisman","Wereclaw Talisman","Writhing Talisman"],"Two Hand Mace":["Brass Maul","Colossus Mallet","Coronal Maul","Dread Maul","Driftwood Maul","Fright Maul","Great Mallet","Imperial Maul","Jagged Maul","Karui Maul","Mallet","Meatgrinder","Morning Star","Piledriver","Plated Maul","Sledgehammer","Solar Maul","Spiny Maul","Steelhead","Terror Maul","Totemic Maul","Tribal Maul"],"Sceptre":["Abyssal Sceptre","Blood Sceptre","Bronze Sceptre","Carnal Sceptre","Crystal Sceptre","Darkwood Sceptre","Driftwood Sceptre","Grinning Fetish","Horned Sceptre","Iron Sceptre","Karui Sceptre","Lead Sceptre","Ochre Sceptre","Opal Sceptre","Platinum Sceptre","Quartz Sceptre","Ritual Sceptre","Royal Sceptre","Sambar Sceptre","Sekhem","Shadow Sceptre","Stag Sceptre","Tyrant's Sekhem","Vaal Sceptre","Void Sceptre"],"Two Hand Axe":["Abyssal Axe","Dagger Axe","Despot Axe","Double Axe","Ezomyte Axe","Fleshripper","Gilded Axe","Headsman Axe","Jade Chopper","Jasper Chopper","Karui Chopper","Labrys","Noble Axe","Poleaxe","Shadow Axe","Stone Axe","Sundering Axe","Talon Axe","Timber Axe","Vaal Axe","Void Axe","Woodsplitter"],"Prophecy":["A Call into the Void","A Firm Foothold","A Forest of False Idols","A Gracious Master","A Master Seeks Help","A Prodigious Hand","A Regal Death","A Valuable Combination","A Whispered Prayer","Abnormal Effulgence","Against the Tide","An Unseen Peril","Anarchy's End I","Anarchy's End II","Anarchy's End III","Anarchy's End IV","Ancient Doom","Ancient Rivalries I","Ancient Rivalries II","Ancient Rivalries III","Ancient Rivalries IV","Baptism by Death","Beyond Sight I","Beyond Sight II","Beyond Sight III","Beyond Sight IV","Beyond Sight V","Blood in the Eyes","Blood of the Betrayed","Bountiful Traps","Brothers in Arms","Cleanser of Sins","Crash Test","Crushing Squall","Custodians of Silence","Day of Sacrifice I","Day of Sacrifice II","Day of Sacrifice III","Day of Sacrifice IV","Deadly Rivalry I","Deadly Rivalry II","Deadly Rivalry III","Deadly Rivalry IV","Deadly Rivalry V","Deadly Twins","Defiled in the Scepter","Delay Test","Delay and Crash Test","Dying Cry","Echoes of Lost Love","Echoes of Mutation","Echoes of Witchcraft","Ending the Torment","Enter the Maelström","Erased from Memory","Erasmus' Gift","Fallow At Last","Fated Connections","Fear's Wide Reach","Fire and Brimstone","Fire and Ice","Fire from the Sky","Fire, Wood and Stone","Flesh of the Beast","Forceful Exorcism","From Death Springs Life","From The Void","Gilded Within","Golden Touch","Graceful Flames","Heart of the Fire","Heavy Blows","Hidden Reinforcements","Hidden Vaal Pathways","Holding the Bridge","Hunter's Lesson","Ice from Above","In the Grasp of Corruption","Kalandra's Craft","Lasting Impressions","Lightning Falls","Living Fires","Lost in the Pages","Monstrous Treasure","Mouth of Horrors","Mysterious Invaders","Nature's Resilience","Nemesis of Greed","Notched Flesh","Overflowing Riches","Path of Betrayal","Plague of Frogs","Plague of Rats","Pleasure and Pain","Pools of Wealth","Possessed Foe","Power Magnified","Rebirth","Reforged Bonds","Resistant to Change","Risen Blood","Roth's Legacy","SHOULD NOT APPEAR","Sanctum of Stone","Severed Limbs","Smothering Tendrils","Soil, Worms and Blood","Storm on the Horizon","Storm on the Shore","Strong as a Bull","Thaumaturgical History I","Thaumaturgical History II","Thaumaturgical History III","Thaumaturgical History IV","The Aesthete's Spirit","The Alchemist","The Ambitious Bandit I","The Ambitious Bandit II","The Ambitious Bandit III","The Apex Predator","The Beautiful Guide","The Beginning and the End","The Black Stone I","The Black Stone II","The Black Stone III","The Black Stone IV","The Blacksmith","The Blessing","The Bloody Flowers Redux","The Bowstring's Music","The Brothers of Necromancy","The Brutal Enforcer","The Child of Lunaris","The Corrupt","The Cursed Choir","The Dream Trial","The Dreamer's Dream","The Eagle's Cry","The Emperor's Trove","The Feral Lord I","The Feral Lord II","The Feral Lord III","The Feral Lord IV","The Feral Lord V","The Flayed Man","The Flow of Energy","The Forgotten Garrison","The Forgotten Soldiers","The Fortune Teller's Collection","The Four Feral Exiles","The God of Misfortune","The Hardened Armour","The Hollow Pledge","The Hungering Swarm","The Invader","The Jeweller's Touch","The Karui Rebellion","The King and the Brambles","The King's Path","The Lady in Black","The Last Watch","The Lost Maps","The Lost Undying","The Misunderstood Queen","The Mysterious Gift","The Nest","The Pair","The Petrified","The Pirate's Den","The Plaguemaw I","The Plaguemaw II","The Plaguemaw III","The Plaguemaw IV","The Plaguemaw V","The Prison Guard","The Prison Key","The Queen's Vaults","The Scout","The Servant's Heart","The Sharpened Blade","The Silverwood","The Singular Spirit","The Sinner's Stone","The Snuffed Flame","The Soulless Beast","The Spread of Corruption","The Stockkeeper","The Sword King's Passion","The Trembling Earth","The Twins","The Unbreathing Queen I","The Unbreathing Queen II","The Unbreathing Queen III","The Unbreathing Queen IV","The Unbreathing Queen V","The Undead Brutes","The Undead Storm","The Vanguard","The Walking Mountain","The Ward's Ward","The Warmongers I","The Warmongers II","The Warmongers III","The Warmongers IV","The Watcher's Watcher","The Wealthy Exile","Through the Mirage","Touched by Death","Touched by the Wind","Trash to Treasure","Twice Enchanted","Unbearable Whispers I","Unbearable Whispers II","Unbearable Whispers III","Unbearable Whispers IV","Unbearable Whispers V","Undead Uprising","Unnatural Energy","Vaal Invasion","Vaal Winds","Visions of the Drowned","Vital Transformation","Waiting in Ambush","Weeping Death","Wind and Thunder","Winter's Mournful Melodies"],"Gem":["Abyssal Cry","Added Chaos Damage","Added Cold Damage","Added Fire Damage","Added Lightning Damage","Additional Accuracy","Ancestral Call Support","Ancestral Protector","Ancestral Warchief","Anger","Animate Guardian","Animate Weapon","Arc","Arcane Surge Support","Arctic Armour","Arctic Breath","Assassin's Mark","Ball Lightning","Ball Lightning","Barrage","Bear Trap","Blade Flurry","Blade Vortex","Bladefall","Blasphemy","Blast Rain","Blight","Blind","Blink Arrow","Block Chance Reduction","Blood Magic","Blood Rage","Bloodlust","Bodyswap","Bone Offering","Brutality Support","Burning Arrow","Burning Damage Support","Cast On Critical Strike","Cast on Death","Cast on Melee Kill","Cast when Damage Taken","Cast when Stunned","Cast while Channelling Support","Caustic Arrow","Chain","Chance to Bleed Support","Chance to Flee","Chance to Ignite","Charged Dash","Clarity","Cleave","Cluster Traps","Cold Penetration","Cold Snap","Cold to Fire","Concentrated Effect","Conductivity","Contagion","Controlled Destruction","Conversion Trap","Convocation","Cremation","Culling Strike","Curse On Hit","Cyclone","Damage on Full Life Support","Dark Pact","Deadly Ailments Support","Decay Support","Decoy Totem","Desecrate","Despair","Determination","Detonate Dead","Detonate Mines","Devouring Totem","Discharge","Discipline","Dominating Blow","Double Strike","Dual Strike","Earthquake","Efficacy Support","Elemental Damage with Attacks Support","Elemental Focus","Elemental Hit","Elemental Proliferation","Elemental Weakness","Empower","Endurance Charge on Melee Stun","Enduring Cry","Enfeeble","Enhance","Enlighten","Essence Drain","Ethereal Knives","Explosive Arrow","Faster Attacks","Faster Casting","Faster Projectiles","Fire Nova Mine","Fire Penetration","Fire Trap","Fireball","Firestorm","Flame Dash","Flame Surge","Flame Totem","Flameblast","Flammability","Flesh Offering","Flicker Strike","Fork","Fortify","Freeze Mine","Freezing Pulse","Frenzy","Frost Blades","Frost Bomb","Frost Wall","Frostbite","Frostbolt","Generosity","Glacial Cascade","Glacial Hammer","Grace","Greater Multiple Projectiles","Ground Slam","Haste","Hatred","Heavy Strike","Herald of Ash","Herald of Ice","Herald of Thunder","Hypothermia","Ice Bite","Ice Crash","Ice Nova","Ice Shot","Ice Spear","Ice Trap","Ignite Proliferation Support","Immolate Support","Immortal Call","Incinerate","Increased Area of Effect","Increased Critical Damage","Increased Critical Strikes","Increased Duration","Infernal Blow","Innervate","Iron Grip","Iron Will","Item Quantity","Item Rarity","Kinetic Blast","Knockback","Lacerate","Leap Slam","Less Duration","Lesser Multiple Projectiles","Lesser Poison Support","Life Gain on Hit","Life Leech","Lightning Arrow","Lightning Penetration","Lightning Strike","Lightning Tendrils","Lightning Trap","Lightning Warp","Magma Orb","Maim Support","Mana Leech","Melee Physical Damage","Melee Splash","Minefield","Minion Damage","Minion Life","Minion Speed","Minion and Totem Elemental Resistance","Mirage Archer Support","Mirror Arrow","Molten Shell","Molten Strike","Multiple Traps","Multistrike","Onslaught Support","Orb of Storms","Phase Run","Physical Projectile Attack Damage","Physical to Lightning","Pierce","Poacher's Mark","Point Blank","Poison","Portal","Power Charge On Critical","Power Siphon","Projectile Weakness","Puncture","Punishment","Purity of Elements","Purity of Fire","Purity of Ice","Purity of Lightning","Rain of Arrows","Raise Spectre","Raise Zombie","Rallying Cry","Ranged Attack Totem","Reave","Reckoning","Reduced Mana","Rejuvenation Totem","Remote Mine","Righteous Fire","Riposte","Ruthless Support","Scorching Ray","Searing Bond","Shield Charge","Shock Nova","Shockwave Totem","Shrapnel Shot","Siege Ballista","Slower Projectiles","Smoke Mine","Spark","Spectral Throw","Spell Cascade Support","Spell Echo","Spell Totem","Spirit Offering","Split Arrow","Static Strike","Storm Barrier Support","Storm Burst","Storm Call","Stun","Summon Chaos Golem","Summon Flame Golem","Summon Ice Golem","Summon Lightning Golem","Summon Raging Spirit","Summon Skeleton","Summon Stone Golem","Sunder","Sweep","Swift Affliction Support","Tempest Shield","Temporal Chains","Tornado Shot","Trap","Trap Cooldown","Trap and Mine Damage","Unbound Ailments Support","Unearth","Vaal Arc","Vaal Breach","Vaal Burning Arrow","Vaal Clarity","Vaal Cold Snap","Vaal Cyclone","Vaal Detonate Dead","Vaal Discipline","Vaal Double Strike","Vaal Fireball","Vaal Flameblast","Vaal Glacial Hammer","Vaal Grace","Vaal Ground Slam","Vaal Haste","Vaal Ice Nova","Vaal Immortal Call","Vaal Lightning Strike","Vaal Lightning Trap","Vaal Lightning Warp","Vaal Molten Shell","Vaal Power Siphon","Vaal Rain of Arrows","Vaal Reave","Vaal Righteous Fire","Vaal Spark","Vaal Spectral Throw","Vaal Storm Call","Vaal Summon Skeletons","Vengeance","Vigilant Strike","Vile Toxins Support","Viper Strike","Vitality","Void Manipulation","Volatile Dead","Volley Support","Vortex","Vulnerability","Warlord's Mark","Whirling Blades","Wild Strike","Wither","Wrath"],"Two Hand Sword":["Bastard Sword","Butcher Sword","Corroded Blade","Curved Blade","Engraved Greatsword","Etched Greatsword","Exquisite Blade","Ezomyte Blade","Footman Sword","Headman's Sword","Highland Blade","Infernal Sword","Lion Sword","Lithe Blade","Longsword","Ornate Sword","Reaver Sword","Spectral Sword","Tiger Sword","Two-Handed Sword","Vaal Greatsword","Wraith Sword"],"Jewel":["Cobalt Jewel","Crimson Jewel","Ghastly Eye Jewel","Hypnotic Eye Jewel","Murderous Eye Jewel","Prismatic Jewel","Searching Eye Jewel","Viridian Jewel"],"Bow":["Assassin Bow","Bone Bow","Citadel Bow","Composite Bow","Compound Bow","Crude Bow","Death Bow","Decimation Bow","Decurve Bow","Golden Flame","Grove Bow","Harbinger Bow","Highborn Bow","Imperial Bow","Ivory Bow","Long Bow","Maraketh Bow","Ranger Bow","Recurve Bow","Reflex Bow","Royal Bow","Short Bow","Sniper Bow","Spine Bow","Steelwood Bow","Thicket Bow"],"Gloves":["Ambush Mitts","Ancient Gauntlets","Antique Gauntlets","Arcanist Gloves","Assassin's Mitts","Bronze Gauntlets","Bronzescale Gauntlets","Carnal Mitts","Chain Gloves","Clasped Mitts","Conjurer Gloves","Crusader Gloves","Deerskin Gloves","Dragonscale Gauntlets","Eelskin Gloves","Embroidered Gloves","Fingerless Silk Gloves","Fishscale Gauntlets","Goathide Gloves","Golden Bracers","Goliath Gauntlets","Gripped Gloves","Hydrascale Gauntlets","Iron Gauntlets","Ironscale Gauntlets","Legion Gloves","Mesh Gloves","Murder Mitts","Nubuck Gloves","Plated Gauntlets","Rawhide Gloves","Ringmail Gloves","Riveted Gloves","Samite Gloves","Satin Gloves","Serpentscale Gauntlets","Shagreen Gloves","Sharkskin Gloves","Silk Gloves","Slink Gloves","Soldier Gloves","Sorcerer Gloves","Spiked Gloves","Stealth Gloves","Steel Gauntlets","Steelscale Gauntlets","Strapped Mitts","Titan Gauntlets","Trapper Mitts","Vaal Gauntlets","Velvet Gloves","Wool Gloves","Wrapped Mitts","Wyrmscale Gauntlets","Zealot Gloves"],"Map Fragments":["Divine Vessel","Eber's Key","Fragment of the Chimera","Fragment of the Hydra","Fragment of the Minotaur","Fragment of the Phoenix","Inya's Key","Mortal Grief","Mortal Hope","Mortal Ignorance","Mortal Rage","Offering to the Goddess","Sacrifice at Dawn","Sacrifice at Dusk","Sacrifice at Midnight","Sacrifice at Noon","Volkuur's Key","Yriel's Key"],"Quiver":["Blunt Arrow Quiver","Broadhead Arrow Quiver","Conductive Quiver","Cured Quiver","Fire Arrow Quiver","Heavy Quiver","Light Quiver","Penetrating Arrow Quiver","Rugged Quiver","Serrated Arrow Quiver","Sharktooth Arrow Quiver","Spike-Point Arrow Quiver","Two-Point Arrow Quiver"],"Divination Card":["A Mother's Parting Gift","Abandoned Wealth","Anarchy's Price","Assassin's Favour","Atziri's Arsenal","Audacity","Birth of the Three","Blind Venture","Boundless Realms","Bowyer's Dream","Call to the First Ones","Cartographer's Delight","Chaotic Disposition","Coveted Possession","Death","Destined to Crumble","Dialla's Subjugation","Doedre's Madness","Dying Anguish","Earth Drinker","Emperor of Purity","Emperor's Luck","Gemcutter's Promise","Gift of the Gemling Queen","Glimmer of Hope","Grave Knowledge","Her Mask","Heterochromia","Hope","House of Mirrors","Hubris","Humility","Hunter's Resolve","Hunter's Reward","Jack in the Box","Lantador's Lost Love","Last Hope","Left to Fate","Light and Truth","Lingering Remnants","Lost Worlds","Loyalty","Lucky Connections","Lucky Deck","Lysah's Respite","Mawr Blaidd","Merciless Armament","Might is Right","Mitts","No Traces","Pride Before the Fall","Prosperity","Rain Tempter","Rain of Chaos","Rats","Rebirth","Scholar of the Seas","Shard of Fate","Struck by Lightning","The Aesthete","The Arena Champion","The Artist","The Avenger","The Battle Born","The Betrayal","The Blazing Fire","The Body","The Brittle Emperor","The Calling","The Carrion Crow","The Cartographer","The Cataclysm","The Catalyst","The Celestial Justicar","The Chains that Bind","The Coming Storm","The Conduit","The Cursed King","The Dapper Prodigy","The Dark Mage","The Demoness","The Devastator","The Doctor","The Doppelganger","The Dragon","The Dragon's Heart","The Drunken Aristocrat","The Encroaching Darkness","The Endurance","The Enlightened","The Ethereal","The Explorer","The Eye of the Dragon","The Feast","The Fiend","The Fletcher","The Flora's Gift","The Formless Sea","The Forsaken","The Fox","The Gambler","The Garish Power","The Gemcutter","The Gentleman","The Gladiator","The Harvester","The Hermit","The Hoarder","The Hunger","The Immortal","The Incantation","The Inoculated","The Inventor","The Jester","The King's Blade","The King's Heart","The Last One Standing","The Lich","The Lion","The Lord in Black","The Lover","The Lunaris Priestess","The Mercenary","The Metalsmith's Gift","The Oath","The Offering","The One With All","The Opulent","The Pack Leader","The Pact","The Penitent","The Poet","The Polymath","The Porcupine","The Queen","The Rabid Rhoa","The Realm","The Risk","The Road to Power","The Ruthless Ceinture","The Saint's Treasure","The Scarred Meadow","The Scavenger","The Scholar","The Sephirot","The Sigil","The Siren","The Soul","The Spark and the Flame","The Spoiled Prince","The Standoff","The Stormcaller","The Summoner","The Sun","The Surgeon","The Surveyor","The Survivalist","The Thaumaturgist","The Throne","The Tower","The Traitor","The Trial","The Twins","The Tyrant","The Union","The Valkyrie","The Valley of Steel Boxes","The Vast","The Visionary","The Void","The Warden","The Warlord","The Watcher","The Web","The Wind","The Wolf","The Wolf's Shadow","The Wolven King's Bite","The Wolverine","The Wrath","The Wretched","Three Faces in the Dark","Thunderous Skies","Time-Lost Relic","Tranquillity","Treasure Hunter","Turn the Other Cheek","Vinia's Token","Volatile Power","Wealth and Power"],"Shield":["Alder Spiked Shield","Alloyed Spiked Shield","Ancient Spirit Shield","Angelic Kite Shield","Archon Kite Shield","Baroque Round Shield","Battle Buckler","Bone Spirit Shield","Branded Kite Shield","Brass Spirit Shield","Bronze Tower Shield","Buckskin Tower Shield","Burnished Spiked Shield","Cardinal Round Shield","Cedar Tower Shield","Ceremonial Kite Shield","Champion Kite Shield","Chiming Spirit Shield","Colossal Tower Shield","Compound Spiked Shield","Copper Tower Shield","Corroded Tower Shield","Corrugated Buckler","Crested Tower Shield","Crimson Round Shield","Crusader Buckler","Driftwood Spiked Shield","Ebony Tower Shield","Elegant Round Shield","Enameled Buckler","Etched Kite Shield","Ezomyte Spiked Shield","Ezomyte Tower Shield","Fir Round Shield","Fossilised Spirit Shield","Gilded Buckler","Girded Tower Shield","Goathide Buckler","Golden Buckler","Hammered Buckler","Harmonic Spirit Shield","Imperial Buckler","Ironwood Buckler","Ivory Spirit Shield","Jingling Spirit Shield","Lacewood Spirit Shield","Lacquered Buckler","Laminated Kite Shield","Layered Kite Shield","Linden Kite Shield","Mahogany Tower Shield","Maple Round Shield","Mirrored Spiked Shield","Mosaic Kite Shield","Oak Buckler","Ornate Spiked Shield","Painted Buckler","Painted Tower Shield","Pine Buckler","Pinnacle Tower Shield","Plank Kite Shield","Polished Spiked Shield","Rawhide Tower Shield","Redwood Spiked Shield","Reinforced Kite Shield","Reinforced Tower Shield","Rotted Round Shield","Scarlet Round Shield","Shagreen Tower Shield","Sovereign Spiked Shield","Spiked Bundle","Spiked Round Shield","Spiny Round Shield","Splendid Round Shield","Splintered Tower Shield","Steel Kite Shield","Studded Round Shield","Supreme Spiked Shield","Tarnished Spirit Shield","Teak Round Shield","Thorium Spirit Shield","Titanium Spirit Shield","Twig Spirit Shield","Vaal Buckler","Vaal Spirit Shield","Walnut Spirit Shield","War Buckler","Yew Spirit Shield"],"Dagger":["Ambusher","Boot Blade","Boot Knife","Butcher Knife","Carving Knife","Copper Kris","Demon Dagger","Ezomyte Dagger","Fiend Dagger","Flaying Knife","Glass Shank","Golden Kris","Gutting Knife","Imp Dagger","Imperial Skean","Platinum Kris","Poignard","Prong Dagger","Royal Skean","Sai","Skean","Skinning Knife","Slaughter Knife","Stiletto","Trisula"],"Leaguestone":["Ambush Leaguestone","Anarchy Leaguestone","Beyond Leaguestone","Bloodlines Leaguestone","Breach Leaguestone","Domination Leaguestone","Essence Leaguestone","Invasion Leaguestone","Nemesis Leaguestone","Onslaught Leaguestone","Perandus Leaguestone","Prophecy Leaguestone","Rampage Leaguestone","Talisman Leaguestone","Tempest Leaguestone","Torment Leaguestone","Warbands Leaguestone"],"Wand":["Carved Wand","Crystal Wand","Demon's Horn","Driftwood Wand","Engraved Wand","Faun's Horn","Goat's Horn","Heathen Wand","Imbued Wand","Omen Wand","Opal Wand","Pagan Wand","Profane Wand","Prophecy Wand","Quartz Wand","Sage Wand","Serpent Wand","Spiraled Wand","Tornado Wand"],"Essence":["Essence of Anger","Essence of Anguish","Essence of Contempt","Essence of Delirium","Essence of Doubt","Essence of Dread","Essence of Envy","Essence of Fear","Essence of Greed","Essence of Hatred","Essence of Horror","Essence of Hysteria","Essence of Insanity","Essence of Loathing","Essence of Misery","Essence of Rage","Essence of Scorn","Essence of Sorrow","Essence of Spite","Essence of Suffering","Essence of Torment","Essence of Woe","Essence of Wrath","Essence of Zeal","Remnant of Corruption"],"Boots":["Ambush Boots","Ancient Greaves","Antique Greaves","Arcanist Slippers","Assassin's Boots","Bronzescale Boots","Carnal Boots","Chain Boots","Clasped Boots","Conjurer Boots","Crusader Boots","Deerskin Boots","Dragonscale Boots","Eelskin Boots","Goathide Boots","Golden Caligae","Goliath Greaves","Hydrascale Boots","Iron Greaves","Ironscale Boots","Leatherscale Boots","Legion Boots","Mesh Boots","Murder Boots","Nubuck Boots","Plated Greaves","Rawhide Boots","Reinforced Greaves","Ringmail Boots","Riveted Boots","Samite Slippers","Satin Slippers","Scholar Boots","Serpentscale Boots","Shackled Boots","Shagreen Boots","Sharkskin Boots","Silk Slippers","Slink Boots","Soldier Boots","Sorcerer Boots","Stealth Boots","Steel Greaves","Steelscale Boots","Strapped Boots","Titan Greaves","Trapper Boots","Two-Toned Boots","Vaal Greaves","Velvet Slippers","Wool Shoes","Wrapped Boots","Wyrmscale Boots","Zealot Boots"],"Currency":["Albino Rhoa Feather","Ancient Orb","Ancient Shard","Annulment Shard","Apprentice Cartographer's Seal","Apprentice Cartographer's Sextant","Armourer's Scrap","Binding Shard","Blacksmith's Whetstone","Blessed Orb","Cartographer's Chisel","Chaos Orb","Chaos Shard","Chromatic Orb","Divine Orb","Engineer's Orb","Engineer's Shard","Eternal Orb","Exalted Orb","Exalted Shard","Gemcutter's Prism","Glassblower's Bauble","Harbinger's Orb","Harbinger's Shard","Horizon Shard","Jeweller's Orb","Journeyman Cartographer's Seal","Journeyman Cartographer's Sextant","Master Cartographer's Seal","Master Cartographer's Sextant","Mirror Shard","Mirror of Kalandra","Orb of Alchemy","Orb of Alteration","Orb of Annulment","Orb of Augmentation","Orb of Binding","Orb of Chance","Orb of Fusing","Orb of Horizons","Orb of Regret","Orb of Scouring","Orb of Transmutation","Perandus Coin","Portal Scroll","Regal Orb","Regal Shard","Scroll of Wisdom","Silver Coin","Stacked Deck","Unshaping Orb","Vaal Orb"],"Ring":["Amethyst Ring","Breach Ring","Coral Ring","Diamond Ring","Gold Ring","Golden Hoop","Iron Ring","Moonstone Ring","Opal Ring","Paua Ring","Prismatic Ring","Ruby Ring","Sapphire Ring","Steel Ring","Topaz Ring","Two-Stone Ring","Unset Ring"],"Belt":["Chain Belt","Cloth Belt","Crystal Belt","Golden Obi","Heavy Belt","Leather Belt","Rustic Sash","Studded Belt","Stygian Vise","Vanguard Belt"],"Staff":["Coiled Staff","Crescent Staff","Eclipse Staff","Ezomyte Staff","Foul Staff","Gnarled Branch","Highborn Staff","Imperial Staff","Iron Staff","Judgement Staff","Lathi","Long Staff","Maelström Staff","Military Staff","Moon Staff","Primitive Staff","Primordial Staff","Quarterstaff","Royal Staff","Serpentine Staff","Vile Staff","Woodful Staff"]}`)
            let name = group[0][group[0].length - 1]
            function getBase(name) {
                for (let i in bases) {
                    if (bases[i].indexOf(name) > -1) {
                        return i;
                    }
                }
                return null;
            }
            body.query.type = getBase(name);
            desc_list.push(`**Type: ${body.query.type}**`);
        }
        else {
            body.query.term = group[0][group[0].length - 1];
            desc_list.push(`**Name: ${body.query.term}**`);
        }

        let formose = false;
        if (group[group.length - 1][group[group.length - 1].length - 1] == "f") {
            formose = true;
        }
        if (group[group.length - 1][group[group.length - 1].length - 1] != "x") {
            let itemlevel = group.findIndex((e) => {
                return e[0].match(/Item Level: (\d+)/g)
            });
            if (itemlevel > -1) {
                itemlevel++;
                if (group[itemlevel][0] !== "Unidentified") {
                    let totalresist = 0;
                    let totalhealth = 0;
                    let chaosresist = 0;
                    function addToFilter(type, found) {
                        if (found.length == 1) {
                            let modobj = {
                                id: found[0][0]
                            }
                            let line = `${type} ${found[0][1]}`;
                            if (found[0][2]) {
                                modobj.value = {
                                    min: found[0][2]
                                }
                                line += ` (min: ${found[0][2]})`;
                            }
                            body.query.stats[0].filters.push(modobj)
                            desc_list.push(line);
                        } else if (found.length > 1) {
                            desc_list.push(`Either`);
                            let filters = found.map(mod => {
                                let modobj = {
                                    id: mod[0]
                                }
                                let line = `• ${type} ${mod[1]}`;
                                if (mod[2]) {
                                    modobj.value = {
                                        min: mod[2]
                                    }
                                    line += ` (min: ${mod[2]})`;
                                }
                                desc_list.push(line);
                                return modobj
                            })
                            body.query.stats.push({
                                filters,
                                type: "count",
                                value: {
                                    min: 1
                                }
                            })
                        }
                    }

                    if (group[itemlevel].length === 1) {
                        let e = group[itemlevel][0];
                        let b;
                        if (b = /^([+-]?\d+)% to (Fire|Cold|Lightning) Resistance/.exec(e)) {
                            totalresist += parseInt(b[1]);
                        }
                        else if (b = /^([+-]?\d+)% to (Fire|Cold|Lightning) and (Fire|Cold|Lightning) Resistances/.exec(e)) {
                            totalresist += parseInt(b[1]) * 2;
                        }
                        else if (b = /^([+-]?\d+)% to all Elemental Resistances/.exec(e)) {
                            totalresist += parseInt(b[1]) * 3;
                        }
                        else if (b = /^([+-]?\d+) to maximum Life/.exec(e)) {
                            totalhealth += parseInt(b[1]);
                        }
                        else {
                            if (!formose && (b = /^(.*) \(implicit\)$/.exec(e))) {
                                let found = getModID(b[1], "Implicit");
                                addToFilter("(implicit) ", found)
                            }
                        }
                        itemlevel++;
                    }
                    if (itemlevel < group.length) {
                        group[itemlevel].forEach((e) => {
                            let b;
                            //+?123%? anything
                            if (b = /^([+-]?\d+)% to (Fire|Cold|Lightning) Resistance$/.exec(e)) {
                                totalresist += parseInt(b[1]);
                            }
                            else if (b = /^([+-]?\d+)% to (Fire|Cold|Lightning) and (Fire|Cold|Lightning) Resistances/.exec(e)) {
                                totalresist += parseInt(b[1]) * 2;
                            }
                            else if (b = /^([+-]?\d+)% to all Elemental Resistances/.exec(e)) {
                                totalresist += parseInt(b[1]) * 3;
                            }
                            else if (b = /^([+-]?\d+)% to Chaos Resistance/.exec(e)) {
                                chaosresist += parseInt(b[1]);
                            }
                            else if (b = /^([+-]?\d+) to maximum Life/.exec(e)) {
                                totalhealth += parseInt(b[1]);
                            }
                            else {
                                if (!formose) {
                                    let found = getModID(e, "Explicit");
                                    addToFilter("", found)
                                }
                            }
                        })
                    }

                    if (formose) {
                        if (totalresist + totalhealth > 0) {
                            body.query.stats.push({
                                filters: [{
                                    id: "pseudo.pseudo_total_resistance"
                                }, {
                                    id: "pseudo.pseudo_total_life"
                                }],
                                type: "weight",
                                value: {
                                    min: totalresist + totalhealth + chaosresist
                                }
                            })
                            desc_list.push(`(pseudo) +#% total Resistance`);
                            desc_list.push(`(pseudo) +# total maximum Life`);
                            desc_list.push(`Group total (min: ${totalresist + totalhealth + chaosresist})`);
                        }
                    }
                    else {
                        if (totalresist != 0) {
                            body.query.stats[0].filters.push({
                                id: "pseudo.pseudo_total_elemental_resistance",
                                value: {
                                    min: totalresist
                                }
                            })
                            desc_list.push(`(pseudo) +#% total Elemental Resistance (min: ${totalresist})`);
                        }
                        if (totalhealth != 0) {
                            body.query.stats[0].filters.push({
                                id: "pseudo.pseudo_total_life",
                                value: {
                                    min: totalhealth
                                }
                            })
                            desc_list.push(`(pseudo) (total) +# to maximum Life (min: ${totalhealth})`);
                        }
                    }
                }
            }
        }
    } else {
        desc_list.push(`**Name: ${interaction.options.data[0].value}**`);
    }
    rich.setDescription(desc_list.join("\n"));
    let data;
    try {
        data = await fetch(`https://www.pathofexile.com/api/trade/search/${encodeURIComponent(poeleague)}`,{
            method: "POST",
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
            }
        }).then(res => res.json());
    } catch(e){
        try {
            if (e.error.error.code == 2) {
                if (!(await checkLeague(poeleague))) {
                    return setLeague("Update your league", interaction, async () => {
                        let itemsearch = await poesearch(interaction);
                        return itemsearch;
                    });
                } else {
                    return "`No results`"
                }
            }
        } catch (e2) {
            throw e;
        }
    }
    rich.setURL(`https://www.pathofexile.com/trade/search/${encodeURIComponent(poeleague)}/${data.id}`);
    rich.setTitle("Results - " + poeleague);
    rich.setFooter('Type "setpoeleague" to change your PoE league')

    if (data.total < 1) {
        rich.setDescription(desc_list.join("\n") + "\n\n**No results found**")
        return rich;
    }

    let hashstring = data.result.slice(0, 6).join(",");
    data = await fetch(`https://www.pathofexile.com/api/trade/fetch/${hashstring}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.111 Safari/537.36'
        }
    }).then(res => res.json());
    data.result.forEach(ele => {
        let time = moment(ele.listing.indexed).fromNow();
        let status = "offline"
        if (ele.listing.account.online) {
            if (ele.listing.account.online.status) {
                status = ele.listing.account.online.status
            } else {
                status = "online"
            }
        } else {
            status = "offline";
        }
        let desc = `${time}\n${status}`
        if (ele.listing.price) {
            desc = `${ele.listing.price.amount} ${ele.listing.price.currency}\n${desc}`
        }
        rich.addField(escapeMarkdownText(`${ele.item.name} ${ele.item.typeLine}`), escapeMarkdownText(desc), true);
    })
    return rich;
}

export default new Command({
	name: 'poetrade',
    description: 'returns poe.trade items',
    type: "CHAT_INPUT",
    options: [{
        name: 'search-term',
        type: 'STRING',
        description: 'term to search or random',
        required: true,
    }],
	async execute(interaction) {
        return poesearch(interaction)
    }
})