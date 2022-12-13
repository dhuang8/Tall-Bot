"use strict";
import Command from '../util/Command.js';
import f from '../util/functions.js';
import {MessageEmbed, MessageAttachment} from 'discord.js';
import fetch from 'node-fetch';
import moment from 'moment-timezone';
import config from '../util/config.js';

moment.tz.setDefault("America/New_York");

function wordWrap(str, length) {
    let words = str.split(" ");
    let lines = [];
    let count = 0;
    let cur_words = [];
    let cur_length = 0;
    while (count < words.length) {
        if (cur_words.length == 0 || cur_length + words[count].length + 1 <= length) {
            if (cur_words.length > 0) cur_length++;
            cur_length += words[count].length;
            cur_words.push(words[count]);
            count++;
        } else {
            lines.push(cur_words.join(" "));
            cur_words = [];
            cur_length = 0;
        }
    }
    lines.push(cur_words.join(" "));
    return lines.join("\n")
}

function wordWrap2(str, length) {
    let regex = new RegExp(`(?=(.{1,${length}})((?: |$)))\\1\\2`, "g");
    return str.replace(regex, "$1\n");
}
/*
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
*/

let icon_map = {
    snow: ":cloud_snow:",
    rain: ":cloud_rain:",
    fog: ":fog:",
    wind: ":wind_blowing_face:",
    cloudy: ":cloud:",
    "partly-cloudy-day": ":partly_sunny:",
    "partly-cloudy-night":  ":cloud:",
    "clear-day": ":sunny:",
    "clear-night": ":crescent_moon:"
}


async function getWeather(location) {
    let timeline = await f.request(
        `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/next7days?unitGroup=us&key=${config.api.visualcrossing}&contentType=json&elements=datetime%2CdatetimeEpoch%2Cname%2Caddress%2CresolvedAddress%2Clatitude%2Clongitude%2Ctempmax%2Ctempmin%2Ctemp%2Cfeelslikemax%2Cfeelslikemin%2Cfeelslike%2Cconditions%2Cdescription%2Cicon`
    )
    let desc = timeline.description;
    if (timeline.alerts.length > 0) {
        let alertstring = data.alerts.map((alert) => {
            return `${alert.headline}`
        }).join("\n")
        desc += "\n\n" + alertstring;
    }
    let rich = new MessageEmbed();
    rich.setTitle(timeline.resolvedAddress);
    rich.setDescription(desc.slice(0, 2048));
    let now = timeline.currentConditions;
    let curTime = moment.tz(now.datetimeEpoch * 1000, timeline.timezone).format('h:mma');
    rich.addField(
        `${icon_map[now.icon] ?? ""}Now`, 
        `${curTime}\n**${now.temp}°F**
Feels like **${now.feelslike}°F**
${timeline.description}`, 
        true
    )
    rich.addFields(timeline.days.map(day=>{
        let dayName = moment.tz(day.datetimeEpoch * 1000, timeline.timezone).format('dddd');
        return {
            name: `${icon_map[day.icon]}${dayName}`,
            value: `**${day.tempmin}°F**/**${day.tempmax}°F**
Feels like **${day.feelslikemin}°F**/**${day.feelslikemax}°F**
${wordWrap(day.description, 33)}`,
            inline: true
        }
    }))

    return rich;
    /*
    let data = body;
    if (data.location.address.length < 1) return "`Location not found`";
    let locName = data.location.address[0];
    let lat = data.location.latitude[0];
    let lon = data.location.longitude[0];
    body = await fetch(`https://api.darksky.net/forecast/${config.api.weather.darksky}/${lat},${lon}?units=auto&exclude=minutely`).then(res => res.json());
    data = body;
    let tM;
    (data.flags.units == "us") ? tM = "°F" : tM = "°C";
    let iconNames = ["clear-day", "clear-night", "rain", "snow", "sleet", "wind", "fog", "cloudy", "partly-cloudy-day", "partly-cloudy-night"];
    let iconEmote = [":sunny:", ":crescent_moon:", ":cloud_rain:", ":cloud_snow:", ":cloud_snow:", ":wind_blowing_face:", ":fog:", ":cloud:", ":partly_sunny:", ":cloud:"];
    let rich = new MessageEmbed();
    rich.setTitle("Powered by Dark Sky");
    let summary = data.daily.summary
    if (data.alerts) {
        let alertstring = data.alerts.map((alert) => {
            return `[**ALERT**](${alert.uri}): ${alert.description}`
        }).join("\n")
        summary = summary + "\n\n" + alertstring;
    }
    rich.setDescription(summary.slice(0, 2048));
    rich.setURL("https://darksky.net/poweredby/");
    rich.setAuthor(locName, "", `https://darksky.net/forecast/${lat},${lon}`);
    let iconIndex;
    let curTime = moment.tz(data.currently.time * 1000, data.timezone).format('h:mma');
    rich.addField(`${(iconIndex = iconNames.indexOf(data.currently.icon)) > -1 ? iconEmote[iconIndex] : ""}Now`, `${curTime}\n**${data.currently.temperature}${tM}**\nFeels like **${data.currently.apparentTemperature}${tM}**\n${data.currently.summary}`, true)
    */
    for (let i = 0; i < data.daily.data.length; i++) {
        let dayIcon = (iconIndex = iconNames.indexOf(data.daily.data[i].icon)) > -1 ? iconEmote[iconIndex] : "";
        let dayName = moment.tz(data.daily.data[i].time * 1000, data.daily.data[i].timezone).format('dddd');

        let timeLow = moment.tz(data.daily.data[i].temperatureMinTime * 1000, data.timezone).format('h:mma');
        let timeHigh = moment.tz(data.daily.data[i].temperatureMaxTime * 1000, data.timezone).format('h:mma');

        let dayDesc = `\n**${data.daily.data[i].temperatureMin}${tM}**/**${data.daily.data[i].temperatureMax}${tM}**`;
        dayDesc += `\nFeels like **${data.daily.data[i].apparentTemperatureMin}${tM}**/**${data.daily.data[i].apparentTemperatureMax}${tM}**`;
        if (i < data.daily.data.length - 1) dayDesc += `\n${wordWrap(data.daily.data[i].summary, 33)}`;
        else dayDesc += `\n${data.daily.data[i].summary}`;
        rich.addField(`${dayIcon}${dayName}`, dayDesc, true)
    }

    let hourdata = data.hourly.data;

    let temp_datapoints = hourdata.map(hour => {
        return hour.temperature;
    })

    let apparent_temp_datapoints = hourdata.map(hour => {
        return hour.apparentTemperature;
    })

    let labels = hourdata.map(hour => {
        let thisMoment = moment.tz(hour.time * 1000, data.timezone);
        if (thisMoment.minute() === 0 && parseInt(thisMoment.hour()) % 6 == 0) {
            if (thisMoment.hour() != 0) {
                return thisMoment.format("ha");
            } else {
                return thisMoment.format("ddd");
            }
        }
        return "";
    })

    //https://www.chartjs.org/docs/latest/configuration/
    const configuration = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: "Temp",
                data: temp_datapoints,
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 2,
                pointRadius: 0
            }, {
                label: "Apparent Temp",
                data: apparent_temp_datapoints,
                borderColor: 'rgba(99, 132, 255, 1)',
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            legend: {
                display: true
            },
            scales: {
                yAxes: [{
                    ticks: {
                        callback: (value) => value + tM
                    }
                }]
            }
        }
    };

    return createChartStream(configuration);
}

export {getWeather}

export default new Command({
	name: 'weather',
    description: 'returns weather forecast of a location',
    type: "CHAT_INPUT",
    options: [{
        name: 'location',
        type: 'STRING',
        description: 'location. name of city or zip code',
        required: true,
    }],
	async execute(interaction) {
        let stream = await getWeather(interaction.options.data[0].value);
        let file = new MessageAttachment(stream, `chart.png`);
        rich.setImage(`attachment://chart.png`)
        return {embeds: [rich], files: [file]};
    }
})