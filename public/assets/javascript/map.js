var map = null;
var heat_map = null;
var markers = [];
var coords = []; // array of Google map points

$(function () {    
  var pstyle = 'border: 1px solid #dfdfdf; padding: 5px;';
  $('#layout').w2layout({
      name: 'layout',
      panels: [
          { type: 'top', size: 50, resizable: true, style: pstyle, content: 'top' },
          { type: 'left', size: 200, resizable: true, style: pstyle, content: 'left' },
          { type: 'main', style: pstyle, content:'<div id="map"></div>'},
          { type: 'preview', size: '50%', resizable: true, hidden: true, style: pstyle, content: 'preview' },
          { type: 'right', size: 200, resizable: true, hidden: true, style: pstyle, content: 'right' },
          { type: 'bottom', size: 50, resizable: true, hidden: true, style: pstyle, content: 'bottom' }
      ]
  });
  let center = getMapCenter()
  map = new google.maps.Map(document.getElementById("map"), {
    fullscreenControl: false,


    zoom: 8,
    center: { lat: center[0], lng: center[1] },
  });
});


function initMapCoordinates(){
  let c = JSON.parse(sessionStorage.getItem('coordinates'))
  coords = []
  //convert to Google format
  for (let e of c)
  {
    coords.push({lat: e[0], lng:e[1]})
  }
}

function getMapCenter(){
  return JSON.parse(sessionStorage.getItem('map_center'))
}

// Adds a marker to the map and push to the array.
function addMarker(location) {
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

function initToolbar() {
  $('#toolbar').w2toolbar({
      name: 'toolbar',
      style   : 'padding: 2px; border-bottom: 3px solid #9f9faf;'+
      'background: linear-gradient(to bottom, #f0f2f4 0%,#e5e7e9 36%,#ccd6dc 100%);' +
      'font-weight:bold; font-size: 1.875em;',
      items: [
        {type: 'html', 
        html: '<div style="padding:2px;border:2px inset #ccd6dc; border-bottom:2px inset #f0f2f4;border-radius: 3px">'+
         '<img src="./assets/images/logo2.png" style="height:40px;"/>'+
        '<img src="./assets/images/logo-text.png" style="height:30px"/>' +
        '</div>'},
        {type: 'html', html: '<pre>   </pre>'},
        { type: 'menu-radio', id: 'map-type',
        text: function (item) {
            var text = item.selected;
            var el   = this.get('map-type:' + item.selected);
            return el.text;
        },
        selected: 'regular-map',
        items: [
            {id: 'regular-map', text: 'Regular Map'},
            {id: 'heat-map', text: 'Heat Map'},
        ]
        },
          { type: 'break' },
          { type: 'button', id: 'item3', text: 'Change Gradient', onClick:changeGradient},
          {type: 'html', html: '<pre> </pre>'},
          { type: 'button', id: 'item4', text: 'Change Radius', onClick:changeRadius},
          {type: 'html', html: '<pre> </pre>'},
          { type: 'button', id: 'item5', text: 'Change Opacity', onClick:changeOpacity},
          { type: 'break' },
          { type: 'button', id: 'item6', text: 'Display Rectangle', onClick:displayRect},
          {type: 'html', html: '<pre> </pre>'},
          { type: 'button', id: 'item7', text: 'Find Points',  onClick:findPoints}
      ],
      onClick:function (event){
        if (event.target=="map-type:regular-map"){
          heatmap.setMap(null);
          setMapOnAll(map)
        }
        else if (event.target=="map-type:heat-map"){
          heatmap.setMap(map);
          setMapOnAll(null)  
        }
      }
  });
};


/*******************************************************/
function initMap() {
  initToolbar()
  let center = getMapCenter()
  initMapCoordinates();
  return
  map = new google.maps.Map(document.getElementById("map"), {
    // mapTypeControl: true,
    // mapTypeControlOptions: {
    //   style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
    //   position: google.maps.ControlPosition.LEFT_CENTER,
    // },
    // zoomControl: true,
    // zoomControlOptions: {
    //   position: google.maps.ControlPosition.RIGHT_BOTTOM,
    // },
    // scaleControl: false,
    // streetViewControl: true,
    // streetViewControlOptions: {
    //   position: google.maps.ControlPosition.RIGHT_CENTER,
    // },
    fullscreenControl: false,


    zoom: 8,
    center: { lat: center[0], lng: center[1] },
  });
  setMarkers(map);
  initHeatMap(null);
}

function setMarkers(map) {
  for (let coord of coords) 
    addMarker(coord)
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
function changeRadius() {
  heatmap.set("radius", heatmap.get("radius") ? null : 20);
}

function changeOpacity() {
  heatmap.set("opacity", heatmap.get("opacity") ? null : 0.2);
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
  heatmap.set("gradient", heatmap.get("gradient") ? null : gradient);
}
var rect = null;
function displayRect()
{
  let b = JSON.parse( sessionStorage.getItem('bounds') );
  if (rect == null)
  {
  rect = new google.maps.Rectangle({
    strokeColor: "#FF0000",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "#FF0000",
    fillOpacity: 0.35,
    map:null,
    bounds: {
      north: b.max_lat,
      south: b.min_lat,
      east: b.max_lng,
      west: b.min_lng,
    },
    editable: true,
    draggable: true
  });
}
if (rect.getMap() == null)
  rect.setMap(map);
else
  rect.setMap(null);
}

function findPoints()
{
  if (rect == null)
    return;

  let bounds = rect.getBounds();
  
  let n_points = 0;
  for (c of coords)
  {
    let contains = bounds.contains(c)
    if (contains)
      ++n_points;
  }
  alert("Found " + n_points + " points")
}

