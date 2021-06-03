// https://observablehq.com/@harrislapiroff/massachusetts-covid-cases-town-by-town@945
import define1 from "./79750b3b8e929d9d@217.js";
import define2 from "./a33468b95d0b15b0@703.js";
import define3 from "./3df1b33bb2cfcd3c@475.js";
import define4 from "./e93997d5089d7165@2303.js";
import define5 from "./450051d7f1174df8@252.js";

export default function define(runtime, observer) {
  const main = runtime.module();
  const fileAttachments = new Map([["ma-towns-state-plane-topo-1.json",new URL("./files/bbe7c93899b9c3ba14929fb55b89869e2f8c54972d2e6fbcd98d6998d06d4203c04f00406df9cfed73f93f4f2d04a5a9ef30b413d824a38aabad4fb9faa52dc4",import.meta.url)],["MA-Town-Population-Estimates-July-2019.csv",new URL("./files/d4b6e9af02f11adcc739ba7c3efd95fcdb2158738ace1a34e96c392a3ebd4162160f1b961ab7145a8b058727ebded1207e90b69f84f8bc523c628c695422f46d",import.meta.url)]]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], function(md){return(
md`# Massachusetts Coronavirus Cases by Town`
)});
  main.variable(observer()).define(["md","d3","townData","op"], function(md,d3,townData,op){return(
md`_Data is published [weekly on Thursdays](https://www.mass.gov/info-details/covid-19-response-reporting#covid-19-weekly-public-health-report-) and [manually aggregated by me](https://observablehq.com/@harrislapiroff/massachusetts-covid-data) (so there might be a delay). Most recent data is from the week ending on **${d3.utcFormat('%a %b %e, %Y')(townData.filter(d => op.equal(d.Date, op.max(d.Date))).objects()[0].Date)}**._`
)});
  main.variable(observer("viewof selectedDate")).define("viewof selectedDate", ["annotatedTownData","op","Scrubber","d3"], function(annotatedTownData,op,Scrubber,d3)
{
  const dates = annotatedTownData
    .groupby('Date')
    .rollup(d => op.unique('Date'))
    .objects()
    .map(d => d.Date)
    .slice(1)
  
  return Scrubber(
    dates,
    {
      autoplay: false,
      initial: dates.length - 1,
      format: d => d3.utcFormat('%a %b %e, %Y')(d),
      delay: 150,
      loopDelay: 2000,
    }
  )
}
);
  main.variable(observer("selectedDate")).define("selectedDate", ["Generators", "viewof selectedDate"], (G, _) => G.input(_));
  main.variable(observer("map")).define("map", ["d3","html","mapSize","annotatedTownData","op","topojson","massCities","noDataPattern","perCapitaColorScale","legend","viewof selectedTown"], function(d3,html,mapSize,annotatedTownData,op,topojson,massCities,noDataPattern,perCapitaColorScale,legend,$0)
{
  const map = d3.select(html`<svg viewbox="0 0 ${mapSize.width} ${mapSize.height}" />`)
  const path = d3.geoPath()
  
  map.append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', mapSize.width)
    .attr('height', mapSize.height)
    .attr('fill', '#FFF')
    
  const recentCasesPerCapita = annotatedTownData
    .filter((d, $) => op.equal(d.Date, op.max(d.Date)))
    .select('Town', 'New Cases Per Capita', 'Cases Hidden')
    .objects()
    
  const townShapes = map.append('g')
    .selectAll()
    .data(topojson.feature(massCities, massCities.objects.towns).features)
    .join('path')
      .attr('d', path)  
  
  // We define a function that colors the towns according to data objects passed in
  // We make this a reusable function so that we can call it later to dynamically update
  // the map
  const updateWithData = (data) => {
    townShapes.attr('fill', d => {
      const dataPoint = data.find(f => f.Town === d.properties.TOWN2)
      if (dataPoint === undefined) {
        console.warn(`Data point not found for town ${d.properties}`)
        return
      }
      if (dataPoint['Cases Hidden'] || isNaN(dataPoint['New Cases Per Capita'])) return noDataPattern.url()
      return perCapitaColorScale(dataPoint['New Cases Per Capita'])
    })
  }
  
  updateWithData(recentCasesPerCapita)
  
  const townOutlines = map.append('g')
    .selectAll()
    .data(topojson.feature(massCities, massCities.objects.towns).features)
    .join('path')
      .attr('d', path)
      .attr('stroke', '#FFF')
      .attr('fill', 'none')
  
  map.call(noDataPattern)
  
  map.call(
    d3.zoom()
      .translateExtent([[0, 0], [mapSize.width, mapSize.height]])
      .scaleExtent([1, 4])
      .on('zoom', ({ transform }) => {
        townShapes.attr('transform', transform)
        townOutlines.attr('transform', transform)
      })
  )
  
  // Legend
  map.append('g')
    .attr('transform', `translate(20, ${mapSize.height - 100})`)
    .append(() => legend({
      color: perCapitaColorScale,
      title: "Weekly new cases per 100k",
      tickFormat: d => d3.format('d')(d * 100000),
      width: 200,
    }))
  
  map.append('rect')
    .attr('x', 20)
    .attr('y', mapSize.height - 40)
    .attr('width', 15)
    .attr('height', 15)
    .attr('fill', noDataPattern.url())
  
  map.append('text')
    .attr('x', 40)
    .attr('y', mapSize.height - 40 + 12)
    .attr('font-size', 11)
    .attr('font-family', 'sans-serif')
    .text('MA provides inexact counts for small towns with <5 cases, for confidentiality')

  // Interactivity
  const inputEvent = new CustomEvent('input')
  
  townShapes.on('mouseover', function (e) {
    d3.select(this).attr('opacity', 0.6)
  })
  
  townShapes.on('mouseout', function (e) {
    d3.select(this).attr('opacity', 1)
  })
  
  townShapes.on('click', function (e) {
    output.value = d3.select(this).data()[0].properties.TOWN2
    output.dispatchEvent(inputEvent)
  })
  
  const output = $0.bind(
    Object.assign(map.node(), { value: null, update: updateWithData })
  )
  
  return output
}
);
  main.variable(observer()).define(["viewof selectedTown","autoSelect","massCities","selectedTown"], function($0,autoSelect,massCities,selectedTown){return(
$0.bind(autoSelect({
  title: "Town",
  options: massCities.objects.towns.geometries.map(d => d.properties.TOWN2),
  description: "Enter a town name to see details—or click on a town on the map",
  value: selectedTown,
}))
)});
  main.variable(observer("townOutput")).define("townOutput", ["selectedTown","html","annotatedTownData","noDataPattern","perCapitaColorScale","width","townDetails","barChart","casesTable"], function(selectedTown,html,annotatedTownData,noDataPattern,perCapitaColorScale,width,townDetails,barChart,casesTable)
{
  if (!selectedTown) return html``
  
  const townData = annotatedTownData
    .params({ selectedTown })
    .filter((d, $) => d.Town === $.selectedTown)
    .objects()
  
  const mostRecent = townData.slice(-1)[0]
  
  let increaseText
  if (mostRecent['Increased By'] > 0.05) {
    increaseText = "Increasing"
  } else if (mostRecent['Increased By'] < -0.05) {
    increaseText = "Decreasing"
  } else if (mostRecent['Increased By'] === null) {
    increaseText = null
  } else {
    increaseText = "Steady"
  }
  
  return html`
    <h2 style="margin-bottom: 0.5em;">
      <svg viewbox="0 0 20 20" style="height: 0.75em; margin-right: 0.15em">
        <circle cx="10" cy="10" r="10" fill=${
          mostRecent['Cases Hidden'] || isNaN(mostRecent['New Cases Per Capita']) ?
          noDataPattern.url() :
          perCapitaColorScale(mostRecent['New Cases Per Capita'])
        } />
      </svg>
      ${selectedTown}
      <span style="color: #999">
        ${increaseText ? '(' + increaseText + ')' : ''}
      </span>
    </h2>
    <div style="${width > 700 ? 'display: grid; grid-template-columns: 0.5fr 1fr 1fr; column-gap: 20px;' : ''}">
      <div>
        <h4 style="margin-bottom: 0.5em">Highlights</h4>
        ${townDetails(mostRecent)}
        <p style="font-size: 12px; font-family: var(--sans-serif), sans-serif;">
          <strong>Remember:</strong> Testing capacity changes over time and case counts from last week are not directly comparable to case counts months ago.
        </p>
      </div>
      <div>
        <h4 style="margin-bottom: 0.5em">Weekly New Cases Per 100k Population</h4>
        ${barChart(townData)}
      </div>
      <div>
        <h4 style="margin-bottom: 0.5em">Recent Weeks</h4>
        ${casesTable(townData)}     
      </div>
    </div>
  `
}
);
  main.variable(observer()).define(["md"], function(md){return(
md`<br />
***

# Implementation

## Data`
)});
  main.variable(observer()).define(["md"], function(md){return(
md`Load the data from my Google Sheet into an Arquero data table:`
)});
  main.variable(observer("townData")).define("townData", ["aq","CORSPROXY","TOWN_CASES_CSV"], async function(aq,CORSPROXY,TOWN_CASES_CSV){return(
aq.fromCSV(await (await fetch(CORSPROXY + TOWN_CASES_CSV)).text())
)});
  main.variable(observer()).define(["md"], function(md){return(
md`Annotate the data with the following columns:

* **Population:** population counts from the American Community Survey—joined from an uploaded CSV
* **New Cases:** the difference between cases this week and cases last week
* **New Tests:** the difference between tests this week and tests last week
* **Cases Suppressed:** \`true\` if the **Total Cases** column is \`"<5"\`, indicating that the DPH has suppressed an exact case count
* **Increased By:** percentage change in new cases this week versus last week
* **New Cases Per Capita:** new cases divided by population
* **Positivity:** new cases divided by new tests (note, this may be a mixed unit calculation)`
)});
  main.variable(observer("annotatedTownData")).define("annotatedTownData", ["townData","massPopulations","aq","op"], function(townData,massPopulations,aq,op){return(
townData
  // Add town pop data
  .join(massPopulations, ['Town', 'Town'], [aq.all(), ['Population']])
  // Annotate rows with case counts suppressed (MA does this for small towns for privacy reasons)
  .derive({ 'Cases Hidden': d => d['Total Cases'] === '<5' ? true : false })
  // Calculate change from previous week per town using a window function
  // If case counts are suppressed calculate new cases to be 0
  .groupby('Town')
  .derive({
    'New Cases': aq.rolling(
      d => d['Cases Hidden'] ? 0 : d['Total Cases'] - op.lag(d['Total Cases'], 1)
    ),
    'New Tests': aq.rolling(
      d => op.equal(op.lag(d['Total Tests'], 1, 0), null) ? null : d['Total Tests'] - op.lag(d['Total Tests'], 1, 0)
    ),
    'Cases Suppressed': d => op.equal(d['Total Cases'], '<5')
  })
  .derive({
    'Increased By': aq.rolling(
      d => d['New Cases'] && op.lag(d['New Cases'], 1) ?
        (d['New Cases'] - op.lag(d['New Cases'], 1, 0)) / op.lag(d['New Cases'], 1) :
        null
    ),
    'New Cases Per Capita': d => d['New Cases'] / d['Population'],
    'Positivity': d => d['New Cases'] && d['New Tests'] ? d['New Cases'] / d['New Tests'] : null
  })
  .ungroup()
)});
  main.variable(observer()).define(["md"], function(md){return(
md`## Chart

The bulk of the charting code is in the cells at the top of the notebook, but a few reusable utilities and constants are defined here:`
)});
  main.variable(observer("mapSize")).define("mapSize", function(){return(
{ width: 800, height: 500 }
)});
  main.variable(observer("perCapitaColorScale")).define("perCapitaColorScale", ["d3"], function(d3){return(
d3.scaleThreshold()
  .domain([
    0 + Number.EPSILON,
    0.0001 + Number.EPSILON,
    0.00025 + Number.EPSILON,
    0.0005 + Number.EPSILON,
    0.001 + Number.EPSILON,
    0.002 + Number.EPSILON,
  ])
  .range(['#CED', '#BDC', '#FD4', '#FA0', '#F44', '#900', '#400'])
)});
  main.variable(observer("noDataPattern")).define("noDataPattern", ["textures","perCapitaColorScale"], function(textures,perCapitaColorScale){return(
textures.circles()
  .thicker()
  .complement()
  .size(10)
  .background(perCapitaColorScale(0))
  .fill('#FFF')
)});
  main.variable(observer()).define(["md"], function(md){return(
md`## Bar Chart`
)});
  main.variable(observer("barChart")).define("barChart", ["d3","svg","perCapitaColorScale"], function(d3,svg,perCapitaColorScale){return(
data => {
  const dim = {
    width: 300,
    height: 150,
    top: 5,
    left: 40,
    bottom: 40,
    right: 20,
  }
  
  const casesFieldName = 'New Cases Per Capita' // 'New Cases'

  const timeScale = d3.scaleTime()
    .domain([
      d3.min(data, d => d.Date),
      d3.max(data, d => d.Date)
    ])
    .range([dim.left, dim.width - dim.right])
  
  const caseScale = d3.scaleLinear()
    .domain([
      0,
      Math.max(0.003, d3.max(data, d => d[casesFieldName]))
    ])
    .range([dim.height - dim.bottom, dim.top])
  
  const leftAxis = d3.axisLeft(caseScale)
    .ticks(5)
    .tickFormat(d => d3.format('d')(d * 100000))
  
  const bottomAxis = d3.axisBottom(timeScale)
    .tickFormat(d3.timeFormat('%b'))
  
  const chart = d3.select(svg`<svg viewbox="0 0 ${dim.width} ${dim.height}"/>`)
  
  chart.append('g')
    .attr('transform', `translate(${dim.left}, 0)`)
    .call(leftAxis)
  
  chart.append('g')
    .attr('transform', `translate(0, ${dim.height - dim.bottom})`)
    .call(bottomAxis)
  
  chart.append('g')
    .selectAll('rect')
    .data(data.filter(d => !isNaN(d[casesFieldName])))
    .join('rect')
      .attr('x', d => timeScale(d3.timeWeek.offset(d.Date, -1)) + 1)
      .attr('y', d => caseScale(d[casesFieldName]))
      .attr('width', d => timeScale(d.Date) - timeScale(d3.timeWeek.offset(d.Date, -1)) - 2)
      .attr('height', d => dim.height - dim.bottom - caseScale(d[casesFieldName]))
      .attr('fill', d => perCapitaColorScale(d[casesFieldName]))
  
  const latest2 = data.slice(-2)
  
  chart.append('line')
    .attr('x1', )
  
  return chart.node()
}
)});
  main.variable(observer("casesTable")).define("casesTable", ["html","d3"], function(html,d3){return(
data => html`
  <table style="margin-top: 0">
    <thead>
      <tr>
        <th>Week Ending On</th>
        <th>7-Day Cases</th>
        <th>New Cases per 100k</th>
      </tr>
    </thead>
    <tbody>
      ${data.slice(-5).reverse().map(d => html`
        <tr>
          <td>${d3.utcFormat('%x')(d.Date, -1)}</td>
          <td>${d['New Cases']}</td>
          <td>${d3.format('d')(d['New Cases Per Capita'] * 100000)}</td>
        </tr>
      `)}
    </tbody>
  </table>   
`
)});
  main.variable(observer("townDetails")).define("townDetails", ["html","d3"], function(html,d3){return(
recentDatum => html`
  <table>
    <tr>
      <th>Population</th>
      <td style="text-align: right; font-variant-numeric: tabular-nums;">
        ${d3.format(',d')(recentDatum.Population)}
      </td>
    </tr>
    <tr>
      <th>Total Cases</th>
      <td style="text-align: right; font-variant-numeric: tabular-nums;">
        ${d3.format(',d')(recentDatum['Total Cases'])}
      </td>
    </tr>
    <tr>
      <th>Total Tests</th>
      <td style="text-align: right; font-variant-numeric: tabular-nums;">
        ${d3.format(',d')(recentDatum['Total Tests'])}
      </td>
    </tr>
  </table>
`
)});
  main.variable(observer()).define(["md"], function(md){return(
md`## Interactivity`
)});
  main.variable(observer()).define(["md"], function(md){return(
md`This is a minimal view that we use to keep the map and town selector in sync. See [@mbostock/synchronized-views](https://observablehq.com/@mbostock/synchronized-views) for details.`
)});
  main.variable(observer("viewof selectedTown")).define("viewof selectedTown", ["View"], function(View){return(
new View(null)
)});
  main.variable(observer("selectedTown")).define("selectedTown", ["Generators", "viewof selectedTown"], (G, _) => G.input(_));
  main.variable(observer()).define(["md"], function(md){return(
md`This cell monitors the \`selectedDate\` view and updates the map when it changes. We use this instead of Observable's native reactivity for performance and animation reasons. (This way we avoid redrawing the entire map every time \`selectedDate\` changes.)`
)});
  main.variable(observer("mapUpdater")).define("mapUpdater", ["annotatedTownData","selectedDate","op","map"], function(annotatedTownData,selectedDate,op,map)
{
  const data = annotatedTownData
    .params({ selectedDate })
    .filter((d, $) => op.equal(d.Date, $.selectedDate))
    .select('Town', 'New Cases Per Capita', 'Cases Hidden')
    .objects()
  
  map.update(data)
}
);
  main.variable(observer()).define(["md"], function(md){return(
md`## Appendix`
)});
  main.variable(observer("CORSPROXY")).define("CORSPROXY", function(){return(
'https://corsproxy.harrislapiroff.com/'
)});
  main.variable(observer("TOWN_CASES_CSV")).define("TOWN_CASES_CSV", function(){return(
'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUkAX8YSW1_d0lJ0G6OCqobcXGuriZfiBGs5warTyZQRAhvcG2BHOyZwklWKTzL9jbtPOeBOzOMJqq/pub?gid=956094840&single=true&output=csv'
)});
  main.variable(observer("massPopulations")).define("massPopulations", ["aq","FileAttachment"], async function(aq,FileAttachment){return(
aq.fromCSV(await FileAttachment("MA-Town-Population-Estimates-July-2019.csv").text())
)});
  main.variable(observer("massCities")).define("massCities", ["FileAttachment"], function(FileAttachment){return(
FileAttachment("ma-towns-state-plane-topo-1.json").json()
)});
  const child1 = runtime.module(define1);
  main.import("aq", child1);
  main.import("op", child1);
  const child2 = runtime.module(define2);
  main.import("legend", child2);
  const child3 = runtime.module(define3);
  main.import("View", child3);
  const child4 = runtime.module(define4);
  main.import("autoSelect", child4);
  const child5 = runtime.module(define5);
  main.import("Scrubber", child5);
  main.variable(observer("topojson")).define("topojson", ["require"], function(require){return(
require("topojson-client@3")
)});
  main.variable(observer("textures")).define("textures", ["require"], function(require){return(
require('textures')
)});
  main.variable(observer("d3")).define("d3", ["require"], function(require){return(
require('d3@6')
)});
  return main;
}
