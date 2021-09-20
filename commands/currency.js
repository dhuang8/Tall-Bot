"use strict";
const Command = require('../util/Command');
const fetch = require('node-fetch');

module.exports = new Command({
	name: 'currency',
    description: 'exchange rates for foreign currencies',
    type: "CHAT_INPUT",
    options: [{
        name: 'from-symbol',
        type: 'STRING',
        description: 'currency symbol you are exchanging from',
        required: true,
    },{
        name: 'to-symbol',
        type: 'STRING',
        description: 'currency symbol you are exchanging to. default: USD'
    },{
        name: 'amount',
        type: 'INTEGER',
        description: 'amount. default: 1',
    }],
	async execute(interaction) {
        let from = interaction.options.data[0].value.toUpperCase();
        let to = interaction.options.data.find(opt=>{
            return opt.name == "to-symbol";
        })?.value.toUpperCase() ?? "USD";
        let amt = interaction.options.data.find(opt=>{
            return opt.name == "amount";
        })?.value ?? 1;
        const response = await fetch(`http://data.fixer.io/api/latest?access_key=60f56846eb49204d79b8398921edb041`).then(res => res.json());
        if (response.error) return "`" + response.error.info + "`";
        if (!response.rates[to] || !response.rates[from]) return "`You have provided one or more invalid Currency Codes. [Required format: currencies=EUR,USD,GBP,...]`"
        let rate = response.rates[to] / response.rates[from];
        return `\`${amt} ${from} = ${Math.round(amt * rate * 1000000) / 1000000} ${to}\``
    }
})