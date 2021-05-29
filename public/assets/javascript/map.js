var map = null;
var heat_map = null;
var markers = [];
var coords = []; // array of Google map points


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




/*******************************************************/
function initMap() {
  let center = getMapCenter()
  initMapCoordinates();

  map = new google.maps.Map(document.getElementById("map"), {
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


$("#map-type-dd").on("change", function () {
  let map_type = $("#map-type-dd").val()
  if (map_type == "regular_map")
  {
    heatmap.setMap(null);
    setMapOnAll(map)
  }
  else if (map_type == "heat_map")
  {
    heatmap.setMap(map);
    setMapOnAll(null)  
  }

});
