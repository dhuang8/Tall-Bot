const Database = require("better-sqlite3");

const sql = new Database('sqlitedb/discord.sqlite'/*, { verbose: console.log }*/);

module.exports = sql;