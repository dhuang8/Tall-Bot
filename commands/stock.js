"use strict";
import Command from '../util/Command.js';
import {MessageEmbed,MessageAttachment} from 'discord.js';
import fetch from 'node-fetch';
import { CanvasRenderService } from 'chartjs-node-canvas';
import config from '../util/config.js';
import moment from 'moment-timezone';
//const annotation = require('chartjs-plugin-annotation');

moment.tz.setDefault("America/New_York");

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

function escapeMarkdownText(str, noemotes = true) {
    if (noemotes) {
        return str.replace(/([\\\(\)*_~<>`])/g, '\\\$1')
    } else {
        return str.replace(/([\\\(\)*_~`])/g, '\\\$1')
    }
}

function getDefaultConfiguration() {
    return {
        type: 'line',
        data: {
            datasets: [{
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                pointRadius: 0
            }]
        },
        //plugins: [annotation],
        options: {
            annotation: {
                annotations: null
            },
            scales: {
                xAxes: [],
                yAxes: [{
                    ticks: {
                        fontStyle: "bold",
                        fontSize: 10
                    }
                }]
            }
        }
    };
}

function createChartStream(configuration) {
    return canvasRenderService.renderToStream(configuration);
}

export default new Command({
	name: 'stock',
    description: 'returns price and chart of a stock',
    type: "CHAT_INPUT",
    options: [{
        name: 'stock-symbol',
        type: 'STRING',
        description: 'stock symbol',
        required: true,
    }],
	async execute(interaction) {
        //https://iexcloud.io/console/usage
        //https://iexcloud.io/docs/api/#historical-prices
        let base = `https://cloud.iexapis.com/stable/`;
        let symbol = interaction.options.data[0].value;
        let token = config.api.stock;

        let response = await fetch(`${base}ref-data/us/dates/trade/last/2?token=${token}`).then(res => res.json());
        let promprice = fetch(`${base}stock/${symbol}/quote?token=${token}`).then(res => res.json());
        let promlist = [];
        response.forEach(data => {
            promlist.push(fetch(`${base}stock/${symbol}/chart/date/${data.date.replace(/-/g, "")}?token=${token}&chartInterval=1`).then(res => res.json()))
        })
        try {
            response = await fetch(`${base}stock/${symbol}/intraday-prices?token=${token}&chartInterval=1`).then(res => res.json());
        } catch (e) {
            if (e.error == "Unknown symbol") return `\`${e.error}\``;
        }
        response = response;
        let stock_data = response;
        let thisdate = stock_data.length > 0 ? stock_data[0].date : "";
        for (let promnum = 0; promnum < promlist.length; promnum++) {
            response = await promlist[promnum]
            if (response[0].date == thisdate) {
                continue;
            }
            stock_data = response.concat(stock_data);
        }
        stock_data = stock_data.map((data, index) => {
            return {
                close: data.close,
                index: index,
                time: moment.tz(`${data.date} ${data.minute}`, "YYYY-MM-DD HH:mm", "America/New_York")
            }
        })
        let stock_price = await promprice;
        let horizontal = []
        let labels = [];
        let datapoints = [];
        let previouspoint = stock_data[0].time;
        let offset = 0;
        function addLabelsForDate(time) {
            let time2 = time.clone().hour(9).minute(30).seconds(0);
            horizontal.push(time2.unix() - offset);
            labels.push({
                tick: time2.unix() - offset,
                label: time2.format("MMM D")
            })
            time2.hour(12).minute(0).seconds(0);
            if (time2.isSameOrAfter(time)) return;
            labels.push({
                tick: time2.unix() - offset,
                label: time2.format("ha")
            })
            time2.hour(14).minute(0).seconds(0);
            if (time2.isSameOrAfter(time)) return;
            labels.push({
                tick: time2.unix() - offset,
                label: time2.format("ha")
            })
        }
        stock_data.forEach((data, ind, arr) => {
            if (previouspoint.date() != data.time.date()) {
                addLabelsForDate(previouspoint)
                offset += data.time.diff(previouspoint, "seconds")
            }
            if (!data.close) return;
            datapoints.push({
                x: data.time.unix() - offset,
                y: data.close
            })
            previouspoint = data.time;
        })
        addLabelsForDate(previouspoint)
        let time2 = previouspoint.clone().hour(3).minute(59).seconds(0);
        if (time2.isSameOrAfter(previouspoint)) {
            labels.push({
                tick: time2.unix() - offset,
                label: "4pm"
            })
        }

        let annotations = horizontal.map(label => {
            return {
                type: "line",
                mode: "vertical",
                scaleID: "x-axis-0",
                value: label,
                borderColor: 'rgba(255, 255, 255, 1)',
                borderWidth: 1
            }
        })
        //https://www.chartjs.org/docs/latest/configuration/
        let configuration = getDefaultConfiguration();
        configuration.type = 'line';
        configuration.data.labels = labels;
        configuration.data.datasets[0].data = datapoints
        configuration.options.annotation.annotations = annotations;
        configuration.options.scales.xAxes[0] = {type: "scatterScale"};
        configuration.options.interaction = {mode: "point"};
        configuration.options.scales.yAxes[0].ticks.callback = (value) => {
            if (value % 1 == 0) {
                return '$' + value
            } else if (value < .01) {
                return '$' + value;
            }
            return '$' + value.toFixed(2);
        }

        let stream = createChartStream(configuration);
        let updown = "";
        if (stock_price.change > 0) updown = "▲";
        else if (stock_price.change < 0) updown = "▼";
        let rich = new MessageEmbed();
        rich.setTitle(escapeMarkdownText(stock_price.companyName));
        rich.setDescription(`${stock_price.symbol} $${stock_price.latestPrice} (${updown}${Math.abs(stock_price.change)}%)`);
        let file = new MessageAttachment(stream, `chart.png`);
        rich.setImage(`attachment://chart.png`)
        return {embeds: [rich], files: [file]};
    }
})