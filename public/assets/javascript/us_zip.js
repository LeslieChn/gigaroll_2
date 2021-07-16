var zip_data = null
var max_data = -Infinity
var min_data = Infinity
var server_js = JSON.parse(sessionStorage.getItem('server_js'))
var selected_vals = JSON.parse(sessionStorage.getItem('selected_vals'))
var dd_vals = [];
var colorschemes = [{id: 0, text: 'Yellow-Orange-Red', d3: d3.interpolateYlOrRd},
                    {id: 1, text: 'Blues', d3: d3.interpolateBlues},
                    {id: 2, text: 'Yellow-Green', d3: d3.interpolateYlGn},
                    {id: 3, text: 'Greys', d3: d3.interpolateGreys}]

for (let i = 0; i < selected_vals.length; ++i)
{
    dd_vals.push({ 'id': i, 'text': selected_vals[i] });
}

var g = null;
var path = null;
var svg = null;
var zoom = null;
var tooltipDiv = null;
var first_map_draw = true;
var color;

$('#layout').w2layout({
    name: 'layout',
    panels: [
        {
            style: "border-bottom: 3px solid #9f9faf",
            type: 'top', size: 120, content: `<svg width="${document.documentElement.clientWidth * 0.8}" height="80"></svg>`, hidden: false,
            toolbar: {
                style:
                "padding: 2px; border-bottom: 3px solid #9f9faf;" +
                "background: linear-gradient(to bottom, #f0f2f4 0%,#e5e7e9 36%,#ccd6dc 100%);" +
                "font-weight:bold; font-size: 1.875em;",
                items: [
                    {
                        type: "menu-radio",
                        id: "values",
                        text: function (item)
                        {
                            var el = this.get("values:" + item.selected);
                            return el.text;
                        },
                        items: dd_vals,
                        selected: dd_vals[0].id
                    },
                    { type: "break" },
                    {
                        type: "menu-radio",
                        id: "color-scheme",
                        text: function (item)
                        {
                            var el = this.get("color-scheme:" + item.selected);
                            return el.text;
                        },
                        selected: 0,
                        items: colorschemes,
                    }
                ],
                onClick: function (event)
                {
                    if (event.target.indexOf('color-scheme:') >= 0) 
                    {
                        event.onComplete = drawMap
                    }
                    if (event.target.indexOf('values:') >= 0) 
                    {
                        event.onComplete = drawMap
                    }
                }
            }
        },
        {
            type: "main", size: '100%', resizable: true, hidden: false,
            // style: pstyle,
            content: '<div id="d3map" style="width: 100%; height: 100%;background-color:#eee"></div>',
        }
    ]
});

function showLegend(color, min, max)
{
    d3.select('svg').html('');

    var svg = d3.select("svg");

    let n_divs = color.range().length;

    var client_width = document.documentElement.clientWidth
    let legend_width = client_width / 3
    let left_margin = legend_width
    let rect_width = legend_width / n_divs
    let rect_idx = 0;
    let rect_id = 0;

    let rectPos = (i) => left_margin + i * rect_width;

    var g = svg.append("g")
        .attr("class", "key")
        .attr("transform", "translate(0,40)");

    g.selectAll("rect")
        .data(color.range().map((d) => rect_idx++ ) )
        .enter().append("rect")
        .attr("height", 12)
        .attr("x", d => rectPos(d))
        .attr("y", d => 0)
        .attr("width", rect_width)
        .attr("fill", function (d) { return color.range()[d] })
        .attr("id", d => `rect_${rect_id++}`)

    let toolbar = w2ui.layout.get('top').toolbar
    let id = toolbar.get("values").selected
    let text = toolbar.get(`values:${id}`).text

    g.append("text")
        .attr("id", "caption")
        .attr("x", -200) 
        .attr("y", 12)
        .attr("fill", "#000")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text(text);

    let text_pixels = document.getElementById("caption").getComputedTextLength()
    g.select("#caption")
        .attr("x", left_margin - text_pixels - 20);

    // Create the tickmarks
    let vals = [[min,0]]
    for (let j = 1; j < 4; ++j)
    {
        //let idx = Math.floor(j * n_divs / 4)
        let val_idx = Math.floor(j * (color.domain().length) / 4);
        let val = color.domain()[val_idx]
        let idx = color.range().indexOf(color(val))
        vals.push([val, idx]);
    }
    vals.push([max, n_divs])

    for (let val of vals)
    {
        g.append("text")
            .attr("y", 30)
            .attr("x", rectPos(val[1]))
            .attr("fill", "#000")
            .attr("style", "font-size: smaller")
            .text(Math.round(10*val[0])/10);
    }

    for (let i = 0; i <= n_divs; ++i)
    {
        let width = 1, height = 15;
        if (i % 4 == 0)
        {
            width = 2;
            height = 18;
        }
        g.append('line')
            .style("stroke", "black")
            .style("stroke-width", width)
            .attr("x1", rectPos(i))
            .attr("y1", 0)
            .attr("x2", rectPos(i) )
            .attr("y2", height); 
    }
      
}

function getColorScheme()
{
    let scheme = w2ui.layout.get('top').toolbar.get("color-scheme").selected
    return w2ui.layout.get('top').toolbar.get("color-scheme").items[scheme].d3
}

function buildZipDataLookup()
{
    let value_idx = w2ui.layout.get('top').toolbar.get("values").selected
    let min = Infinity, max = -Infinity
    let lut = {}
    for (let row of server_js)
    {
        let zip = row[0][0]
        let value = row[1][value_idx]
        max = Math.max(value, max)
        min = Math.min(value, min)
        lut[zip] = value
    }
    return { lut: lut, max: max, min: min }
}

tooltipDiv = d3.select("#d3map").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

var width = $('svg').parent().width(),
    height = 800,
    active = d3.select(null);

function drawMap()
{

    let result = buildZipDataLookup();

    zip_data = result.lut;
    max_data = result.max;
    min_data = result.min;

    let colors = [];
    let num_colors = 12;
    let scheme = getColorScheme();

    for (let i = 0; i <= num_colors; ++i)
        colors.push(scheme(i / num_colors));

    let domain = [],
        m1,
        m2;
    if (min_data <= 0 && max_data <= 0)
    {
        m1 = min_data == 0 ? -1 : min_data + 0.5;
        m2 = max_data == 0 ? -1 : max_data;
        let r = (m2 / m1) ** (1 / (num_colors));

        for (let x = m1; x <= m2; x *= r)
            domain.push(x);
    }
    else if (min_data >= 0 && max_data >= 0) 
    {
        m1 = min_data == 0 ? 1 : min_data + 0.5;
        m2 = max_data == 0 ? 1 : max_data;
        let r = (m2 / m1) ** (1 / (num_colors));

        for (let x = m1; x <= m2; x *= r)
            domain.push(x);
    }
    else 
    {
        m1 = min_data;
        m2 = max_data;

        domain.push(min_data + 0.5);
        let r = max_data ** (1 / (num_colors - 1));

        for (let x = 1; x <= max_data; x *= r)
            domain.push(x);
    }


        color = d3
        .scaleThreshold()
        .domain(domain)
        //.range(d3.schemePuBu[9]);
        //.range(d3.schemeOrRd[9]);
        //.range(d3.schemeYlOrRd[9])
        .range(colors);

    if (first_map_draw)
    {
        first_map_draw = false;
        zoom = d3
            .zoom()
            // no longer in d3 v4 - zoom initialises with zoomIdentity, so it's already at origin
            // .translate([0, 0])
            // .scale(1)
            .scaleExtent([1, 32])
            .on("zoom", zoomed);

        path = d3
            .geoPath() // updated for d3 v4
            .projection(null);

        //d3.select('#d3map').html('')

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
    }
    showLegend(color, m1, m2);

    d3.json("map_zip_state.json", function (error, us)
    {
        if (error) throw error;

        us.transform.scale[0] *= 0.001;
        us.transform.scale[1] *= -0.001;

        us.transform.translate[0] = 500;
        us.transform.translate[1] = 700;

        let zip_features = topojson.feature(us, us.objects.zip).features;
        let zip_filtered = zip_features.filter((zip) => zip_data[zip.id]);
        let state_features = topojson.feature(us, us.objects.states).features;
        
        g.selectAll("path")
            .data(state_features)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("class", "feature");

        g.append("path")
            .datum(
                topojson.mesh(us, us.objects.states, function (a, b)
                {
                    return true;
                })
            )
            .attr("class", "mesh")
            .attr("d", path);

        g.append("g")
            .attr("class", "zipcodes")
            .selectAll("path")
            .data(zip_filtered)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("style", function (d)
            {
                let zip = d.id;
                let value = zip_data[zip];
                return `fill:${color(value)}; `;

            })
            .on("click", clicked)
            .on("mouseover", hovered)
            .on("mousemove", moved)
            .on("mouseout", mouseOuted);
    

    g.append("path")
        .attr("class", "zip-borders")
        .attr(
            "d",
            path(
                topojson.mesh(us, us.objects.zip, function (a, b)
                {
                    return a !== b;
                })
            )
        );
    });
}

function clicked(d)
{
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
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)); // updated for d3 v4
}

function hovered(d)
{ 
    let zip = d.id
    let state = d.properties.state
    let value = zip_data[zip]
    let idx = color.range().indexOf(color(value))
    let rect_id = `#rect_${idx}`

    let x = parseInt(d3.select(rect_id).attr("x"))
    let width = parseInt(d3.select(rect_id).attr("width"))
    
    var g = svg.append("g")
    .attr("transform", "translate(0,40)");
    
    d3.select(".key")
        .append("line")   
        .attr("id", "overline")
         .attr("x1", x)
         .attr("y1", -5)
         .attr("x2", x + width)
         .attr("y2", -5)
         .attr("style", `stroke:black;stroke-width:4`)  

    tooltipDiv
        .style("opacity", 0.9);
    tooltipDiv.html(`${zip} ${state} <br> ${value}`)
        .style("left", (d3.event.layerX + 20) + "px")
        .style("top", (d3.event.layerY + 20) + "px");
}

function moved(d)
{
  tooltipDiv
      .style("left", (d3.event.layerX + 20) + "px")
      .style("top", (d3.event.layerY + 20) + "px");
}

function mouseOuted(d)
{
  tooltipDiv.style("opacity", 0);
    d3.select("#overline")
        .remove();
}

function reset()
{
    active.classed("active", false);
    active = d3.select(null);

    svg.transition()
        .duration(750)
        // .call( zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1) ); // not in d3 v4
        .call(zoom.transform, d3.zoomIdentity); // updated for d3 v4
}

function zoomed()
{
    g.style("stroke-width", 1.5 / d3.event.transform.k + "px");
    // g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")"); // not in d3 v4
    g.attr("transform", d3.event.transform); // updated for d3 v4
}

// If the drag behavior prevents the default click,
// also stop propagation so we don’t click-to-zoom.
function stopped()
{
    if (d3.event.defaultPrevented) d3.event.stopPropagation();
}

drawMap()