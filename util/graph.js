import {ChartJSNodeCanvas } from 'chartjs-node-canvas';

//moment.tz.setDefault("America/New_York");

    /**
     * 
     * @param {*} data_obj {labels: [], lines: [{label, line}],[{x,y},...]]}
     * @returns 
     */
function createGraph(data_obj) {
	let chartconfig = getDefaultConfiguration();
	chartconfig.data.labels = data_obj.labels;
	chartconfig.data.datasets = data_obj.lines.map(line=> {
		return {
			label: line.label,
			data: line.cases,
			borderColor: 'rgba(255, 99, 132, 1)',
			borderWidth: 2,
			pointRadius: 0
		};
	});
	return createChartStream(chartconfig);
}

function createChartStream(configuration) {
    return canvasRenderService.renderToStream(configuration);
}
const canvasRenderService = new ChartJSNodeCanvas({width: 400, height: 225, chartCallback: (ChartJS) => {
    ChartJS.overrides.line.showLine = true;
    ChartJS.overrides.line.spanGaps = true;
    ChartJS.defaults.plugins.legend.display = true;
    ChartJS.defaults.animation = false;
    ChartJS.defaults.plugins.legend.labels.font = {
        weight: "bold",
        size: 10
    }
    ChartJS.defaults.showLine = true;
    ChartJS.defaults.spanGaps = true;
    ChartJS.defaults.elements.line.tension = 1;
    ChartJS.defaults.scales.linear.x = {
        ticks: {
            callback: (tick) => {
                if (tick == "") return undefined;
                return tick;
            },
            font: {
                weight: 700,
                size: 40
            }
        }
    }
    ChartJS.defaults.scales.scatterScale={
        y: {
            ticks: {
                font: ()=>{
                    return {
                        weight: 700,
                        size: 40
                    }
                }
            }
        }
    }

    class ScatterScale extends ChartJS.LinearScale {
        buildTicks() {
            return this.chart.config.data.labels;
        }       
        generateTickLabels() {
            return this.chart.config.data.labels;
        }
    }
    ScatterScale.id = "scatterScale";
    ScatterScale.defaults = ChartJS.defaults.scales.linear;
    ChartJS.register(ScatterScale)
}});

function getDefaultConfiguration(){
    return {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            scales:{
                x: {
                    type: "scatterScale",
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            },
            legend: {
                display: true
            }
        },
    };
}

export default createGraph;