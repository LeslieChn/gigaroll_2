async function serverRequest(params) {
  p = new URLSearchParams(params).toString();

  const api_url = `gserver/${p}`;

  var request = new Request(api_url, { method: "POST" });

  const response = await fetch(request);
  const json = await response.json();

  return json;
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
  for (let col of headers){
    columns.push({field:col, text:col, sortable:true})
    searches.push({field:col, text:col, label:col, type:"text"})
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
          img:'fa fa-map-location-dot', onClick: launchMap}
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
    event.onComplete = function()
    {
      if (this.getSelection().length == 0)
        this.toolbar.disable('launch-map');
    }
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
  var coords=[]
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
  
    coords.push([lat,lng])
  }
  center_lat = (max_lat + min_lat)/2
  center_lng = (max_lng + min_lng)/2
 
  sessionStorage.setItem('coordinates', JSON.stringify(coords))
  sessionStorage.setItem('map_center', JSON.stringify([center_lat, center_lng]))
  window.open('./map.html', '_blank');
}


async function InitPage() {
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
   
  /*
  $('#grid').w2grid({
      name : 'grid',  
      show: {
        toolbar: true,
        footer: true
      },
      multiSearch: true,
  })
  */

  serverRequest(params).then(processResp);

} //initPage




$(document).ready(InitPage);