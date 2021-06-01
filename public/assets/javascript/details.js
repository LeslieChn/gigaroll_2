var coords = []
var bounds = {}
var map_center = {}
var map = null
var markers = [];
var heatmap = null

async function serverRequest(params) {
  p = new URLSearchParams(params).toString();

  const api_url = `gserver/${p}`;

  var request = new Request(api_url, { method: "POST" });

  const response = await fetch(request);
  const json = await response.json();

  return json;
}

function initMap (){

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
            { type: "html", html: "<pre> </pre>" },
            {
              type: "button",
              id: "item4",
              text: "Change Radius",
              onClick: changeRadius,
            },
            { type: "html", html: "<pre> </pre>" },
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
              text: "Display Rectangle",
              // onClick: displayRect,
            },
            { type: "html", html: "<pre> </pre>" },
            {
              type: "button",
              id: "item7",
              text: "Find Points",
              // onClick: findPoints,
            },
            { type: "spacer"},
            {
              type: 'html', id: 'hide-map', 
              html: 
              '<button style="border:0px;padding:0px;" onclick="hideMap()"> <img src="./assets/images/minimize.svg" style="height:16px;width:16px" /> </button>',
            },      
            { type: "html", html: "<pre> </pre>" }, 
            {
              type: 'html', id: 'restore-map', 
              html: 
              '<button style="border:0px;padding:0px;" onclick="restoreMap()"> <img src="./assets/images/window-split.svg" style="height:16px;width:16px" /> </button>',
            },
            { type: "html", html: "<pre> </pre>" },
            {
              type: 'html', id: 'max-map', 
              html: 
              '<button style="border:0px;padding:0px;" onclick="maximizeMap()"> <img src="./assets/images/maximize2.svg" style="height:16px;width:16px" /> </button>',
            },
          ],
          onClick: function (event) {
            if (event.target == "map-type:regular-map") {
              getHeatMap().setMap(null);
              setMapOnAll(map);
            } 
            else if (event.target == "map-type:heat-map") {
              getHeatMap().setMap(map);
              setMapOnAll(null);
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
}

function restoreMap()
{
  w2ui.layout.show("main", true)
  w2ui.layout.get("bottom").size = '50%'
  w2ui.layout.show("bottom", true)
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
  // sessionStorage.setItem("base_dim", base_dim)
  // sessionStorage.setItem("dim_filters", dim_filters)
  // sessionStorage.setItem("val_filters", val_filters)
  coords=[]
  let center_lat=0
  let center_lng=0
  let sel=w2ui.grid.getSelection()
  if (sel.length==0)
    return

  let max_lat = -999, max_lng = -999
  let min_lat =  999, min_lng =  999

  for (let rec_id of sel){
    let rec=w2ui.grid.get(rec_id)
    let lat=rec.latitude/1e6
    let lng=rec.longitude/1e6
   
    max_lat = (lat>max_lat)? lat : max_lat
    max_lng = (lng>max_lng)? lng : max_lng

    min_lat = (lat<min_lat)? lat : min_lat
    min_lng = (lng<min_lng)? lng : min_lng
  
    coords.push({lat:lat,lng:lng})
  }
  center_lat = (max_lat + min_lat)/2
  center_lng = (max_lng + min_lng)/2
 
  bounds = { max_lat: max_lat, min_lat: min_lat, 
                 max_lng: max_lng, min_lng: min_lng}

  map_center=[center_lat, center_lng]
  
  showMap()
}

function showMap(){
  if (map==null) {
  map = new google.maps.Map(document.getElementById("map"), {
    fullscreenControl: false,
    zoom: 8,
    center: { lat: map_center[0], lng: map_center[1] },
  });
  }
  else {
    map.setCenter({ lat: map_center[0], lng: map_center[1] })
    map.setZoom(8)
  }
  deleteMarkers()
  if (heatmap)
  {
     heatmap.setMap(null)
     heatmap = null    
  }
  var map_type = w2ui.layout.get('bottom').toolbar.get('map-type').selected

  if (map_type == "regular-map")
  {
    setMarkers(map);
  }
  else if (map_type == 'heat-map')
  {
    setMarkers(null)
    initHeatMap(map);
  }
  //w2ui.layout.get('bottom').size = '50%'
  w2ui.layout.show('bottom', true)
}


// Adds a marker to the map and push to the array.
function addMarker(location, map) 
{
  const marker = new google.maps.Marker({
    position: location,
    map: map,
  });
  markers.push(marker);
}

// Sets the map on all markers in the array.
function setMapOnAll(map) {
  for (let marker of markers) {
    marker.setMap(map);
  }
}

// Removes the markers from the map, but keeps them in the array.
function clearMarkers() {
  setMapOnAll(null);
}

// Shows any markers currently in the array.
function showMarkers() {
  setMapOnAll(map);
}

// Deletes all markers in the array by removing references to them.
function deleteMarkers() {
  clearMarkers();
  markers = [];
}

function setMarkers(map) {
  for (let coord of coords) 
    addMarker(coord, map)
}

function initHeatMap(map)
{
  let data = []
  for (let c of coords)
    data.push( new google.maps.LatLng(c) );

  heatmap = new google.maps.visualization.HeatmapLayer({
    data: data,
    map: map,
  });

}

function getHeatMap()
{
 if (heatmap == null)
    initHeatMap(map);

 return heatmap;
}

function changeRadius() {
  getHeatMap().set("radius", getHeatMap().get("radius") ? null : 20);
}

function changeOpacity() {
  getHeatMap().set("opacity", getHeatMap().get("opacity") ? null : 0.2);
}
function changeGradient() {
  const gradient = [
    "rgba(0, 255, 255, 0)",
    "rgba(0, 255, 255, 1)",
    "rgba(0, 191, 255, 1)",
    "rgba(0, 127, 255, 1)",
    "rgba(0, 63, 255, 1)",
    "rgba(0, 0, 255, 1)",
    "rgba(0, 0, 223, 1)",
    "rgba(0, 0, 191, 1)",
    "rgba(0, 0, 159, 1)",
    "rgba(0, 0, 127, 1)",
    "rgba(63, 0, 91, 1)",
    "rgba(127, 0, 63, 1)",
    "rgba(191, 0, 31, 1)",
    "rgba(255, 0, 0, 1)",
  ];
  getHeatMap().set("gradient", getHeatMap().get("gradient") ? null : gradient);
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
    params.dim_filters = dim_filters
  
  if (val_filters.length > 0)
    params.val_filters = val_filters
   
  serverRequest(params).then(processResp);

} //initPage




$(document).ready(InitPage);