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
var markerColor = "red"

let aliases = {
  'beds:count'     : 'Number of Properties',
  'price:avg'      : 'Average Price',
  'size:avg'       : 'Average Size',
  'prop_type'      : 'Property Type',
  'county'         : 'County',
  'state_code'     : 'State',
  'city'           : 'City',
  'postal_code'    : 'Zip Code',
  'elevation:avg'  : 'Average Elevation',
  'year_built:min' : 'Earliest Construction (Year)',
  'pop 2019'       : 'Population 2019'
}

var propDiv = null;

function alias(name)
{
  let aliased_name = name
  if ( name in aliases)
  {
    aliased_name = aliases[name]
  }
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
  console.log("here",response)
  const json = await response.json();

  return json;
}

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
              selected: "red",
              items: [
                { id: "black", text: "Black"},
                { id: "green", text: "Green"},
                { id: "blue", text: "Blue"},
                { id: "red", text: "Red"},
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
function updateGrid(server_js) {

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
    columns.push({field:col, text:col, sortable:true})
    searches.push({field:col, text:col, label:col, type: type})
  }

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
  //console.log(columns)
  //console.log(searches)
  //console.log(records)

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
          '<button style="border:1px;padding:2px;font-weight:normal" onclick="JavaScript:launchMap()"> <img src="./assets/images/map-icon.png" style="height:24px;width:24px" /> Show on Map</button>',
          disabled: true,
          onClick: launchMap}
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

  for (let row of data){
    let rec={recid:count++}
    for (let i=0; i< headers.length; i++){
      rec [headers[i]]= row[i]
    }
    w2ui.grid.records.push(rec)
  }
  console.timeEnd("Init Grid")

  w2ui.grid.refresh();
  $('#grid').w2render('grid');
}

/*************************************************************** */
var sever_js = null;

function processResp(resp)
{
  server_js = resp;
  updateGrid(resp);
}

function launchMap()
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
  
  showMap()
}

function showMap()
{
  if (osMap==null) 
  {
    // try
     { 
      var streets = L.tileLayer('https://api.maptiler.com/maps/basic/{z}/{x}/{y}@2x.png?key=vgYeUXLEg9nfjeVPRVwr', {id: 'simple_map', tileSize: 1024, zoomOffset: -2, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'}),
      satellite   = L.tileLayer('https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}@2x.jpg?key=vgYeUXLEg9nfjeVPRVwr', {id: 'satellite', tileSize: 1024, zoomOffset: -2, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'}),
      toner = L.tileLayer('https://api.maptiler.com/maps/toner/{z}/{x}/{y}@2x.png?key=vgYeUXLEg9nfjeVPRVwr', {id: 'toner', tileSize: 1024, zoomOffset: -2, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'});
      var baseMaps = {
        "Streets": streets,
        "Satellite": satellite,
        "Toner": toner,
      };
    
      osMap = L.map("map", 
       {preferCanvas: true,
        minZoom: 1,
        maxZoom: 16,
        layers: [streets]
       });

       var state_colors = {'09':'red', '34':'green', '36':'blue'}

       var counties = null;

       var countiesOverlay = L.d3SvgOverlay(function(sel, proj){

        var features = sel.selectAll('path')
          .data(topojson.feature(counties, counties.objects.counties).features);
      
        features
          .enter()
          .append('path')
          .attr('stroke','white')
          // .attr('fill', 'blue')
          // .attr('fill-opacity', 0.2)
          .attr("style", function (d)
            {
                let state_code = d.properties.STATE;
                // let s = parseInt(code);
                let county_name = d.properties.NAME;
                let county_code = d.properties.COUNTY;
                let op = parseInt(county_code)/100
                // let value = county_data[code][county];

                return `fill:${state_colors[state_code]}; fill-opacity: ${op}`;

            })
          .attr('d', proj.pathFromGeojson)
      
        features
          .attr('stroke-width', 0.6 / proj.scale);
      
      });
      
      
      d3.json('topojson_counties.json', function(error, data){
        counties = data;
        countiesOverlay.addTo(osMap);
      });

       this.object_instance = osMap
     }
    //  catch(e)
    //  {
    //    console.log(e)
    //  }
     L.control.layers(baseMaps, {"Counties": countiesOverlay}).addTo(osMap);
     L.easyButton( 'fa-undo', function(){
      osMap.fitBounds(bounds);
      }).addTo(osMap);
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

  
  w2ui.layout.get('bottom').size = '50%'
  w2ui.layout.show('bottom', true)
}


function autoZoom()
{
  $(map).ready(function () 
  {
    console.log("This is map:",map)
    osMap.invalidateSize()
    mapZoom = osMap.getBoundsZoom(bounds)
    osMap.fitBounds(bounds)
  });
}

function setClusterMap()
{
  cluMarkers = L.markerClusterGroup();
  for (let coord of coords) 
  {
    cluMarkers.addLayer(L.marker(coord[0]));
  }
  osMap.addLayer(cluMarkers);
  disableBn(["heat_gradient","heat_radius","heat_opacity","marker_type","marker_color"])
  autoZoom()
}

function switchMapType(mapType){
  if (osMap){
    clearMap()
    switch (mapType) {
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
    osMap.removeLayer(markers);
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
        radius: 6,
    }).addTo(markers)
    .on('click', onMapClick);
    
    function onMapClick(e)
    {
      let x = e.originalEvent.x 
      let y = e.originalEvent.y 
      let node = server_js.data[coord[1]]
      propertyPopup(node, x, y)
    }
  }

  markers.addTo(osMap);
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
  for (let coord of coords)
    data.push(coord[0]);
  heatmap = L.heatLayer(data,{radius: radiusVal, blur: 0, max: 1, minOpacity: opacity, gradient:{
    '0.00': 'rgb(255,0,255)',
    '0.25': 'rgb(0,0,255)',
    '0.50': 'rgb(0,255,0)',
    '0.75': 'rgb(255,255,0)',
    '1.00': 'rgb(255,0,0)'
  }});
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

  console.log('base_dim='+base_dim)
  console.log('dim_filters='+dim_filters)
  console.log('val_filters='+val_filters)
  
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
              <tr><td>Property type:</td> <td>&nbsp</td> <td><b>${node[5]}</b></td></tr>
              <tr><td>Bedrooms:</td> <td>&nbsp</td><td><b> ${node[7]}</b></td></tr>
              <tr><td>Bathrooms:</td> <td>&nbsp</td><td> <b>${node[8]}</b></td></tr>
              <tr><td>Size:</td> <td>&nbsp</td> <td><b>${node[9]} sqft</b></td></tr>
              <tr><td>Price:</td>  <td>&nbsp</td> <td><b>$${node[10].toLocaleString("en")}</b></td></tr>
              <tr><td>Year built:</td> <td>&nbsp</td> <td><b>${node[11]}</b></td></tr>
              <tr><td>Elevation:</td> <td>&nbsp</td> <td><b>${node[14]}</b></td></tr>
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
      <a style="margin: 0px 0px 12px 6px; background-color: rgb(155, 0, 31); text-align: center;" target="_blank" class="btn py-1 px-0 col-4 text-nowrap text-white infobuttons" href="https://www.google.com/maps/search/${node[12]},${node[13]}">Google</a>
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