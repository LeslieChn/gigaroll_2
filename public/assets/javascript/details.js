var coords
var bounds
var map_center = {}
var rec_ids = []
var map = null
var cluMarkers
var markers
var heatmap = L.heatLayer([],{radius: 30},{blur: 0},{0.4: 'blue', 0.65: 'lime', 1: 'red'});
var radiusVal = 10
var opacity = 1
var gardCase = 0
var osMap = null
var tileLayer
var layerGroup = null
var mapZoom
var markerColor = "#9b001f"
var countiesOverlay = null
var lcontrol = null
var color = null
var iLat = null, iLng = null

let aliases = {
  'beds:count'     : 'Number of Properties',
  'price:avg'      : 'Price, Average',
  'size:avg'       : 'Size, Average',
  'prop_type'      : 'Property Type',
  'county'         : 'County',
  'state_code'     : 'State',
  'city'           : 'City',
  'postal_code'    : 'Zip Code',
  'elevation:avg'  : 'Elevation, Average', 
  'year_built:min' : 'Earliest Construction (Year)',
  'pop_2019'       : 'Population 2019',
  'prop_status'    : 'Status',
  'elevation'      : 'Elevation',
  'flood_zone'     : 'Flood Zone',
  'beds'           : 'Beds',
  'baths'          : 'Baths',
  'size'           : 'Size',
  'price'          : 'Price',
  'year_built'     : 'Year Built',
  'latitude'       : 'Latitude',
  'longitude'      : 'Longitude',
  'address'        : 'Address',
  'assessment_building:avg' : 'Assessed Building Value, Average',
  'assessment_land:avg' : 'Assessed Land Value, Average',
  'assessment_total:avg' : 'Assessed Total Value, Average',
  'building_size:avg'  : 'Building Size, Average',
  'price_per_sqft:avg' : 'Price Per Square Feet, Average',
}

var overlay_colors = [
  {id: 0, text: 'Greys', d3: d3.interpolateGreys, null_color: "wheat"},
  {id: 1, text: 'Blues', d3: d3.interpolateBlues, null_color: "black"},
  {id: 2, text: 'Greens', d3: d3.interpolateGreens, null_color: "black"},
  {id: 3, text: 'Orange', d3: d3.interpolateOranges, null_color: "black"},
  {id: 4, text: 'Yellow-Brown', d3: d3.interpolateYlOrBr, null_color: "black"},
        ]

let county_measures =  [
  "Housing_Units_2019",
  "Median_Income_2019",
  "Occupied_2019",
  "pop_2019",
  "Vacant_2019"
];
let agg_measures = ['beds:count', 'price:avg', 'price_per_sqft:avg', 'building_size:avg', 'assessment_building:avg', 'assessment_land:avg', 'assessment_total:avg', 'elevation:avg']
let overlay_measures = agg_measures.concat(county_measures)
let overlays = overlay_measures.map(function(measure, i){return{id:i, text:alias(measure), measure:measure}})

var baseMaps

let state_code_from_name =
{ CT: "09", NY: "36", NJ: "34", MA: "25" }                  

var propDiv = null;

function alias(name)
{
  let aliased_name = name
  if ( name in aliases)
  {
    aliased_name = aliases[name]
  }
  aliased_name = aliased_name.replaceAll('_', ' ')
  return aliased_name.replace(/(<|>)/g, matched => html_sub[matched]);
}

function reqParamsToString(params)
{
    let s = ''
    for (let [key,val] of Object.entries(params))
    {
      s += `${key}=${encodeURIComponent(val)}&`
    }
    return s
}

async function serverRequest(params) 
{
  p = reqParamsToString(params)

  const api_url = `gserver/${p}`;

  var request = new Request(api_url, { method: "POST" });

  const response = await fetch(request);
  const json = await response.json();

  return json;
}

var county_data = null;


async function getCountyData()
{
  let params = 
  {
    qid: 'MD_AGG',
    dim: 'property',
    gby : 'county',
    val: agg_measures.join(',')
  }
  let county_measure_indices = null;
  if (county_data == null)
  {
    county_data = await serverRequest(params)
    let js = await serverRequest( {qid: "MD_RETR", dim: "county", include_member_name: 'true'})
    let county_headers = js.headers;
    if (!county_measure_indices)
    {
      county_measure_indices = county_measures.map(e => county_headers.indexOf(e))
    }
    let mem_name_idx = county_headers.indexOf("Member_Name")
    let county_dict = {}, row_num = 0;
    for (let row of js.data)
    {
      county_dict[row[mem_name_idx]] = row_num++
    }

    for (let row of county_data.data)
    {
      let county = row[0][0]
      let measures = js.data[county_dict[county]]

      for (let i of county_measure_indices)
      {
        row[1].push(measures[i])
      }
     
    }

  }
}

function getOverlayColor()
{
    let id = w2ui.layout.get('bottom').toolbar.get("overlay-color").selected
    return overlay_colors[id].d3 
}

async function buildCountyDataLookup(value_idx)
{
    await getCountyData();
    let min = Infinity, max = -Infinity
    let lut = {}

    for (let row of county_data.data)
    {
        let c = row[0][0]
        if (c == "Westchester-CT")
          continue
        let state = c.substring(c.length - 2)
        let county = c.substring(0, c.length - 3)
        let code = state_code_from_name[state]
        if (lut[code] == null)
        {
            lut[code] = {}
        }
        let value = row[1][value_idx]
        max = Math.max(value, max)
        min = Math.min(value, min)
        lut[code][county] = value
    }
    return { lut: lut, max: max, min: min }
}

var county_lookup = null,
max_data = null,
min_data = null;

async function buildCountyColorLookup(view_idx)
{
  let result = await buildCountyDataLookup(view_idx);

  county_lookup = result.lut;
  max_data = result.max;
  min_data = result.min;

  let colors = [];
  let num_colors = 12;
  let scheme = getOverlayColor();

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
}
/******************************************************************/
$(function () {
  var pstyle = "border: 1px solid #dfdfdf";
  $("#layout").w2layout({
    name: "layout",
    panels: [
      {
        type: "main",
        content: '<div id="grid" style="width: 100%; height: 100%;"></div>',
      },
      {
        type: "bottom",
        size: '50%',
        resizable: true,
        hidden: true,
        style: pstyle,
        content: '<div id="map"></div>',
        toolbar: {
          name: "toolbar",
          style:
            "padding: 2px; border-bottom: 3px solid #9f9faf;" +
            "background: linear-gradient(to bottom, #f0f2f4 0%,#e5e7e9 36%,#ccd6dc 100%);" +
            "font-weight:bold; font-size: 1.875em;",
          items: [
            {
              type: "menu-radio",
              id: "map-type",
              text: 
              function (item) {
                var el = this.get("map-type:" + item.selected);
                return el.text;
              },
              selected: "regular-map",
              items: [
                { id: "regular-map", text: "Regular Map" },
                { id: "heat-map", text: "Heat Map"},
                { id: "clustering-map", text: "Clustering Map"},
              ],
              onRefresh: function(event){
                switchMapType(event.item.selected)
              }
            },
            { type: "break" },
            {
              type: "menu-radio",
              id: "marker_color",
              text: 
              function (item) {
                var bb = this.get("marker_color:" + item.selected);
                return bb.text;
              },
              selected: "#9b001f",
              items: [
                { id: "black", text: "Black"},
                { id: "green", text: "Green"},
                { id: "blue", text: "Blue"},
                { id: "#9b001f", text: "Red"},
                { id: "orange", text: "Orange"},
              ],
              onRefresh: function(event){
                if (markerColor != event.item.selected)
                {
                  markerColor = event.item.selected
                  setMarkers()
                }
              }
            },
            {
              type: "button",
              id: "heat_gradient",
              class: "heat",
              text: "Change Gradient",
              onClick: changeGradient,
            },
            {
              type: "button",
              id: "heat_radius",
              class: "heat",
              text: "Change Radius",
              onClick: changeRadius,
            },
            {
              type: "button",
              id: "heat_opacity",
              class: "heat",
              text: "Change Opacity",
              onClick: changeOpacity,
            },
            { type: "break" },
            {
              type: "button",
              id: "bn_draw",
              text: "Draw on Map",
                 onClick: drawOnMap,
            },
            {
              type: "button",
              id: "bn_fdPt",
              disabled: true,
              text: "Find Points",
                  onClick: findPoints,
            },
            { type: "break" },
            {
              type: "menu-radio",
              id: "overlay-type",
              text: 
              function (item) {
                var el = this.get("overlay-type:" + item.selected);
                return el.text;
              },
              selected: overlays[0].id,
              items: overlays,
              onRefresh: function(event){
                switchOverlayType(event.item.selected)
              }
            },
            { type: "break" },
            {
              type: "menu-radio",
              id: "overlay-color",
              text: 
              function (item) {
                var el = this.get("overlay-color:" + item.selected);
                return el.text;
              },
              selected: overlay_colors[0].id,
              items: overlay_colors,
              onRefresh: function(event){
                switchOverlayType()
              }
            },
            { type: "spacer"},
            {
              type: 'html', id: 'hide-map', 
              html: 
              '<button style="border:0px;padding:0px 2px 0px;" onclick="hideMap()"> <img src="./assets/images/minimize.svg" style="height:16px;width:16px" /> </button>',
            },      
            {
              type: 'html', id: 'restore-map', 
              html: 
              '<button style="border:0px;padding:0px 2px 0px;" onclick="restoreMap()"> <img src="./assets/images/window-split.svg" style="height:16px;width:16px" /> </button>',
            },
            {
              type: 'html', id: 'max-map', 
              html: 
              '<button style="border:0px;padding:0px 2px 0px;" onclick="maximizeMap()"> <img src="./assets/images/maximize2.svg" style="height:16px;width:16px" /> </button>',
            },
          ],
        },
      },
    ],
  });
});

function hideMap()
{
  w2ui.layout.get("main").size = '100%'
  w2ui.layout.show("main", true)
  w2ui.layout.hide("bottom", true)
}
function maximizeMap()
{
  w2ui.layout.hide("main", true)
  w2ui.layout.get("bottom").size = '100%'
  w2ui.layout.show("bottom", true)
  autoZoom()
}

function restoreMap()
{
  w2ui.layout.show("main", true)
  w2ui.layout.get("bottom").size = '50%'
  w2ui.layout.show("bottom", true)
  autoZoom()
}

var rectangle = null
var circle = null
var drawControl =null
var editableLayers = new L.featureGroup();
L.Control.RemoveAll = L.Control.extend({
  options: {
      position: 'topright',
  },

  onAdd: function () {
      var controlDiv = L.DomUtil.create('div', 'leaflet-draw-toolbar leaflet-bar');
      var controlUI = L.DomUtil.create('a', 'leaflet-draw-edit-remove', controlDiv);
      controlUI.setAttribute('href', '#');
      controlUI.title = 'Delete layers.';


      L.DomEvent
          .addListener(controlUI, 'click', L.DomEvent.stopPropagation)
          .addListener(controlUI, 'click', L.DomEvent.preventDefault)
          .addListener(controlUI, 'click', function () {
            editableLayers.clearLayers();
              if(window.console) window.console.log('Drawings deleted...');
          });
      return controlDiv;
  }
});

removeAllControl = new L.Control.RemoveAll();

function drawOnMap()
{
  // let buText = w2ui.layout.get('bottom').toolbar.get('bn_draw').text
  if (drawControl){
    editableLayers.clearLayers();
    drawControl.remove();
    removeAllControl.remove();
    drawControl = null;
    w2ui.layout.get('bottom').toolbar.disable('bn_fdPt')

  }
  else{
    var drawPluginOptions = {
      position: 'topright',
      draw: {
        polyline: false,
        polygon: false,
        circle: {
          shapeOptions: {
          color: 'blue',
          clickable: false,
          draggable: false
          }
        }, 
        rectangle: {
          shapeOptions: {
            draggable: false,
            color: 'red',
            clickable: false
          }
        },
        marker: false,
      },
      edit: {
        featureGroup: editableLayers, //REQUIRED!!
        remove: false,
        moveMarkers: false
      }
    };
    drawControl = new L.Control.Draw(drawPluginOptions);
    
    osMap.addControl(drawControl)
    osMap.addLayer(editableLayers)
    osMap.addControl(removeAllControl)

    osMap.on('draw:created', function(e) {
      var type = e.layerType
      editableLayers.clearLayers();
      if(circle)
        circle = null;
      if (rectangle)
        rectangle = null;

      if (type === 'rectangle') {
        rectangle = e.layer
        editableLayers.addLayer(rectangle)
      }
      if (type === 'circle') {
        circle = e.layer
        editableLayers.addLayer(circle)
      }
    });
    w2ui.layout.get('bottom').toolbar.enable('bn_fdPt')
  }
  // buText = "Remove Drawing"
  // w2ui.layout.get('bottom').toolbar.refresh()
}

function findPoints()
{
  let filter_table = false

  if (rectangle != null)
  {
    w2ui.grid.selectNone()

    let bounds = rectangle.getBounds();
    w2ui.grid.last.searchIds = []
    
    for (let i=0; i<coords.length; ++i)
    {
      
      let contains = rectangle.getBounds().contains(coords[i][0]);

      if (contains)
        w2ui.grid.last.searchIds.push(rec_ids[i]-1);
    }    
    filter_table = true
  }

  else if (circle != null)
  {
    w2ui.grid.last.searchIds = []

/*     let center = circle.getCenter()
    let radius = circle.getRadius() */
/*     let dist = google.maps.geometry.spherical.computeDistanceBetween
 */    
    for (let i=0; i<coords.length; ++i)
    {
      let contains = circle.getLatLng().distanceTo(coords[i][0]) < circle.getRadius();

      if (contains)
        w2ui.grid.last.searchIds.push(rec_ids[i]-1);
    }
    filter_table = true
  }

  if (filter_table)
  {
    w2ui.grid.last.multi = true
    w2ui.grid.last.logic = 'OR'
    w2ui.grid.total = w2ui.grid.last.searchIds.length
    w2ui.grid.searchData = [{'field': 'recid', 'value':1}]
    w2ui.grid.refresh();
    w2ui.grid.selectAll();
  }
}
/************************************************************** */
function updateGrid(server_js) 
{
  //$().w2destroy('grid');

  let searches=[]
  let columns=[]
  let headers = server_js.headers
  let data = server_js.data

  //console.log(headers)
  //console.log(data)

  console.time("Prepare Data")
  let typing = { number: 'float', string: 'text'}
  
  for (let i=0; i<headers.length; ++i)
  {
    let col = headers[i]
    let type = typing[typeof(data[0][i])]
    columns.push({field:col, text:alias(col), sortable:true})
    searches.push({field:col, text:col, label:col, type: type})
  }

  columns[headers.indexOf('address')].size = "200px"
  columns[headers.indexOf('city')].size = "100px"
  columns[headers.indexOf('beds')].size = "50px"
  columns[headers.indexOf('baths')].size = "50px"
  columns[headers.indexOf('state_code')].size = "50px"

  // w2ui.grid.searches=searches
  let count=1
  let records=[]
  /*
  for (let row of data){
    let rec={recid:count++}
    for (let i=0; i< headers.length; i++){
      rec [headers[i]]= row[i]
    }
    records.push(rec)
  }
  */
  console.timeEnd("Prepare Data")


  console.time("Init Grid")
  //$('#grid').w2grid
  $().w2grid({
    name : 'grid',  

    show: {
      toolbar: true,
      footer: true,
      lineNumbers: true
    },
    limit: 100,
    toolbar: {
      items: [
          { type: 'break' },
          { type: 'html', id: 'launch-map',  
          html: 
          '<button style="background-color:white; border:1px solid #bfbfbf; border-radius: 3px; padding:4px;font-weight:normal" onclick="JavaScript:launchMap()"> Show on Map</button>',
          disabled: true,
          onClick: launchMap},
          { type: 'spacer' },
          { type: 'html', id: 'font-increase',  
          html: 
          '<button style="background-color:white; border:1px solid #bfbfbf; border-radius: 3px; margin: 0px 2px 0px 0px; padding:2px;font-weight:normal" onclick="JavaScript:increaseFontSize()"> <img src="./assets/images/font_size_increase.svg" style="height:20px;width:20px" /></button>',
          disabled: false,
          onClick: increaseFontSize},
          { type: 'html', id: 'font-decrease',  
          html: 
          '<button style="background-color:white; border:1px solid #bfbfbf; border-radius: 3px; margin: 0px 2px 0px 0px; padding:2px;font-weight:normal" onclick="JavaScript:decreaseFontSize()"> <img src="./assets/images/font_size_decrease.svg" style="height:20px;width:20px" /></button>',
          disabled: false,
          onClick: decreaseFontSize},
      ],
    },
    multiSearch: true,
    columns: columns,
    searches: searches,
    //records: records
    onSelect: function(event) {
      this.toolbar.enable('launch-map');
  },

  onUnselect: function(event) {
    if (this.getSelection().length == 0)
      this.toolbar.disable('launch-map');
   },

  onClick: function(event) {
    event.onComplete = function()
      {
        if (this.getSelection().length == 0)
          this.toolbar.disable('launch-map');
      }
   },

  })

  for (let row of data)
  {
    let rec={recid:count++, w2ui: {} }
    for (let i=0; i< headers.length; i++)
    {
      rec [headers[i]]= row[i]
    }
    rec.w2ui.style = 'font-weight:600;'
    w2ui.grid.records.push(rec)
  }


  w2ui.grid.refresh();
  $('#grid').w2render('grid');
}

/*************************************************************** */
var sever_js = null;

function processResp(resp)
{
  server_js = resp;
  
  iLat = server_js.headers.indexOf('latitude')
  iLng = server_js.headers.indexOf('longitude')

  updateGrid(resp);
  $(document).ready(function ()
  {
    w2ui.grid.selectAll();
    launchMap(100);
    maximizeMap();
  });
}

function launchMap(percentage)
{
  coords=[]
  rec_ids = []

  let center_lat=0
  let center_lng=0
  let sel=w2ui.grid.getSelection()
  if (sel.length==0)
    return

  let max_lat = -999, max_lng = -999
  let min_lat =  999, min_lng =  999

  for (let rec_id of sel)
  {
    rec_ids.push(rec_id)
    let rec=w2ui.grid.get(rec_id)
    let lat=rec.latitude/1e6
    let lng=rec.longitude/1e6
   
    max_lat = (lat>max_lat)? lat : max_lat
    max_lng = (lng>max_lng)? lng : max_lng

    min_lat = (lat<min_lat)? lat : min_lat
    min_lng = (lng<min_lng)? lng : min_lng
  
    coords.push([[lat,lng], rec_id-1])
  }
  center_lat = (max_lat + min_lat)/2
  center_lng = (max_lng + min_lng)/2
  var minPoint = L.latLng(min_lat,min_lng)
  var maxPoint = L.latLng(max_lat,max_lng)
  bounds = L.latLngBounds(minPoint,maxPoint)

  map_center=[center_lat, center_lng]
  
  showMap(percentage)
}

function increaseFontSize()
 {
  let font_size= $('.w2ui-reset table tr td').css('font-size')
  font_size = parseInt(font_size.slice(0, -2)) + 1
  if(font_size > 18)
    font_size = 18
  $('.w2ui-reset table tr td').css('font-size', `${font_size}px`)
 }

 function decreaseFontSize()
 {
  let font_size= $('.w2ui-reset table tr td').css('font-size')
  font_size = parseInt(font_size.slice(0, -2)) - 1
  if(font_size < 10)
    font_size = 10
  $('.w2ui-reset table tr td').css('font-size', `${font_size}px`)
 }

function showLegend(color, min, max,)
{
    let legendDiv = "counties_legend"
    
    let n_divs = color.range().length;

    var client_width = document.getElementById(legendDiv).clientWidth
    let legend_width = client_width / 3
    let rect_width = Math.max(legend_width / 6 , 10)
    let left_margin = client_width / 2 - rect_width

    let rect_idx = 0;
    let rect_id = 0;
    var client_height = document.getElementById(legendDiv).clientHeight
    let legend_height = client_height * 0.8 
    let top_margin = client_height * 0.15
    let rect_height = legend_height / (n_divs + 1)
    let color_idx = w2ui.layout.get('bottom').toolbar.get("overlay-color").selected
    let null_color = overlay_colors[color_idx].null_color;
    
    var svg
    svg =  d3.select(`#${legendDiv}`)
    .html('')
    .append("svg")
    .attr("width", client_width)
    .attr("height", client_height);
    // let rectPos = (i) => left_margin + i * rect_width;
    let rectPos = (i) => top_margin + (n_divs - 1 - i) * rect_height;

    var g = svg.append("g")
        .attr("class", "key")
        .attr("transform", "translate(0,0)");

    g.selectAll("rect")
        .data(color.range().map((d) => rect_idx++ ) )
        .enter().append("rect")
        .attr("height", rect_height)
        .attr("x", left_margin)
        .attr("y", d => rectPos(d))
        .attr("width", rect_width)
        .attr("fill", function (d) { return color.range()[d] })
        .attr("id", d => `rect_${rect_id++}`)

    g.append("rect")
    .attr("stroke", "black")
    .attr("height", rect_height / 2)
    .attr("x", rect_width)
    .attr("y", rectPos(-2))
    .attr("width", rect_width)
    .attr("fill", `${null_color}`)
    .attr("id", "no_data")

    g.append("text")
    .attr("x", rect_width + rect_width * 2)
    .attr("y", rectPos(-2) + rect_height / 2 )
    .text("- No Data")
    .attr("style", "font-size: 75%")
    .attr("id", "no-data")

    // let toolbar = w2ui.layout.get('top').toolbarv
    // let id = toolbar.get("values").selected
    // let text = toolbar.get(`values:${id}`).text
    // let text = instance.alias(Comma_Sep(instance.state.request.measures,instance.state.id))
    let idx = w2ui.layout.get('bottom').toolbar.get("overlay-type").selected
    let text = overlays[idx].text

    g.append("text")
        .attr("id", "caption")
        .attr("x", 0) 
        .attr("y", top_margin / 2)
        .attr("fill", "#000")
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .attr("style", "font-size: 75%")
        .text(text);

    let text_pixels = document.getElementById("caption").getComputedTextLength()
    g.select("#caption")
        .attr("x", client_width  /  2 - text_pixels /2 );

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
            .attr("y", rectPos(val[1] - 1) + 3)
            .attr("x", left_margin + rect_width * 1.5)
            .attr("class", "ldegree")
            .attr("fill", "#000")
            .attr("style", "font-size: 60%")
            .text(Math.round(val[0]));
            //.text(Math.round(10*val[0])/10);
    }

    for (let i = 0; i <= n_divs; ++i)
    {
        let width = rect_width, height = 1;
        if (i % 4 == 0)
        {
            width += 2;
            height = 2;
        }
        g.append('line')
            .style("stroke", "black")
            .style("stroke-width", height)
            .attr("x1", left_margin)
            .attr("y1", rectPos(i-1))
            .attr("x2", left_margin + width)
            .attr("y2", rectPos(i-1)); 
    }
}

var legend_control = L.featureGroup();
async function showMap(percentage)
{
  if (!percentage)
    percentage = 50
    
  if (osMap==null) 
  {
    // try
     { 
      var streets = L.tileLayer('https://api.maptiler.com/maps/basic/{z}/{x}/{y}@2x.png?key=vgYeUXLEg9nfjeVPRVwr', {id: 'simple_map', tileSize: 1024, zoomOffset: -2, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'}),
      satellite   = L.tileLayer('https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}@2x.jpg?key=vgYeUXLEg9nfjeVPRVwr', {id: 'satellite', tileSize: 1024, zoomOffset: -2, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'}),
      toner = L.tileLayer('https://api.maptiler.com/maps/toner/{z}/{x}/{y}@2x.png?key=vgYeUXLEg9nfjeVPRVwr', {id: 'toner', tileSize: 1024, zoomOffset: -2, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'});
    
      baseMaps = {
        "Streets": streets,
        "Satellite": satellite,
        "Toner": toner,
      }
  
      osMap = L.map("map", 
       {preferCanvas: true,
        minZoom: 1,
        maxZoom: 16,
        layers: [streets]
       });
       osMap.on('overlayadd',function (e)
       {
         if (e.name == "Legend")
          $("#counties_legend").show()
         countiesOverlay.bringToBack();
       })
       osMap.on('overlayremove',function (e)
       {
         if (e.name == "Legend")
          $("#counties_legend").hide()
       })

      var legend = L.control({position: 'bottomleft'});
      legend.onAdd = function () {
        var div = L.DomUtil.create('div', 'info_legend');
        div.setAttribute('id','counties_legend');
        return div;
      };
      legend.addTo(osMap);
      legend_control.addTo(osMap);

       var state_colors = {'09':'red', '34':'green', '36':'blue'}

       let overlay_type = w2ui.layout.get('bottom').toolbar.get("overlay-type").selected

       await buildCountyColorLookup(overlay_type)
       var counties = null;
       
       createCountiesOverlay()
         
      }
    }
  
  clearMap()
  var selectedType = w2ui.layout.get('bottom').toolbar.get('map-type').selected
  if (selectedType == "regular-map")
  {
    setRegMap()
    autoZoom()
  }
  else if (selectedType == 'heat-map')
  {
    setHeatMap()
  }
  else if (selectedType == 'clustering-map'){
    setClusterMap()
  }

  
  w2ui.layout.get('bottom').size = percentage + '%'
  w2ui.layout.show('bottom', true)

}

function createCountiesOverlay()
{ 
  let idx = w2ui.layout.get('bottom').toolbar.get("overlay-type").selected
  let meas_name = overlays[idx].text

  $.getJSON('geomap_counties.json', function(county_json) {
   countiesOverlay = L.geoJSON(county_json, 
    {
      style: function(d) 
      {
        let state_code = d.properties.STATE;
        // let s = parseInt(code);
        let county_name = d.properties.NAME;
        let county_code = d.properties.COUNTY;
        let value = county_lookup[state_code][county_name];
        return {fillColor:color(value), fillOpacity: 0.75, color:'white', weight:1};
      },
      onEachFeature: function(d, layer)
      {
        let state_code = d.properties.STATE;
        // let s = parseInt(code);
        let county_name = d.properties.NAME;
        let county_code = d.properties.COUNTY;
        let value = county_lookup[state_code][county_name];
        layer.bindPopup(`county:<b>${county_name}</b> <br> ${meas_name}:<b>${value}</b>`);
      }
    });
    countiesOverlay.addTo(osMap)
    if (lcontrol) 
    {
      lcontrol.remove();
    }
    lcontrol = L.control.layers(baseMaps, {"Counties": countiesOverlay, "Legend": legend_control, "Markers": markers})
    lcontrol.addTo(osMap);
    countiesOverlay.bringToBack()
  })
  $(map).ready(function ()
  {
    showLegend(color,min_data,max_data)
  });

}

function onClickCounty(d)
{
  alert('clicked')
}

function autoZoom()
{
  $(map).ready(function () 
  {
    osMap.invalidateSize()
    mapZoom = osMap.getBoundsZoom(bounds)
    osMap.fitBounds(bounds)
  });
}

function setClusterMap()
{
  if(cluMarkers)
	  lcontrol.removeLayer(cluMarkers);
  cluMarkers = L.markerClusterGroup();
  for (let coord of coords) 
  {
    cluMarkers.addLayer(L.marker(coord[0]));
  }
  osMap.addLayer(cluMarkers);
  if(heatmap)
	  lcontrol.removeLayer(heatmap);
  lcontrol.addOverlay(cluMarkers,"Markers")
  disableBn(["heat_gradient","heat_radius","heat_opacity","marker_type","marker_color"])
  autoZoom()
}

function switchMapType(mapType)
{
  if (osMap)
  {
    clearMap()
    switch (mapType)
    {
      case "heat-map":
          setHeatMap()
        break;
      case "clustering-map":
          setClusterMap()
        break;  
      default:
          setRegMap()
        break;
    }
  }
}

async function switchOverlayType()
{
  if (countiesOverlay)
  {
    lcontrol.removeLayer(countiesOverlay)
    let overlay_type = w2ui.layout.get('bottom').toolbar.get("overlay-type").selected
    osMap.removeLayer(countiesOverlay)
    await buildCountyColorLookup(overlay_type)
    createCountiesOverlay()
  }
}

function disableBn(buttons){
  for (bn of buttons)
    w2ui.layout.get('bottom').toolbar.hide(bn)
}

function enableBn(buttons){
  for (bn of buttons)
    w2ui.layout.get('bottom').toolbar.show(bn)
}

function clearMap(){
  if (markers)
  {
    osMap.removeLayer(markers);
	lcontrol.removeLayer(markers);
  }
  if (heatmap)
    osMap.removeLayer(heatmap);
  if (cluMarkers)
    osMap.removeLayer(cluMarkers);
}

function setMarkers() 
{
  if (markers)
    osMap.removeLayer(markers)
  markers = L.featureGroup()
  for (let coord of coords) 
  {
    L.circleMarker(coord[0], {
        fillColor: markerColor,
        fillOpacity: 1,
        stroke: true,
        color: 'white',
        weight: 1,
        radius: 5
    }).addTo(markers)
    .on('click', onMapClick);
    
    function onMapClick(e)
    {
      let x = e.originalEvent.x 
      let y = e.originalEvent.y 
      let node = server_js.data[coord[1]].slice()
      node[iLat] *= 1e-6
      node[iLng] *= 1e-6
      propertyPopup(node, x, y)
    }
  }
  markers.addTo(osMap);
  if (lcontrol)
  {
	lcontrol.addOverlay(markers,"Markers");
	if (heatmap)
		lcontrol.removeLayer(heatmap);
	if (cluMarkers)
		lcontrol.removeLayer(cluMarkers);
  }
  markers.bringToFront();
}



function setRegMap(){
  setMarkers()
  autoZoom()
  disableBn(["heat_gradient","heat_radius","heat_opacity"])
  enableBn(["marker_type","marker_color"])
}

function setHeatMap()
{
  let data = []
  if (heatmap)
	 lcontrol.removeLayer(heatmap);
  if(cluMarkers)
	 lcontrol.removeLayer(cluMarkers);

  for (let coord of coords)
    data.push(coord[0]);
  heatmap = L.heatLayer(data,{radius: radiusVal, blur: 0, max: 1, minOpacity: opacity, gradient:{
    '0.00': 'rgb(255,0,255)',
    '0.25': 'rgb(0,0,255)',
    '0.50': 'rgb(0,255,0)',
    '0.75': 'rgb(255,255,0)',
    '1.00': 'rgb(255,0,0)'
  }});
  lcontrol.addOverlay(heatmap,"Heat Map")
  heatmap.addTo(osMap)
  disableBn(["marker_type",,"marker_color"])
  enableBn(["heat_gradient","heat_radius","heat_opacity"])
  autoZoom()
}

function changeRadius() {
  radiusVal = (radiusVal == 30) ? 10:30;
  heatmap.setOptions({radius:radiusVal})
}

function changeOpacity() {
  opacity = (opacity == 1) ? 0.3:1;
  heatmap.setOptions({minOpacity:opacity})
}

function changeGradient() {
  var gradientVal
  gardCase += 1
  switch(gardCase){
    case 1:
      gradientVal = {
        '0': 'Black',
        '0.5': 'Aqua',
        '1': 'White'
      };
      break;
    case 2:
      gradientVal = {
        '0': 'Black',
        '0.4': 'Purple',
        '0.6': 'Red',
        '0.8': 'Yellow',
        '1': 'White'
      }
      break;
    case 3:
      gradientVal = {
        '0.0': 'rgb(0, 0, 0)',
        '0.6': 'rgb(24, 53, 103)',
        '0.75': 'rgb(46, 100, 158)',
        '0.9': 'rgb(23, 173, 203)',
        '1.0': 'rgb(0, 250, 250)'
      }
      break;
    default:
      gradientVal = {
        '0.00': 'rgb(255,0,255)',
        '0.25': 'rgb(0,0,255)',
        '0.50': 'rgb(0,255,0)',
        '0.75': 'rgb(255,255,0)',
        '1.00': 'rgb(255,0,0)'
      }
      gardCase = 0;
      
  }
  heatmap.setOptions({gradient:gradientVal})
}

async function InitPage() 
{

  let type = sessionStorage.getItem('type')
  if (type == 'data')
  {
    let server_data = JSON.parse(sessionStorage.getItem('server_data'))
    processResp(server_data)
    return
  }

  let base_dim = sessionStorage.getItem('base_dim')
  let dim_filters = sessionStorage.getItem('dim_filters')
  let val_filters = sessionStorage.getItem('val_filters')
  
  var params = {
    qid: "MD_RETR",
    dim: base_dim,
  };

  if (dim_filters.length > 0)
    params.dim_filters = dim_filters
  
  if (val_filters.length > 0)
    params.val_filters = val_filters
   
  serverRequest(params).then(processResp);

} //initPage

function propDetailsFormat(node) 
{
  let headers = this.server_js.headers
  let fields = ['prop_type', 'beds', 'baths', 'building_size', 'price', 'price_per_sqft', 'assessment_building', 'assessment_land', 'assessment_total', 'year_built', 'elevation', 'flood_zone']
  let indices = fields.map (f => headers.indexOf(f))
  
  let html = ''
  for (let i of indices)
  {
      let header = headers[i]
      let data =  node[i]
      html += `<tr><td>${this.alias(header)}:</td><td>&nbsp</td><td><b>${data}</b></td></tr>`
  }
  return html
}

function propInfoFormat(data) 
{
  let html = `<table class="popup-table"><thead><h6 style="text-align: center;">${data.title}</h6></thead>`
  for (let i=0; i < data.headers.length; i++)
  {
    let header = data.headers[i].replaceAll('_', ' ')
    if (header.includes('2019'))
      html += `<tr><td>${this.alias(header)}:</td><td>&nbsp</td><td><b>${data.data[0][i].toLocaleString("en")}</b></td></tr>`
  }
  html += '</table>'
  return html
}

async function propertyPopup(node, x, y)
{
    if (!propDiv)
    {
      propDiv = d3.select("#container").append("div")
      .attr("class", "container")
      .attr("id", "prop-popup")
      .style("opacity", 0)
      .style("width", "300px")
    }

    if(x==null||x==undefined)
      x=20
    if(x==null||x==undefined)
      y=20
    let address, img_url = "";

    let prop_info_params = 
    {
      state_code : node[4], 
      county : node[3],
      postal_code : node[2]
    }

    let prop_info_data = {}

    for (let [key, value] of Object.entries(prop_info_params)) 
    {
      prop_info_data[key] = await serverRequest ({'qid':'MD_RETR', 'dim':key, 'dim_filters':`${key}:${value}` })
      prop_info_data[key].title = `<b>${this.alias(key)}</b> : ${value}`
    }

    address = `
    <div class="row">
      <div class="col-11">
      </div>
        <button type="button" class="btn-close col-1 d-inline-flex p-0" aria-label="Close" onclick="hideMapTooltip()"></button>
    </div>
    <div class="row">
      <div class="col-12 align-content-center" style="height:200px;">
          <img id="pop_img" style="width:100%; height:100%; object-fit: contain;" class="img" alt="..." src="assets/images/loading.gif">
      </div>
    </div>

    <div class="row">
      <div class="col-12 px-2 d-flex align-items-center justify-content-center">
        <p style="font-size:0.75em; color:black; font-weight:bold; text-align: center;">${node[0]}<br>${node[1].replaceAll('-',', ')}, ${node[2]}</p>
      </div>
    </div>

    <div id="popup-info" class="row px-4 d-flex" style="height:200px;">
      <div id="carouselExampleControls" class="carousel carousel-dark slide" data-bs-ride="carousel" data-interval="false">
        <div class="carousel-inner px-3">
          <div class="carousel-item active">
            <table class="popup-table">
              <thead><h6 style="text-align: center;"><b>Property Details</b></h6></thead>
              ${this.propDetailsFormat(node)}
            </table>
          </div>
          <div class="carousel-item" id="state_info">
            ${this.propInfoFormat(prop_info_data.state_code)}
          </div>
          <div class="carousel-item" id="county_info">
            ${this.propInfoFormat(prop_info_data.county)}
          </div>
          <div class="carousel-item" id="zip_info">
            ${this.propInfoFormat(prop_info_data.postal_code)}
          </div>
        </div>
        <button class="carousel-control-prev ms-n4" type="button" data-bs-target="#carouselExampleControls" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Previous</span>
        </button>
        <button class="carousel-control-next me-n4" type="button" data-bs-target="#carouselExampleControls" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Next</span>
        </button>
      </div>
    </div>
    
    <div class="row px-4  align-items-center justify-content-center">
      <a style=" margin: 0px 6px 12px 0px; background-color: rgb(155, 0, 31); text-align: center;" target="_blank" class="btn py-1 px-0 col-4 text-nowrap text-white infobuttons" href="https://www.zillow.com/homes/${node[0]},${node[1].replaceAll('-',', ')}, ${node[2]}_rb">Zillow</a>
      <a style="margin: 0px 0px 12px 6px; background-color: rgb(155, 0, 31); text-align: center;" target="_blank" class="btn py-1 px-0 col-4 text-nowrap text-white infobuttons" href="https://www.google.com/maps/search/${node[iLat]},${node[iLng]}">Google</a>
    </div>
    `
      let p = `${node[0].replaceAll(' ','-')}-${node[1].replaceAll(' ','-')}-${node[2].replaceAll(' ','-')}_rb`
      const api_url = `getimage/${p}`;
      var request = new Request(api_url, { method: "POST" });
      const response = await fetch(request);
      img_url = await response.text()
      // let str = 'property="og:image" content="'
      // let start = data.indexOf(str) + str.length
      // let end = data.indexOf('"' , start)
      // img_url = data.substring(start,end)
      if (img_url.startsWith('https://'))
      {
        $(document).ready(function() {
          $("#pop_img").attr('src',img_url)
        });
      }
      else
      {
        $(document).ready(function() {
          $("#pop_img").attr('src',"assets/images/logo_sun.png");

        });
      }
      // e.target.bindPopup(address).openPopup();
      d3.select("#prop-popup").style("opacity", 0)
      .html(address)
      .style("left", x + "px")
      .style("top", y + "px")

      $('#carouselExampleControls').carousel({pause: true, interval: false });

      // const popup_ps = new PerfectScrollbar(`#popup-info`, {
      //   wheelSpeed: 2,
      //   wheelPropagation: false,
      //   minScrollbarLength: 20
      // })

      // ps_object['popup-info']=popup_ps

      //let position = $(`#${this.getId()}`).offset()
      let screen_width = window.innerWidth
      let screen_height = window.innerHeight
      let popup_width = $('#prop-popup').outerWidth()
      let popup_height = $('#prop-popup').outerHeight()
      const offset = 20
      x += offset
      let right_edge = x + popup_width // + position.left
      let bottom_edge = y + popup_height // + position.top 
      console.log(y)
      console.log(bottom_edge + '= bottom_edge')
      if (right_edge >= screen_width)
        x = Math.max(x - popup_width - 2 * offset, 0)
      if (bottom_edge >= screen_height)
        y = Math.max(y - popup_height, 0)
      
      d3.select("#prop-popup").style("opacity", 1)
      .style("left", x + "px")
      .style("top", y + "px")
      .style("z-index", 999)
      
  }
  function hideMapTooltip ()
  {
    propDiv.style("opacity", 0).style("z-index",-1000)
  }

$(document).ready(InitPage);