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

if (sql.pragma("user_version")[0].user_version == 3) {
    sql.prepare("ALTER TABLE users ADD COLUMN birthday_channel TEXT").run();
    sql.pragma("user_version = 4");
}

if (sql.pragma("user_version")[0].user_version == 4) {
    sql.prepare("ALTER TABLE users ADD COLUMN hsr_cookie TEXT;").run();
    sql.prepare("ALTER TABLE users ADD COLUMN hsr_uid INTEGER;").run();
    sql.pragma("user_version = 5");
}

if (sql.pragma("user_version")[0].user_version == 5) {
    sql.prepare("ALTER TABLE users ADD COLUMN genshin_uid INTEGER;").run();
    sql.prepare("ALTER TABLE users ADD COLUMN hsr_cookie2 TEXT;").run();
    sql.pragma("user_version = 6");
}
export default sql;