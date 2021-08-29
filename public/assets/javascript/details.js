var coords
var bounds
var map_center = {}
var rec_ids = []
var map = null
var cluMarkers
var boostType = "balloon"
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


async function serverRequest(params) {
  p = new URLSearchParams(params).toString();

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
              id: "marker_type",
              text: 
              function (item) {
                var el = this.get("marker_type:" + item.selected);
                return el.text;
              },
              selected: "balloon",
              items: [
                { id: "balloon", text: "Balloon"},
                { id: "ball", text: "Ball"},
                { id: "circle", text: "Circle"},
              ],
              onRefresh: function(event){
                if (boostType != event.item.selected)
                {
                  boostType = event.item.selected
                  setMarkers()
                }

              }
            },
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
      
      let contains = rectangle.getBounds().contains(coords[i]);

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
      let contains = circle.getLatLng().distanceTo(coords[i]) < circle.getRadius();

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
  
    coords.push([lat,lng])
  }
  center_lat = (max_lat + min_lat)/2
  center_lng = (max_lng + min_lng)/2
  var minPoint = L.latLng(min_lat,min_lng)
  var maxPoint = L.latLng(max_lat,max_lng)
  bounds = L.latLngBounds(minPoint,maxPoint)

  map_center=[center_lat, center_lng]
  
  showMap()
}

function showMap(){
  if (osMap==null) {
    osMap = L.map("map", {preferCanvas: true
    }).setView(map_center,6)
    tileLayer = L.tileLayer('https://api.maptiler.com/maps/basic/{z}/{x}/{y}.png?key=vgYeUXLEg9nfjeVPRVwr', {
    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
    });
    tileLayer.addTo(osMap);
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


function autoZoom(){
  $(map).ready(function () {
    console.log("This is map:",map)
    osMap.invalidateSize()
    mapZoom = osMap.getBoundsZoom(bounds)
    osMap.fitBounds(bounds)
  });
}

function setClusterMap(){
  cluMarkers = L.markerClusterGroup();
  for (let coord of coords) {
    cluMarkers.addLayer(L.marker(coord));
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

function setMarkers() {
  if (markers)
    osMap.removeLayer(markers)
  markers = L.featureGroup()
  for (let coord of coords) {
    L.circleMarker(coord, {
        fillColor: markerColor,
        fillOpacity: 1,
        stroke: true,
        color: 'white',
        weight: 1,
        boostType: boostType,
        boostScale: 1,
        boostExp: 0,
        radius: 6
    }).addTo(markers);
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
    data.push(coord);
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