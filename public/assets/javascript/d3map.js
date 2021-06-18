var county_data = null 
var max_data = -Infinity
var min_data = Infinity
let state_codes = new Set(["09", "34", "36"])
var server_js = JSON.parse(sessionStorage.getItem('server_js'))
var selected_vals = JSON.parse(sessionStorage.getItem('selected_vals'))
var g = null
var path = null
var svg = null 

$('#layout').w2layout({
    name: 'layout',
    panels: [
        { type: 'top', size: 120, content: `<svg width="${document.documentElement.clientWidth*0.8}" height="80"></svg>`, hidden:false, 
        toolbar: {
          items: [ {
            type: "menu-radio",
            id: "values",
            text: function (item) {
              var text = item.selected;
              var el = this.get("values:" + item.selected);
              return el.text;
            },
            items: selected_vals.map(e => {return {'id':e, 'text':e}}),
            selected: selected_vals[0]
          },
          { type: "break" },
          {
            type: "menu-radio",
            id: "color-scheme",
            text: function (item) {
              var text = item.selected;
              var el = this.get("color-scheme:" + item.selected);
              return el.text;
            },
            selected: "yellow-orange-red",
            items: [
              { id: "yellow-orange-red", text: "Yellow-Orange-Red" },
              { id: "purple-blue-green", text: "Purple-Blue-Green" },
              { id: "blues", text: "Blues" },
              
            ],
          }
          ],
          onClick: function (event) {
            if (event.target.indexOf('color-scheme:') >= 0) 
            {
              console.log(event)
              event.onComplete=drawMap
            }
          }
        }
        },
        {type: "main", size: '100%', resizable: true, hidden: false,
        // style: pstyle,
        content: '<div id="d3map" style="width: 100%; height: 100%;background-color:#eee"></div>',}
    ]
});

let val_menu = w2ui.layout.get('top').toolbar.get("values")
val_menu.items = selected_vals.slice()
val_menu.selected = selected_vals[0]
w2ui.layout.get('top').toolbar.refresh()

function showLegend(color, min, max)
{
    d3.select('svg').html('');

    var svg = d3.select("svg");

    var path = d3.geoPath();

    var client_width = document.documentElement.clientWidth
    let legend_width = client_width/3
    let left_margin = legend_width

    var x = d3.scaleLog()
        .domain([min, max])
        .rangeRound([left_margin, left_margin + legend_width]);

    var g = svg.append("g")
        .attr("class", "key")
        .attr("transform", "translate(0,40)");

    g.selectAll("rect")
        .data(color.range().map(function (d)
        {
            d = color.invertExtent(d);
            if (d[0] == null) d[0] = x.domain()[0];
            if (d[1] == null) d[1] = x.domain()[1];
            return d;
        }))
        .enter().append("rect")
        .attr("height", 8)
        .attr("x", function (d) { return x(d[0]); })
        .attr("width", function (d) { return x(d[1]) - x(d[0]); })
        .attr("fill", function (d) { return color(d[0]); });

    g.append("text")
        .attr("class", "caption")
        .attr("x", x.range()[0])
        .attr("y", -6)
        .attr("fill", "#000")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text("Legend");

    g.call(d3.axisBottom(x)
        .tickSize(13)
        .tickValues(color.domain()))
        .select(".domain")
        .remove();

}

function getColorScheme()
{
  let scheme=w2ui.layout.get('top').toolbar.get("color-scheme")
  console.log(scheme)
  switch(scheme.selected) 
  {
    case 'yellow-orange-red':
      return d3.interpolateYlOrRd
      break;
    case 'purple-blue-green':
      return d3.interpolatePuBuGn
      break;
    case 'blues':
      return d3.interpolateBlues
      break;
  } 
}

function buildCountyDataLookup()
{
  let min = Infinity, max = -Infinity
  let lut = {}
  for (let row of server_js)
  {
    let c = row[0][0]
    let state = c.substring(c.length - 2)
    let county = c.substring(0, c.length-3)
    let code = state_code_from_name[state]
    if (lut[code] == null)
    {
      lut[code] = {}
    }
    let value = row[1][0]
    max = Math.max(value, max) 
    min = Math.min(value, min)
    lut[code][county] = row[1][0]
  }
  return {lut:lut, max:max, min:min}
}

var tooltipDiv = d3.select("#d3map").append("div")    
    .attr("class", "tooltip")               
    .style("opacity", 0);
    


let state_code_from_name = 
{CT:"09", NY:"36", NJ: "34", MA: "25" }

let name_from_state_code= 
{"09":"CT", "36":"NY", "34":"NJ", "25":"MA" }

var width = $('svg').parent().width(),
    height = 800,
    active = d3.select(null);

function drawMap() {
  
  let result = buildCountyDataLookup();

  county_data = result.lut;
  max_data = result.max;
  min_data = result.min;

  let colors = [];
  let num_colors = 12;
  let scheme = getColorScheme();

  for (let i = 0; i <= num_colors; ++i) colors.push(scheme(i / num_colors));

  let domain = [],
    m1,
    m2;
  if (min_data <= 0 && max_data <= 0)
  {
    m1 = min_data == 0 ? -1 : min_data;
    m2 = max_data == 0 ? -1 : max_data;
    let r = (m2 / m1) ** (1 / num_colors);

    for (let x = m1; x <= m2; x *= r) 
      domain.push(x);
  } 
  else if (min_data >= 0 && max_data >= 0) 
  {
    m1 = min_data == 0 ? 1 : min_data;
    m2 = max_data == 0 ? 1 : max_data;
    let r = (m2 / m1) ** (1 / num_colors);

    for (let x = m1; x <= m2; x *= r)
     domain.push(x);
  } 
  else 
  {
    m1 = min_data;
    m2 = max_data;

    domain.push(min_data);
    let r = max_data ** (1 / (num_colors - 1));

    for (let x = 1; x <= max_data; x *= r) domain.push(x);
  }

  var color = d3
    .scaleThreshold()
    .domain(domain)
    //.range(d3.schemePuBu[9]);
    //.range(d3.schemeOrRd[9]);
    //.range(d3.schemeYlOrRd[9])
    .range(colors);

  var zoom = d3
    .zoom()
    // no longer in d3 v4 - zoom initialises with zoomIdentity, so it's already at origin
    // .translate([0, 0])
    // .scale(1)
    .scaleExtent([1, 32])
    .on("zoom", zoomed);

  path = d3
    .geoPath() // updated for d3 v4
    .projection(null);
  
  d3.select('#d3map').html('')

  svg = d3
    .select("#d3map")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .on("click", stopped, true);

  svg
    .append("rect")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height)
    .on("click", reset);

  g = svg.append("g");

  svg.call(zoom); // delete this line to disable free zooming
  // .call(zoom.event); // not in d3 v4

  showLegend(color, m1, m2);

  d3.json("us.json", function (error, us) {
    if (error) throw error;

    us.transform.scale[0] *= 4.0;
    us.transform.scale[1] *= 4.0;

    us.transform.translate[0] -= 2800;
    us.transform.translate[1] -= 400;

    let states = topojson.feature(us, us.objects.states).features;
    let states_filtered = states.filter((d) => state_codes.has(d.id));

    g.selectAll("path")
      .data(states_filtered)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "feature");

    let county_features = topojson.feature(us, us.objects.counties).features;
    let county_filtered = county_features.filter((d) =>
      state_codes.has(d.id.substring(0, 2))
    );
    g.append("g")
      .attr("class", "counties")
      .selectAll("path")
      .data(county_filtered)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("style", function (d) {
        let code = d.id.substring(0, 2);
        if (!state_codes.has(code)) {
          return "fill: #000";
        }
        let s = parseInt(code);
        let county = d.properties.name;
        let value = county_data[code][county];

        return `fill:${color(value)}`;
      })
      .on("click", clicked)
      .on("mouseover", hovered)
      .on("mousemove", moved)
      .on("mouseout", function (d) {
        tooltipDiv.style("opacity", 0);
      });

    g.append("path")
      .attr("class", "county-borders")
      .attr(
        "d",
        path(
          topojson.mesh(us, us.objects.counties, function (a, b) {
            let aCode = a.id.substring(0, 2);
            let bCode = b.id.substring(0, 2);

            if (!state_codes.has(aCode) || !state_codes.has(bCode))
              return false;
            else return a !== b;
          })
        )
      );

    g.append("path")
      .datum(
        topojson.mesh(us, us.objects.states, function (a, b) {
          if (!state_codes.has(a.id) && !state_codes.has(b.id)) return false;
          else return true;
        })
      )
      .attr("class", "mesh")
      .attr("d", path);
  });
}

function clicked(d) {
  if (active.node() === this) return reset();
  active.classed("active", false);
  active = d3.select(this).classed("active", true);

  var bounds = path.bounds(d),
      dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      x = (bounds[0][0] + bounds[1][0]) / 2,
      y = (bounds[0][1] + bounds[1][1]) / 2,
      scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height))),
      translate = [width / 2 - scale * x, height / 2 - scale * y];

  svg.transition()
      .duration(750)
      // .call(zoom.translate(translate).scale(scale).event); // not in d3 v4
      .call( zoom.transform, d3.zoomIdentity.translate(translate[0],translate[1]).scale(scale) ); // updated for d3 v4
}

  function hovered(d) {
    let code = d.id.substring(0, 2)
    let state = name_from_state_code[code]
    if (!state_codes.has(code))
      return
    
    let county = d.properties.name
    let value = county_data[code][county]
    tooltipDiv
      .style("opacity", 0.9);
    tooltipDiv.html(`${county} ${state} <br> ${value}`)
      .style("left", (d3.event.pageX + 20) + "px")
      .style("top", (d3.event.pageY + 20) + "px");
  }
  function moved(d)
  {
     tooltipDiv
      .style("left", (d3.event.pageX + 20) + "px")
      .style("top", (d3.event.pageY + 20) + "px");
  }

function reset() {
  active.classed("active", false);
  active = d3.select(null);

  svg.transition()
      .duration(750)
      // .call( zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1) ); // not in d3 v4
      .call( zoom.transform, d3.zoomIdentity ); // updated for d3 v4
}

function zoomed() {
  g.style("stroke-width", 1.5 / d3.event.transform.k + "px");
  // g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")"); // not in d3 v4
  g.attr("transform", d3.event.transform); // updated for d3 v4
}

// If the drag behavior prevents the default click,
// also stop propagation so we don’t click-to-zoom.
function stopped() {
  if (d3.event.defaultPrevented) d3.event.stopPropagation();
}

drawMap()