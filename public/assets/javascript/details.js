var coords = []
var bounds = {}
var map_center = {}
var rec_ids = []
var map = null
var markers = L.layerGroup();
var heatmap = L.heatLayer([],{radius: 30},{blur: 0},{0.4: 'blue', 0.65: 'lime', 1: 'red'});
var radiusVal = 20
var opacity = 1
var gardCase = 0
var osMap = null
var layerGroup = null

async function serverRequest(params) {
  p = new URLSearchParams(params).toString();

  const api_url = `gserver/${p}`;

  var request = new Request(api_url, { method: "POST" });

  const response = await fetch(request);
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
              text: function (item) {
                var text = item.selected;
                var el = this.get("map-type:" + item.selected);
                return el.text;
              },
              selected: "regular-map",
              items: [
                { id: "regular-map", text: "Regular Map" },
                { id: "heat-map", text: "Heat Map" },
              ],
            },
            { type: "break" },
            {
              type: "button",
              id: "item3",
              text: "Change Gradient",
              onClick: changeGradient,
            },
            {
              type: "button",
              id: "item4",
              text: "Change Radius",
              onClick: changeRadius,
            },
            {
              type: "button",
              id: "item5",
              text: "Change Opacity",
              onClick: changeOpacity,
            },
            { type: "break" },
            {
              type: "button",
              id: "item6",
              text: "Draw on Map",
                 onClick: drawOnMap,
            },
            //{ type: "html", html: "<pre> </pre>" },
            {
              type: "button",
              id: "item7",
              text: "Find Points",
                  onClick: findPoints,
            },
            { type: "spacer"},
            {
              type: 'html', id: 'hide-map', 
              html: 
              '<button style="border:0px;padding:0px 2px 0px;" onclick="hideMap()"> <img src="./assets/images/minimize.svg" style="height:16px;width:16px" /> </button>',
            },      
            //{ type: "html", html: "<pre> </pre>" }, 
            {
              type: 'html', id: 'restore-map', 
              html: 
              '<button style="border:0px;padding:0px 2px 0px;" onclick="restoreMap()"> <img src="./assets/images/window-split.svg" style="height:16px;width:16px" /> </button>',
            },
            // { type: "html", html: "<pre> </pre>" },
            {
              type: 'html', id: 'max-map', 
              html: 
              '<button style="border:0px;padding:0px 2px 0px;" onclick="maximizeMap()"> <img src="./assets/images/maximize2.svg" style="height:16px;width:16px" /> </button>',
            },
          ],
          onClick: function (event) {
            if (event.target == "map-type:regular-map") {
              console.log("map changed to regular")
              switchReg()
            } 
            else if (event.target == "map-type:heat-map") {
              console.log("map changed to heat")
              switchHeat()
            }
          },
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
  $(map).ready(function () {
    osMap.invalidateSize()
  });
}

function restoreMap()
{
  w2ui.layout.show("main", true)
  w2ui.layout.get("bottom").size = '50%'
  w2ui.layout.show("bottom", true)
  $(map).ready(function () {
    osMap.invalidateSize()
  });
}
var drawingManager = null
var rectangle = null
var circle = null

function drawOnMap()
{
  if (rectangle)
  {
    rectangle.setMap(null)
    rectangle = null
  }

  if (circle)
  {
    circle.setMap(null)
    circle = null
  }


  if (drawingManager == null)
    drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.RECTANGLE,
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.BOTTOM_CENTER,
      drawingModes: ['rectangle', 'circle']
    },
    rectangleOptions: {
      editable: true,
      draggable: true,
      fillColor: 'red',
      fillOpacity: 0.3
    },
    
    circleOptions: {
      editable: true,
      draggable: true,
      fillColor: 'red',
      fillOpacity: 0.3
    },
    
    });
    drawingManager.setMap(map);
    
    google.maps.event.addListener(drawingManager, 'rectanglecomplete', 
    function(rect) {
    //event.overlay.set('editable', false);
    drawingManager.setMap(null);
    rectangle = rect;
    console.log(rect);
    });
    google.maps.event.addListener(drawingManager, 'circlecomplete', 
    function(circ) {
    drawingManager.setMap(null);
    circle = circ;
    console.log(circle);
    });

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
      let contains = bounds.contains(coords[i])
      if (contains)
        w2ui.grid.last.searchIds.push(rec_ids[i]-1);
    }    
    filter_table = true
  }

  else if (circle != null)
  {
    w2ui.grid.last.searchIds = []

    let center = circle.getCenter()
    let radius = circle.getRadius()
    let dist = google.maps.geometry.spherical.computeDistanceBetween
    
    for (let i=0; i<coords.length; ++i)
    {
      let contains = dist(center, new google.maps.LatLng(coords[i])) <= radius;
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
          { type: 'html', id: 'launch-map', text: 'Show on Map', 
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

function processResp(resp)
{
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

  for (let rec_id of sel){
    rec_ids.push(rec_id)
    let rec=w2ui.grid.get(rec_id)
    let lat=rec.latitude/1e6
    let lng=rec.longitude/1e6
   
    max_lat = (lat>max_lat)? lat : max_lat
    max_lng = (lng>max_lng)? lng : max_lng

    min_lat = (lat<min_lat)? lat : min_lat
    min_lng = (lng<min_lng)? lng : min_lng
  
    coords.push(L.latLng(lat, lng))
  }
  center_lat = (max_lat + min_lat)/2
  center_lng = (max_lng + min_lng)/2
 
  bounds = { max_lat: max_lat, min_lat: min_lat, 
                 max_lng: max_lng, min_lng: min_lng}

  map_center=[center_lat, center_lng]
  
  showMap()
}

function showMap(){
  if (osMap==null) {
    osMap = L.map("map").setView(map_center, 8);
    L.tileLayer('https://api.maptiler.com/maps/basic/{z}/{x}/{y}.png?key=vgYeUXLEg9nfjeVPRVwr', {
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
    }).addTo(osMap);
    $(map).ready(function () {
      osMap.invalidateSize()
    });
  }
  else {
    osMap.panTo(new L.LatLng(map_center[0], map_center[1]));
    osMap.setZoom(8)
  }
  
  var map_type = w2ui.layout.get('bottom').toolbar.get('map-type').selected
  console.log("clear everything")
  markers.clearLayers()
  osMap.removeLayer(heatmap)
  
  if (map_type == "regular-map")
  {
    setMarkers()
    markers.addTo(osMap)
  }
  else if (map_type == 'heat-map')
  {
    initHeatMap()
    heatmap.addTo(osMap)
  }
  w2ui.layout.get('bottom').size = '50%'
  w2ui.layout.show('bottom', true)
}
function switchReg(){
  osMap.removeLayer(heatmap)
  setMarkers()
}
function switchHeat(){
  markers.clearLayers()
  initHeatMap()
  heatmap.addTo(osMap)
}

function setMarkers() {
  console.time("markers");
  for (let coord of coords) 
    L.marker(coord).addTo(osMap);
  console.timeEnd("markers");
}

function initHeatMap()
{
  let data = []
  for (let coord of coords)
    data.push(coord);
  heatmap = L.heatLayer(data,{radius: radiusVal, blur: 0, max: 1, minOpacity: opacity, gradient:{
    '0.00': 'rgb(255,0,255)',
    '0.25': 'rgb(0,0,255)',
    '0.50': 'rgb(0,255,0)',
    '0.75': 'rgb(255,255,0)',
    '1.00': 'rgb(255,0,0)'
  }});
}

function getHeatMap()
{
 if (heatmap == null)
    initHeatMap(map);
 return heatmap;
}

function changeRadius() {
  radiusVal = (radiusVal == 100) ? 20:100;
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
    params.dim_filters = encodeURIComponent(dim_filters)
  
  if (val_filters.length > 0)
    params.val_filters = encodeURIComponent(val_filters)
   
  serverRequest(params).then(processResp);

} //initPage




$(document).ready(InitPage);