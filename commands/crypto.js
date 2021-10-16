"use strict";
const Command = require('../util/Command');
const {MessageEmbed,MessageAttachment} = require('discord.js');
const fetch = require('node-fetch');
const { CanvasRenderService } = require('chartjs-node-canvas');
const moment = require('moment-timezone');

moment.tz.setDefault("America/New_York");

let coin = null;
(async()=>{
    coin = await fetch(`https://www.cryptocompare.com/api/data/coinlist/`).then(res => res.json());
})();

const canvasRenderService = new CanvasRenderService(400, 225, (ChartJS) => {
    //const canvasRenderService = new CanvasRenderService(729, 410, (ChartJS) => {
    ChartJS.defaults.global.legend.display = false;
    ChartJS.defaults.global.legend.labels.fontStyle = "bold";
    ChartJS.defaults.global.legend.labels.fontSize = 10;
    ChartJS.defaults.global.showLines = true;
    //ChartJS.defaults.global.spanGaps = true;
    ChartJS.defaults.global.elements.line.tension = 0;
    ChartJS.defaults.line.scales.xAxes[0].ticks = {
        callback: (tick) => {
            if (tick == "") return undefined;
            return tick;
        },
        fontStyle: "bold",
        fontSize: 10,
        autoSkip: false,
        maxRotation: 0
    }
    ChartJS.defaults.line.scales.yAxes[0].ticks = {
        fontStyle: "bold",
        fontSize: 10
    }

    let scatterScale = ChartJS.scaleService.getScaleConstructor('linear').extend ({
        buildTicks: function() {
            this.ticks = this.chart.config.data.labels;
            this.ticksAsNumbers = this.chart.config.data.labels.map(label=>{
                return label.tick;
            })
            this.zeroLineIndex = this.ticks.indexOf(0);
        },        
        convertTicksToLabels: function() {
            this.ticks = this.chart.config.data.labels.map(label=>{
                return label.label;
            })
        }
    });
    ChartJS.scaleService.registerScaleType('scatterScale', scatterScale, ChartJS.scaleService.getScaleDefaults("linear"));
});

function createChartStream(configuration) {
    return canvasRenderService.renderToStream(configuration);
}

module.exports = new Command({
	name: 'crypto',
    description: 'returns cryptocurrency prices',
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
        let price_prom = fetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${encodeURIComponent(from)}&tsyms=${encodeURIComponent(to)}`).then(res => res.json());
        let res = await fetch(`https://min-api.cryptocompare.com/data/histominute?fsym=${encodeURIComponent(from)}&tsym=${encodeURIComponent(to)}&limit=144&aggregate=10`).then(res => res.json());
        if (res.Response && res.Response === "Error") {
            return "`" + res.Message + "`";
        }

        let datapoints = res.Data.map(data => {
            return data.close;
        })
        let labels = res.Data.map(data => {
            let thisMoment = moment.tz(data.time * 1000, "America/New_York");
            if (thisMoment.minute() == 0 && thisMoment.hour() % 3 == 0) {
                if (thisMoment.hour() == 0) return thisMoment.format("ddd");
                return thisMoment.format("ha");
            } else {
                return "";
            }
        })

        const configuration = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: datapoints,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    pointRadius: 0
                }]
            },
            options: {
                scales: {
                    yAxes: [{
                        ticks: {
                            callback: (value) => {
                                if (value % 1 == 0) {
                                    return '$' + value
                                } else if (value < .01) {
                                    return '$' + value;
                                }
                                return '$' + value.toFixed(2);
                            },
                            fontStyle: "bold",
                            fontSize: 10
                        }
                    }]
                }
            }
        };
        let rich = new MessageEmbed();

        res = await price_prom;
        if (res.Response && res.Response === "Error") {
            let msg = res.Message;
            return "`" + msg + "`";
        }
        let fromsym = res.DISPLAY[from][to].FROMSYMBOL;
        if (fromsym == from) fromsym = "";
        let tosym = res.DISPLAY[from][to].TOSYMBOL;
        if (tosym == to) tosym = "";
        let to_amt = amt * res.RAW[from][to].PRICE;
        let pctchange = Math.abs(res.DISPLAY[from][to].CHANGEPCT24HOUR);
        let updown = "";
        if (res.DISPLAY[from][to].CHANGEPCT24HOUR > 0) updown = "▲";
        else if (res.DISPLAY[from][to].CHANGEPCT24HOUR < 0) updown = "▼";
        let image = "";
        if (coin && coin.Data[from]) {
            image = "https://www.cryptocompare.com" + coin.Data[from].ImageUrl
            from += ` (${coin.Data[from].CoinName})`;
        }
        if (coin && coin.Data[to]) to += ` (${coin.Data[to].CoinName})`;
        let msg = `${fromsym} ${amt} ${from} = ${tosym} ${to_amt} ${to} (${updown}${pctchange}%)`;

        let stream = createChartStream(configuration);
        rich.setAuthor(msg, image);
        rich.setFooter("Time is in EDT, the only relevant timezone.");
        let file = new MessageAttachment(stream, `chart.png`);
        rich.setImage(`attachment://chart.png`)
        return {embeds: [rich], files: [file]};

        return rich;
    }
})