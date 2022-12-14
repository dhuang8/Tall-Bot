"use strict";
import Command from '../util/Command.js';
import {MessageAttachment} from 'discord.js';
import sql from '../util/SQLite.js';

export default new Command({
	name: 'rank',
    description: 'have a trophy',
    type: "CHAT_INPUT",
    options: [],
	async execute(interaction) {
        let stmt = sql.prepare("SELECT rank FROM (SELECT ROW_NUMBER() OVER (ORDER BY points DESC) rank, user_id FROM users) WHERE user_id = ?;")
        let rank = stmt.get(interaction.user.id).rank
        let url = "";
        if (rank < 3) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/a/a4/League_division_S.png";
        } else if (rank < 10) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/c/c3/League_division_A.png";
        } else if (rank < 30) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/6/6b/League_division_B.png";
        } else if (rank < 50) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/4/43/League_division_C.png";
        } else if (rank < 70) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/2/23/League_division_D.png";
        } else if (rank < 100) {
            url = "https://vignette.wikia.nocookie.net/sonic/images/9/9c/League_division_E.png";
        } else {
            url = "https://vignette.wikia.nocookie.net/sonic/images/c/cd/League_division_F.png";
        }
        let attach = new MessageAttachment(url);
        return attach;
    }
})