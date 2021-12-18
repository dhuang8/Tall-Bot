"use strict";
const Command = require('../util/Command');
const {MessageEmbed, MessageAttachment} = require('discord.js');
const fetch = require('node-fetch');
const { CanvasRenderService } = require('chartjs-node-canvas');
const moment = require('moment-timezone');
const csv=require('csvtojson')

//moment.tz.setDefault("America/New_York");

function createChartStream(configuration) {
    return canvasRenderService.renderToStream(configuration);
}

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

let covid_countries = [];
let covid_states = [];

try {
    fetch("https://covidtracking.com/api/v1/states/info.json").then(res => res.json()).then(json => {
        covid_states = json.map(state=>{
            return {
                initial: state.state,
                name: state.name
            }
        })
    })
    
    fetch("https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/locations.csv").then(res => res.text()).then(text => {
        csv().fromString(text).then(jsondata=>{
            covid_countries = jsondata.map(country=>{
                return {
                    initial: country.iso_code,
                    name: country.location
                }
            })
        })
    })
} catch (e) {
    console.error(e);
}

let covid_provinces = {"Alberta":"AB",
    "British Columbia":"BC",
    "Manitoba":"MB",
    "New Brunswick":"NB",
    "Newfoundland and Labrador":"NL",
    "Northwest Territories":"NT",
    "Nova Scotia":"NS",
    "Nunavut":"NU",
    "Ontario":"ON",
    "Prince Edward Island":"PE",
    "Quebec":"QC",
    "Saskatchewan":"SK",
    "Yukon":"YT",
    "Repatriated Travellers":"RT"};

function getDefaultConfiguration(){
    return {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            scales:{
                xAxes: [{type: "scatterScale"}]
            },
            legend: {
                display: true
            }
        },
        interaction: {mode: "point"}
    };
}

module.exports = new Command({
	name: 'covid',
    description: 'returns covid data for country or state/province',
    type: "CHAT_INPUT",
    options: [{
        name: 'type',
        type: 'STRING',
        description: 'vaccine or new cases',
        required: true,
        choices: [{
            name: "cases",
            value: "cases"
        },{
            name: "vaccine",
            value: "vaccine"
        }],
    },{
        name: 'location',
        type: 'STRING',
        description: 'country or state',
        required: true,
    }],
	async execute(interaction) {
        console.log(interaction.options.data[1].value);
        let state = covid_states.find(state=>{
            if (state.name.toLowerCase() === interaction.options.data[1].value.toLowerCase()) return true;
            if (state.initial.toLowerCase() === interaction.options.data[1].value.toLowerCase()) return true;
            return false;
        })
        if (state !== undefined) {                
            if (interaction.options.data[0].value == "vaccine") {
                if (state.initial == "NY") state.name = "New York State";
                let text = await fetch(`https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/us_state_vaccinations.csv`).then(res => res.text());
                let jsondata = await csv().fromString(text)
                jsondata = jsondata.filter(row=>{
                    return row.location == state.name;
                })
                let vaccinated = [];
                let fullyvaccinated = [];
                let step = parseInt(jsondata.length / 5);
                let labels = [];

                jsondata.forEach((row,index)=>{
                    let time = moment(row.date, "YYYY-MM-DD");
                    let x = time.unix()/86400;
                    if (row.people_vaccinated_per_hundred) {
                        vaccinated.push({
                            x,
                            y: row.people_vaccinated_per_hundred
                        });
                    }
                    if (row.people_fully_vaccinated_per_hundred){
                        fullyvaccinated.push({
                            x,
                            y: row.people_fully_vaccinated_per_hundred
                        })
                    }
                    if (index == jsondata.length-1) labels.push({tick: x , label: time.format("MMM D")});
                    else if (index > jsondata.length-step/2) {}
                    else if (index % step == 0) labels.push({tick: x,label: time.format("MMM D")});
                    //else labels.push({x,y:""});
                })
                let chartconfig = getDefaultConfiguration();
                chartconfig.data.labels = labels;
                chartconfig.data.datasets.push({
                    label: "vaccinated",
                    data: vaccinated,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                },{
                    label: "fully vaccinated",
                    data: fullyvaccinated,
                    borderColor: 'rgba(99, 132, 255, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                })
                chartconfig.options.scales.yAxes = [{
                    ticks: {
                        callback: (value) => {
                            return value + "%";
                        }
                    }
                }]
        
                let stream = createChartStream(chartconfig);
                let rich = new MessageEmbed()
                let file = new MessageAttachment(stream, `chart.png`);
                rich.setImage(`attachment://chart.png`)
                return {embeds: [rich], files: [file]};
                return rich;
            } else if (interaction.options.data[0].value == "cases") {
                let data = await fetch(`https://jhucoronavirus.azureedge.net/api/v1/timeseries/us/cases/${state.initial}.json`).then(res => res.json());
                let cases = [];
                let labels = []
                let infected = false;
                let step = parseInt(Object.keys(data).length / 5);
                Object.keys(data).forEach((key,index)=>{
                    if (!infected && data[key]["7-day_avg"] > 0) infected = true;
                    if (infected) {
                        let time = moment(key, "YYYY-MM-DD");
                        let x = time.unix()/86400;
                        cases.push({
                            x,
                            y: data[key]["7-day_avg"]
                        })
                        if (index == Object.keys(data).length-1) labels.push({tick: x , label: time.format("MMM D")});
                        else if (index > Object.keys(data).length-step/2) {}
                        else if (index % step == 0) labels.push({tick: x,label:time.format("MMM D")});
                    }
                })
                let chartconfig = getDefaultConfiguration();
                chartconfig.data.labels = labels;
                chartconfig.data.datasets = [{
                    label: "new cases",
                    data: cases,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                }]
                let stream = createChartStream(chartconfig);
                let rich = new MessageEmbed()
                rich.setTitle(state.name)
                let file = new MessageAttachment(stream, `chart.png`);
                rich.setImage(`attachment://chart.png`)
                return {embeds: [rich], files: [file]};
            }
        }
        let country = covid_countries.find(country=>{
            if (country.name.toLowerCase() === interaction.options.data[1].value.toLowerCase()) return true;
            if (country.initial.toLowerCase() === interaction.options.data[1].value.toLowerCase()) return true;
            return false;
        })
        if (country !== undefined) {
            if (interaction.options.data[0].value == "vaccine") {
                let text = await fetch(`https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/vaccinations.csv`).then(res => res.text());
                let jsondata = await csv().fromString(text)
                jsondata = jsondata.filter(row=>{
                    return row.location == country.name;
                })
                let vaccinated = [];
                let fullyvaccinated = [];
                let step = parseInt(jsondata.length / 5);
                let labels = [];

                jsondata.forEach((row,index)=>{
                    let time = moment(row.date, "YYYY-MM-DD");
                    let x = time.unix()/86400;
                    if (row.people_vaccinated_per_hundred) {
                        vaccinated.push({
                            x,
                            y: row.people_vaccinated_per_hundred
                        });
                    }
                    if (row.people_fully_vaccinated_per_hundred){
                        fullyvaccinated.push({
                            x,
                            y: row.people_fully_vaccinated_per_hundred
                        })
                    }
                    if (index == jsondata.length-1) labels.push({tick: x , label: time.format("MMM D")});
                    else if (index > jsondata.length-step/2) {}
                    else if (index % step == 0) labels.push({tick: x,label: time.format("MMM D")});
                    //else labels.push({x,y:""});
                })
                let chartconfig = getDefaultConfiguration();
                chartconfig.data.labels = labels;
                chartconfig.data.datasets.push({
                    label: "vaccinated",
                    data: vaccinated,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                },{
                    label: "fully vaccinated",
                    data: fullyvaccinated,
                    borderColor: 'rgba(99, 132, 255, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                })
                chartconfig.options.scales.yAxes = [{
                    ticks: {
                        callback: (value) => {
                            return value + "%";
                        }
                    }
                }]
        
                let stream = createChartStream(chartconfig);/*
                let desc_lines = []
                desc_lines.push(`Total cases: ${current.cases}`)
                desc_lines.push(`Total active: ${current.active}`)
                desc_lines.push(`Total recovered: ${current.recovered}`)
                desc_lines.push(`Total deaths: ${current.deaths}`)
                desc_lines.push(`Yesterday new cases: ${active_cases[active_cases.length-1]}`)
                desc_lines.push(`Yesterday deaths: ${history.deaths[dates[dates.length-1]]-history.deaths[dates[dates.length-2]]}`)*/
                let rich = new MessageEmbed()
                //rich.setDescription(desc_lines.join("\n"));
                rich.setTitle(country.name)
                let file = new MessageAttachment(stream, `chart.png`);
                rich.setImage(`attachment://chart.png`)
                return {embeds: [rich], files: [file]};
            } else {
                let data = await fetch(`https://corona.lmao.ninja/v2/historical/${country.initial}?lastdays=all`).then(res=>res.json());
                let active_cases = [];
                let dates = Object.keys(data.timeline.cases)
                let labels = [];
                
                let infected = false;
                let start = 0;
                let step = parseInt(dates.length / 5);
                for (let i=1;i<dates.length;i++) {
                    if (!infected && data.timeline.cases[dates[i]] > 0) {
                        infected = true;
                        start = i;
                    }
                    if (infected) {
                        let time = moment(dates[i], "M/D/YY");
                        let x = time.unix()/86400;
                        active_cases.push({
                            x,
                            y: Math.max(data.timeline.cases[dates[i]]-data.timeline.cases[dates[i-1]],0)
                        })
                        if (i == dates.length-1) labels.push({tick: x , label: time.format("MMM D")});
                        else if (i > dates.length-step/2) {}
                        else if (i % step == start) labels.push({tick: x,label:time.format("MMM D")});
                    }
                }
                let chartconfig = getDefaultConfiguration();
                chartconfig.data.labels = labels;
                chartconfig.data.datasets = [{
                    label: "new cases",
                    data: active_cases,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2,
                    pointRadius: 0
                }]
                let stream = createChartStream(chartconfig);
                let rich = new MessageEmbed()
                rich.setTitle(country.name)
                let file = new MessageAttachment(stream, `chart.png`);
                rich.setImage(`attachment://chart.png`)
                return {embeds: [rich], files: [file]};
            }
        }
        return "`Could not find country or state`";
    }
})