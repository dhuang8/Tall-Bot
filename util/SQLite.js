import Database from "better-sqlite3";

const sql = new Database('sqlitedb/discord.sqlite'/*, { verbose: console.log }*/);

if (sql.pragma("user_version")[0].user_version == 0) {
    sql.prepare("ALTER TABLE users ADD COLUMN gw2key TEXT").run();
    sql.pragma("user_version = 1");
}

if (sql.pragma("user_version")[0].user_version == 1) {
    sql.prepare("ALTER TABLE users ADD COLUMN gw2tracker TEXT").run();
    sql.pragma("user_version = 2");
}

if (sql.pragma("user_version")[0].user_version == 2) {
    sql.prepare("ALTER TABLE channels ADD COLUMN gw2timer TEXT").run();
    sql.pragma("user_version = 3");
}

export default sql;