import gw2 from "./gw2.js";
import Util from '../util/functions.js';
import config from '../util/config.js';
import sql from '../util/SQLite.js';

let bad_key = "C123123D-D123-4321-AXEO-OANTEUH894A9AOEGU891-YDCH-3456-AEOU-TNHAO9HAI845"
let good_key = config.api.gw2

function setKey(key) {
    let stmt = sql.prepare("INSERT INTO users(user_id,gw2key) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET gw2key=excluded.gw2key;");
    stmt.run("113060802252054528", key);
}

test('key set', async () => {
    let response = await gw2.execute(Util.createInteractionOptions(
        ["key", "set", good_key], "113060802252054528"
    ));
    expect(response.content).toBe("`API key set`");
});

test('bad key set', async () => {
    let response = await gw2.execute(Util.createInteractionOptions(
        ["key", "set", bad_key], "113060802252054528"
    ));
    expect(response.content).toMatch(/Invalid/);
});

test('key get', async () => {
    let response = await gw2.execute(Util.createInteractionOptions(["key", "get"], "113060802252054528"));
    expect(response.content).toBe("`54BA92FB-DE02-9543-B592-A7ABC054A4ABF9182324-CDEC-47C6-A052-55D7B059EE4C`");
});

test('full-mat', async () => {
    let response = await gw2.execute(Util.createInteractionOptions(["full-mat"], "113060802252054528"));
    expect(response.title).toBe("Full materials in storage");
});

test('item search', async () => {
    let embed = await gw2.execute(Util.createInteractionOptions(["item", "shard"], "113060802252054528"));
    expect(embed.title).toBe("Item search - shard");
}, 20000);

test('item search invalid key', async () => {
    setKey(bad_key);
    let embed = await gw2.execute(Util.createInteractionOptions(["item", "shard"], "113060802252054528"));
    expect(embed).toMatch(/Invalid/);
    setKey(good_key);
}, 20000);

test('daily', async () => {
    let embed = await gw2.execute(Util.createInteractionOptions(["daily"], "113060802252054528"));
    expect(embed.title).toBe("Dailies");
});

test('daily invalid key', async () => {
    setKey(bad_key);
    let embed = await gw2.execute(Util.createInteractionOptions(["daily"], "113060802252054528"));
    expect(embed).toMatch(/Invalid/);
    setKey(good_key);
});