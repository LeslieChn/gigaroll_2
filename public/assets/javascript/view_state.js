/*

state.id = unique id to identify instance of vs

state.viewtype = one of the following:
 grid, bar-chart, line-chart, scatter-chart, treemap, d3map, googlemap

state.groupbys = [dimensions]

state.measures = [measures]

state.dimfilters = [dimension members]

state.valfilters = [value member inequalities]

state.tile_config = {header: , subheader: , body: , parentdiv: }

   <div class="col-lg-6">
      <div class="card z-index-2">
        <div class="card-header pb-0">
          <h6>header</h6>
          <p class="text-sm">
            <i class="fa fa-arrow-up text-success"></i>
            <span class="font-weight-bold">subheader</span> in 2021
          </p>
        </div>
        <div class="card-body p-3">
          <div class="chart">
            <canvas id="chart-line" class="chart-canvas" height="300"></canvas>
          </div>
        </div>
      </div>
    </div>

<div class="dropdown pe-4">
              <button class="btn btn-secondary btn-sm dropdown-toggle" type="button" id="dropdownMenu2" data-bs-toggle="dropdown" aria-expanded="false">
                Dropdown
              </button>
              <ul class="dropdown-menu" aria-labelledby="dropdownMenu2">
                <li><button class="dropdown-item" type="button">Action</button></li>
                <li><button class="dropdown-item" type="button">Another action</button></li>
                <li><button class="dropdown-item" type="button">Something else here</button></li>
              </ul>
            </div>

 */
/*******************************************************************************/
//Global Vars

const ps_object = {}
var knob_objects = {}
var vs_knob = null
var selected_vs=null
const html_sub = {
  '<': "&lt",
  '>': "&gt",
};
const popup_width = 300
/*******************************************************************************/

function Comma_Sep(a,vs_id) {
  var s = "";
  for (let i = 0; i < a.length; i++) {
    let item=a[i]
    if(item.startsWith('?')){
      let dd_id=item.slice(1)
      s+=$(`#${dd_id}-${vs_id}`).val()
    }
    else
      s += item;

    if (i < a.length - 1) 
      s += ",";
  }

  return s;
}

function chartColorGradient(canvas, bg_color)
{
  let ctx = canvas.getContext("2d");
  let gradientStroke = ctx.createLinearGradient(0, canvas.scrollHeight, 0, 50);
  gradientStroke.addColorStop(1, hexToRGB(bg_color, 0.2));
  gradientStroke.addColorStop(0.2, 'rgba(72,72,176,0.0)');
  gradientStroke.addColorStop(0, hexToRGB(bg_color, 0));
  return gradientStroke
}

function reqParamsToString(params)
{
    let s = ''
    for (let [key,val] of Object.entries(params))
    {
      s += `${key}=${val}&`
    }
    return s
}
  
async function serverRequest(params) 
{
    p = reqParamsToString(params)

    const api_url = `gserver/${p}`;

    var request = new Request(api_url, { method: "POST" });

    // var request = new Request(`http://127.0.0.1:55555/req?${p}`, { method: "GET" });

    const response = await fetch(request);
    const json = await response.json();

    return json;
}

function getDataColumn (server_js, col_idx){
  var data_col=[]
  for (let row of server_js){
    data_col.push(row[1][col_idx])
  }
  return data_col
}

function hexToRGB(hex, alpha) {
  var r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);

  if (alpha!==undefined) {
      let rgba=`rgba(${r},${g},${b},${alpha})`
      return `rgba(${r},${g},${b},${alpha})`;
  } else {
      return `rgba(${r},${g},${b})`;
  }
}

function zoomed()
{
    g.style("stroke-width", 1.5 / d3.event.transform.k + "px");
    // g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")"); // not in d3 v4
    g.attr("transform", d3.event.transform); // updated for d3 v4
}

function stopped()
{
    if (d3.event.defaultPrevented) d3.event.stopPropagation();
}
function reset()
{
    active.classed("active", false);
    active = d3.select(null);

    svg.transition()
        .duration(750)
        // .call( zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1) ); // not in d3 v4
        // .call(zoom.transform, d3.zoomIdentity); // updated for d3 v4
}
function getKnob(id)
{
  if (id=='view-knob')
    return vs_knob
  else
    return knob_objects[`${id}`]
}
/*******************************************************************************/
class View_State 
{
  constructor(state)
  {
    this.state=state
    this.obj_instance=null
    this.server_js=null
    this.maximized=false
  }
  createRequestParams()
  { 
    let req=this.state.request
    let vs_id=this.getId()
    let params =  {
      qid: req.qid,
      dim: req.base_dim
    };

    if ('groupbys' in req)
      params.gby = Comma_Sep(req.groupbys, vs_id)
     
    if ('measures' in req)
      params.val = Comma_Sep(req.measures, vs_id)

    if ('dim_filters' in req)
    params.dim_filters = encodeURI(Comma_Sep(req.dim_filters, vs_id))

    
    if ('val_filters' in req)
      params.val_filters = encodeURI(Comma_Sep(req.val_filters, vs_id))

    return params
  }
  async serverRequest()
  {
    let params=this.createRequestParams();
    let server_result = await serverRequest(params);
    if (params.qid == "MD_RETR")
    {
      this.server_js = server_result
      return
    }
    let server_meta=server_result["meta"];

    if (server_meta.status != "OK"){
      alert("The data server returned "+ server_meta.status)
      return
    }
    this.server_js = server_result["data"]
    // if (server_meta.is_range)
    //   server_range = server_result.range;
  }
  getId()
  {
    return this.state.id
  }
  getViewType()
  {
    return this.state.view_type
  }
  getHeight()
  {
    return this.state.tile_config.height
  }
  getWidth()
  {
    return this.state.tile_config.width
  }
  hide()
  {
    $(`#${this.getId()}-box`).hide()
  }
  show()
  {
    $(`#${this.getId()}-box`).show()
  }

  alias(name)
  {
    let aliased_name = name
    if (('aliases' in this.state) && (name in this.state.aliases))
    {
      aliased_name=this.state.aliases[name]
    }
    return aliased_name.replace(/(<|>)/g, matched => html_sub[matched]);
  }

  itemSubstitute(a_in, vs_id) 
  {
    var a_out = [];
    for (let i = 0; i < a_in.length; i++)
     {
      let item=a_in[i]
      if(item.startsWith('?'))
      {
        let dd_id=item.slice(1)
        item = $(`#${dd_id}-${vs_id}`).val()
      }
      a_out.push(this.alias(item));
    }
  
    return a_out;
  }

  maximize()
  {
    $('.content').height('65vh')
    $(`#${this.getId()}-box`).attr('class', 'col-lg-12')
    this.maximized=true
    $(`#${this.getId()}-card`).attr('data-maximized', true)
    $('.content').height('65vh')
    this.refresh()
  }
  restore()
  {
    let id=this.getId()
    this.maximized=false
    $(`#${this.getId()}-card`).attr('data-maximized', false)
    $(`#${id}-box`).attr('class', `col-lg-${this.getWidth()} mt-4`)
    $('.content').height(this.getHeight())
    if (this.state.view_type=='chart')
    {
      $(`#${this.getId()}`).height(this.getHeight())
    }
    this.show()
  }
  refresh()
  {
    let type=this.state.view_type
    let vs_id=this.getId()
    switch(type)
    {
      case 'grid':
        w2ui[vs_id].refresh()
        ps_object[vs_id].destroy()
        const ps = new PerfectScrollbar(`#grid_${vs_id}_records`, {
          wheelSpeed: 2,
          wheelPropagation: false,
          minScrollbarLength: 20
        })
        ps_object[vs_id]=ps
        break
      case 'chart':
        let canvas = document.getElementById(`${vs_id}-canvas`);
        let this_chart = this.object_instance;
        this_chart.data.datasets.forEach((dataset, i) => {
          let chart_def = this.state.chart_def[i];
          let bg_color = chart_def.backgroundColor;
          dataset.backgroundColor = chart_def.type == 'line' ? chartColorGradient(canvas, bg_color) : bg_color
        });
        this_chart.update()
        break
      case 'geomap':
        this.autoZoom()
        break
      case 'treemap':
      case 'countymap':
      case 'scatterChart':
        this.createContent()
        break
    }
  }
  createDropdownList(contents)
  {
    let list=''
    for (let i = 0; i<contents.length; ++i)
    {
      let item = contents[i]
      list += `<option ${i==0?'selected':''} value="${item}">${this.alias(item)}</option>`
    }
    return list
  }
  createControls()
  {
    $('.dropdown-column').remove()
    $('.knob-column').remove()
    if ('dropdowns' in this.state == false)
      return ''
    for (const [id, instance] of Object.entries(knob_objects))
    {
      instance.removeEventListeners()
    }
    knob_objects={}
    let dropdowns=this.state.dropdowns
    for (const [id, def] of Object.entries(dropdowns))
    {
      let top_controls=$(`#top-controls`)
      let bottom_controls=$(`#bottom-controls`)
      let client_width = document.documentElement.clientWidth
      let client_height = document.documentElement.clientHeight
      let size = Math.min(client_width, client_height)
      let knob_height = 100
      let knob_width = 100
      if (size < 700)
      {
        knob_height=75
        knob_width=75
      }
      let position='position' in def? def.position:'bottom-right'

      let dropdown_html = `<div id=${id}-${this.getId()}-column 
        class="${position=='top-left'?' col-4 mt-sm-3 mt-1':'col-2 mt-sm-3 mt-1'} 
        px-sm-3 text-center m${position=='bottom-right'?'s-sm-auto pe-1':'e-sm-auto ps-1'} dropdown-column">
        <h6 class="mb-1 text-white">${def.name}</h6>
        <select id=${id}-${this.getId()} class="form-select form-select-sm controls-select pt-0" 
        data-tile-id="${this.getId()}" 
        data-knob='${id}-${this.getId()}-knob' aria-label=".form-select-sm example">
        ${this.createDropdownList(def.contents)}
        </select></div>`

      let knob_html=`<div class="${position=='top-left'?'col-2 mt-1':'col-1 mt-sm-2 mt-1'} 
        ${position=='bottom-right'?'me-sm-0':'ms-sm-0 '}
        d-flex justify-content-center px-0 knob-column">
        <input id='${id}-${this.getId()}-knob' class='p1' type="range" min="0" max="10" 
        data-dropdown=${id}-${this.getId()} data-width="${knob_width}" data-height="${knob_height}" 
        data-angleOffset="220" data-angleRange="280"></div>`

      if(position=='bottom-left')
      {
        let bl_controls=knob_html+dropdown_html
        bottom_controls.prepend(bl_controls)
      }
      else if(position=='top-left')
      {
        let tl_controls=knob_html+dropdown_html
        top_controls.prepend(tl_controls)
      }
      else
      {
        let br_controls=dropdown_html+knob_html
        bottom_controls.append(br_controls)
      }
      let input=document.getElementById(`${id}-${this.getId()}-knob`)
      input.dataset.labels = (def.contents).map(()=>'.')
      input.value =  $(`#${id}-${this.getId()}`).prop('selectedIndex');
      // console.log('input value:'+ input.value)
      knob_objects[`${id}-${this.getId()}-knob`]=new Knob(input, new Ui.P1({}))
    }
  }
  createTile()
  {
    let cfg=this.state.tile_config
    let types = this.state.view_types
    for (const [id, instance] of Object.entries(knob_objects))
    {
      instance.removeEventListeners()
    }
    $(cfg.parent_div).empty()
    $(cfg.parent_div).html(`<div id="${this.getId()}-box" class="col-lg-${cfg.width} mx-auto">
      <div id="${this.getId()}-card" class="card z-index-2" data-maximized="false">
        <div class="card-body p-1">
          <div id="${this.getId()}" class="content" style="width:100%; height:${cfg.height};">
          </div>
        </div>
      </div>
      <div id="bottom-controls" class="row justify-content-between"> 
        
      </div>
     </div>`);
     this.createControls()
     this.createContent()
  }
  getColorScheme()
  {
    var color_schemes = {"red": [d3.interpolateYlOrRd, "black"],
                        "blue": [d3.interpolateBlues, "black"],
                        "green": [d3.interpolateYlGn, "black"],
                        "grey": [d3.interpolateGreys, "wheat"]}

    let color_scheme = this.state.color_scheme
    let color = ""
    if(color_scheme.startsWith('?'))
    {
      let dd_id = color_scheme.slice(1)
      color = $(`#${dd_id}-${this.getId()}`).val()
    }
    else
    {
      color = color_scheme
    }
    return color_schemes[color]
  }
  createContent()
  {
    try
    {
      this[this.state.view_type]()
    }
    catch (e)
    {
      console.log(e)
    }
  }

   text()
   {
    $(`#${this.getId()}`).append(`<h5 class="font-weight-bolder">Gigaroll Dashboard</h5><p class="text-lg">${this.state.text}</p>`)
   }

   autoZoom()
   {
     function callback(instance)
     { 
      instance.object_instance.invalidateSize()
      instance.object_instance.fitBounds(instance.bounds)
     }
     $(this.getId()).ready( callback.bind(null, this));
   }

   propInfoFormat(data) 
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
   async propertyPopup (node, x, y)
   {
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
        <div class="col-11" id="mly">
          <div id="pop-img-box" style="width:250px; height:200px;">
            <img id="pop_img" style="width:100%; height:100%; object-fit: contain;" class="img" alt="..." src="assets/images/loading.gif">
          </div>
        </div>
        <div class="col-1">
          <button type="button" class="btn-close" aria-label="Close" onclick="hideMapTooltip()"></button>
          </div>
        </div>
      <div class="row">
        <div class="col-12 px-2 d-flex align-items-center justify-content-center">
        <p style="font-size:0.75em; color:black; font-weight:bold;">${node[0]}<br>${node[1].replaceAll('-',', ')}, ${node[2]}</p>
        </div>
      </div>

      <div id="popup-info" class="row px-4 d-flex" style="height:200px;">
        <div id="carouselExampleControls" class="carousel carousel-dark slide" data-bs-ride="carousel" data-interval="false">
          <div class="carousel-inner px-3">
            <div class="carousel-item active">
              <table class="popup-table">
                <tr><td>Property type:</td> <td>&nbsp</td> <td><b>${node[5]}</b></td></tr>
                <tr><td>Bedrooms:</td> <td>&nbsp</td><td><b> ${node[7]}</b></td></tr>
                <tr><td>Bathrooms:</td> <td>&nbsp</td><td> <b>${node[8]}</b></td></tr>
                <tr><td>Size:</td> <td>&nbsp</td> <td><b>${node[9]} sqft</b></td></tr>
                <tr><td>Price:</td>  <td>&nbsp</td> <td><b>$${node[10].toLocaleString("en")}</b></td></tr>
                <tr><td>Year built:</td> <td>&nbsp</td> <td><b>${node[11]}</b></td></tr>
                <tr><td>Elevation:</td> <td>&nbsp</td> <td><b>${node[14]}</b></td></tr>
              </table>
            </div>
            <div class="carousel-item">
              ${this.propInfoFormat(prop_info_data.state_code)}
            </div>
            <div class="carousel-item">
              ${this.propInfoFormat(prop_info_data.county)}
            </div>
            <div class="carousel-item">
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
        <a style="margin: 0px 6px 12px 0px; background-color: rgb(155, 0, 31);" target="_blank" class="btn col-5 text-nowrap text-white" href="https://www.zillow.com/homes/${node[0]},${node[1].replaceAll('-',', ')}, ${node[2]}_rb">Zillow</a>
        <a style="margin: 0px 0px 12px 6px; background-color: rgb(155, 0, 31);" target="_blank" class="btn col-5 text-nowrap text-white" href="https://www.google.com/maps/search/${node[12]},${node[13]}">Google</a>
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

      const popup_ps = new PerfectScrollbar(`#popup-info`, {
        wheelSpeed: 2,
        wheelPropagation: false,
        minScrollbarLength: 20
      })

      ps_object['popup-info']=popup_ps

      let position = $(`#${this.getId()}`).offset()
      let screen_width = window.innerWidth
      let screen_height = window.innerHeight
      let popup_width = $('#prop-popup').outerWidth()
      let popup_height = $('#prop-popup').outerHeight()
      const offset = 20
      x += offset
      let right_edge = x + popup_width + position.left
      let bottom_edge = y + popup_height + position.top 
      console.log(y)
      console.log(bottom_edge + '= bottom_edge')
      if (right_edge >= screen_width)
        x = Math.max(x - popup_width - 2 * offset, 0)
      if (bottom_edge >= screen_height)
        y = Math.max(y - popup_height, -position.top/2)
      
      d3.select("#prop-popup").style("opacity", 1)
      .style("left", x + "px")
      .style("top", y + "px")
      .style("z-index", 999)
      
  }

   async geomap()
   {
      this.propDiv = d3.select('.card-body').append("div")
      .attr("class", "container")
      .attr("id", "prop-popup")
      .style("opacity", 0)
      .style("width", `${popup_width}px`)

     await this.serverRequest()

     if (selected_vs && this!==selected_vs)
     {
      return 
     } 
    
     if (this.object_instance && this.object_instance.remove)
     {
       console.log("instance is:", this.object_instance)
       this.object_instance.off()
       this.object_instance.remove()
       console.log("instance is removed:", this.object_instance)
     }
 
     let server_js=this.server_js
     let coords = []
     let lat, lng, markers;
     let markerColor = "red"
     var boostType = "balloon"
     let max_lat = -999, max_lng = -999
     let min_lat =  999, min_lng =  999
     let data_index = 0
     for (const data of server_js.data)
     {
       lat = parseInt(data[12]) /1e6
       lng = parseInt(data[13]) /1e6
       max_lat = (lat>max_lat)? lat : max_lat
       max_lng = (lng>max_lng)? lng : max_lng
       min_lat = (lat<min_lat)? lat : min_lat
       min_lng = (lng<min_lng)? lng : min_lng
       data[12] = lat
       data[13] = lng
       coords.push([lat,lng,data_index++])
     }
     this.numcoords = coords.length
     if (!this.bounds)
     {
      this.bounds = L.bounds(L.point(44.99034, -71.809849), L.point(38.930933, 79.759346))
     }
     
     if (this.numcoords != 0)
     {
      let minPoint = L.latLng(min_lat,min_lng)
      let maxPoint = L.latLng(max_lat,max_lng)
      this.bounds = L.latLngBounds(minPoint,maxPoint)
     }     
 
     try
     { 
      var streets = L.tileLayer('https://api.maptiler.com/maps/basic/{z}/{x}/{y}@2x.png?key=vgYeUXLEg9nfjeVPRVwr', {id: 'simple_map', tileSize: 1024, zoomOffset: -2, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'}),
      satellite   = L.tileLayer('https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}@2x.jpg?key=vgYeUXLEg9nfjeVPRVwr', {id: 'satellite', tileSize: 1024, zoomOffset: -2, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>'});
      var baseMaps = {
        "Streets": streets,
        "Satellite": satellite
      };
      var osMap = L.map(this.getId(), 
       {preferCanvas: true,
        minZoom: 1,
        maxZoom: 16,
        layers: [streets]
       });
       this.object_instance = osMap
     }
     catch(e)
     {
       console.log(e)
     }
     setMarkers(this)
     this.autoZoom()
     var bounds = this.bounds
     L.control.layers(baseMaps).addTo(osMap);
     L.easyButton( 'fa-undo', function(){
      osMap.fitBounds(bounds);
      }).addTo(osMap);

    osMap.on('popupopen', function(e) {
        var px = osMap.project(e.target._popup._latlng); 
        px.y -= e.target._popup._container.clientHeight/2; 
        osMap.panTo(osMap.unproject(px),{animate: true});
    });
    
     function setMarkers(instance) 
     {
       if (markers)
         osMap.removeLayer(markers)
       markers = L.featureGroup()
       for (let coord of coords) {
         L.circleMarker([coord[0],coord[1]], {
             fillColor: markerColor,
             fillOpacity: 1,
             stroke: true,
             color: 'white',
             weight: 1,
             boostType: boostType,
             boostScale: 1,
             boostExp: 0,
             radius: 6
         })
         .addTo(markers)
        //  .bindPopup("Loading element data, please wait...")
         .on('click', onMapClick.bind(null, instance));
         markers.addTo(osMap);

         async function onMapClick(instance,e)
         {
          let position = $(`#${instance.getId()}`).offset()
          let x = e.originalEvent.x - position.left
          let y = e.originalEvent.y - position.top
          let node = instance.server_js.data[coord[2]]
          instance.propertyPopup(node, x, y)
        }
      }
     
     }
 
   }
  async grid()
  {

    await this.serverRequest()

    if (selected_vs && this!==selected_vs)
    {
      return 
    } 

    let req=this.state.request
    let vs_id=this.getId()

    let gby_headers = this.itemSubstitute(req.groupbys, vs_id)
    let val_headers = this.itemSubstitute(req.measures, vs_id)

    let server_js=this.server_js

    let columns=[]

    for (let col of gby_headers)
    {
      // let col_name=col.startsWith('?')?$(`#${col.slice(1)}`).val():col
      columns.push({field:col, text:col, attr:col, sortable:true})
      // searches.push({field:col, text:col, label:col, type:"text"})
    }

    for (let col of val_headers)
    {
      columns.push({field:col, text:col, sortable:true})
      // searches.push({field:col, text:col, label:col, type:"float"})
    }

    let count=1
    let records=[]

    for (let row of server_js)
    {
      let rec={recid:count++}
      let n_gbys=gby_headers.length
      for (let i=0; i<n_gbys; i++)
      {
        rec [gby_headers[i]]=row[0][i]
      }
      for (let i=0; i<val_headers.length; i++){
        rec[val_headers[i]]=row[1][i]
      }
      records.push(rec)
    }

    try
    {
      try
      {
        w2ui[this.getId()].destroy()
      }
      catch(e)
      {}
      this.object_instance=$(`#${this.getId()}`).w2grid( 
        {
          name: this.getId(),
          columns: columns,
          records: records,
          show: {
            toolbar: false,
            footer: true
          }
          // searches: searches,
        }
      );
      if(this.getId() in ps_object)
      {
        ps_object[this.getId()].destroy()
      }
      const ps = new PerfectScrollbar(`#grid_${this.getId()}_records`, {
        wheelSpeed: 2,
        wheelPropagation: false,
        minScrollbarLength: 20
      })
      ps_object[this.getId()]=ps
    }
    catch(e)
    {
      console.log(e)
    }
  }
  // chart()
  // {
  //   try{
  //     this[this.state.view_subtype]()
  //   }
  //   catch (e){

  //   }
  // }
  async chart()
  {
    await this.serverRequest()

    if (this.object_instance)
    {
      this.object_instance.destroy()
    }

    if (selected_vs && this!==selected_vs)
    {
      return 
    } 

    let cfg=this.state.tile_config
    
    $(`#${this.getId()}`).html(`<canvas id="${this.getId()}-canvas" style="width:100%; height:${cfg.height};">
    </canvas>`)

    let req=this.state.request
    let vs_id=this.getId()

    let val_headers = this.itemSubstitute(req.measures, vs_id)

    let server_js=this.server_js

    let canvas = document.getElementById(`${vs_id}-canvas`);

    let ctx = canvas.getContext("2d");

    let labels=[]

    for (let row of this.server_js){
      labels.push(row[0][0])
      //to do: handle multiple group bys
    }

    let ds = []

    for (let i=0, n=val_headers.length; i<n; ++i) 
    { 
      let chart_def = this.state.chart_def[i];
      let bg_color = chart_def.backgroundColor;
      let data = getDataColumn(server_js, i);
      let d = {
        label: val_headers[i],
        data: data,
        yAxisID: chart_def.yAxisID,
        type: chart_def.type,
        tension: 0.4,
        borderWidth: 0,
        pointRadius: 0,
        borderColor: chart_def.borderColor,
        borderWidth: 3,
        backgroundColor: chart_def.type=='line' ? chartColorGradient(canvas, bg_color) : bg_color,
        fill: true
      }
      ds.push(d)
    }

    this.object_instance = new Chart(ctx, {
      data: {
        labels: labels,
        datasets: ds,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
          }
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
        scales: {
          x: {
            grid: {
              drawBorder: true,
              display: true,
              drawOnChartArea: true,
              drawTicks: true,
              borderDash: [5, 5],
              tickColor:'black'
            },
            ticks: {
              display: true,
              color: '#656164',
              padding: 20,
              font: {
                size: 11,
                family: "Open Sans",
                style: 'normal',
                lineHeight: 2
              },
            }
          },
        },
      },
    });
  }
  async setupColors(min_data, max_data)
  {
    this.point_colors = null;

    let colors = []
    let num_colors = 20
    for (let i = 0; i <= num_colors; ++i)
      colors.push(d3.interpolateYlOrRd(i/num_colors));
  
    let domain = []
    if (min_data <= 0 && max_data <= 0)
    {
      let m1 = (min_data == 0) ? -1 : min_data;
      let m2 = (max_data == 0) ? -1 : max_data;
      let r = (m2/m1)**(1/num_colors)
  
      for (let x = m1; x <= m2; x *= r)
        domain.push(x)
    }
    else if (min_data >= 0 && max_data >= 0)
    {
      let m1 = (min_data == 0) ? 1 : min_data;
      let m2 = (max_data == 0) ? 1 : max_data;
      let r = (m2/m1)**(1/num_colors)
  
      for (let x = m1; x <= m2; x *= r)
        domain.push(x)
    }
    else
    {
      domain.push(min_data)
      let r = (max_data)**(1/(num_colors-1))
  
      for (let x = 1; x <= max_data; x *= r)
        domain.push(x)
    }
  
      this.point_colors = d3.scaleThreshold()
        .domain(domain)
       .range(colors);
  }


  async scatterChart()
  {
    if(!this.toolTipDiv)
    {
      this.tooltipDiv = d3.select(`.card-body`).append("div")
      .attr("class", "scatterTooltip")
      .style("opacity", 0)
    }

    if(this.propDiv)
    { 
      d3.select('#prop-popup').remove()
    }

    this.propDiv = d3.select(".card-body").append("div")
    .attr("class", "container")
    .attr("id", "prop-popup")
    .style("opacity", 0)
    .style("width", "300px")

    await this.serverRequest()

    if (this.object_instance)
    {
      this.object_instance.destroy()
    }

    if (selected_vs && this!==selected_vs)
    {
      return 
    } 

    let vs_id=this.getId()

    let server_js = this.server_js

    let n_vals = 2
    let meas1 = Comma_Sep([this.state.x_axis], vs_id),
        meas2 = Comma_Sep([this.state.y_axis], vs_id),
        meas3 = Comma_Sep([this.state.z_axis], vs_id);
    if (meas3 != '')
      n_vals = 3
    let i1 = server_js.headers.indexOf(meas1),
        i2 = server_js.headers.indexOf(meas2),
        i3 = server_js.headers.indexOf(meas3),
        max_val = -Infinity, min_val = Infinity,

        chart_width = $(`#${this.getId()}`).width(),
        chart_height = $(`#${this.getId()}`).height(),
        margin = {top: chart_height*0.05, right: chart_width*0.05, bottom: chart_height*0.1, left: chart_width*0.1},
        width = chart_width - margin.left - margin.right,
        height = chart_height - margin.top - margin.bottom,
        points=[],
        pointRadius = 4,
        point_index = 0;

    for (let row of server_js.data)
    {
      let x=row[i1]
      let y=row[i2]
      points.push({ x:x,
                    y:y,
                    i:point_index++,
                    selected: false})

      if (n_vals >= 3)
      {
        let val = row[i3]
        if (max_val < val) max_val = val
        if (min_val > val) min_val = val
      }
    };

    var quadTree = d3.quadtree()
    .x(function(d) {
        return d.x
    })
    .y(function(d) {
        return d.y
    }).addAll(points);

    var randomIndex = _.sampleSize(_.range(points.length), Math.min(points.length,10000));

    if (n_vals >= 3)
      this.setupColors(min_val, max_val)
    var bubbleLocator = function (d) {
        return 'translate(' + (bubbleX(d)+20) + ',' + (bubbleY(d)) + ')';
        };
        
    $(`#${this.getId()}`).html(`<svg id="${this.getId()}-svg" class="plot"></svg>
    <canvas id="${this.getId()}-canvas" class="plot"></canvas>`)
    
    var svg = d3.select(`#${this.getId()}-svg`)
        .attr("width", chart_width)
        .attr("height", chart_height)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
        const g = svg.append("g")
    /*
    const brush = d3.brush()
                  .extent( [ [0, 0], [chart_width, chart_height] ] )
  
    // attach the brush to the chart
    const gBrush = g.append('g')
                    .attr('class', 'brush')
                    .call(brush);
    */
    var canvas = d3.select(`#${this.getId()}-canvas`)
        .attr("width", width  )
        .attr("height", height  )
        .style("transform", "translate(" + (margin.left ) +
            "px" + "," + (margin.top ) + "px" + ")");

    var xRange = d3.extent(points, function(d) { return d.x });
    var yRange = d3.extent(points, function(d) { return d.y });

    var xScale = d3.scaleLinear()
      .domain([xRange[0] * 0.9, xRange[1] *1.05])
      .range([0, width]);
    var yScale = d3.scaleLinear()
      .domain([yRange[0] * 0.9, yRange[1] *1.05])
      .range([height, 0]);

    var new_xScale = xScale, new_yScale = yScale;

    var xAxis = d3.axisBottom(xScale)
      .tickSizeInner(-height)
      //.ticks(Math.round(chart_width/20) )
      .tickSizeOuter(0)
      .tickPadding(20);

    var yAxis = d3.axisLeft(yScale)
      //.ticks(Math.round(chart_height/10) )
      .tickSizeInner(-width)
      .tickSizeOuter(0)
      .tickPadding(10);

    var zoomBehaviour = d3.zoom()
      .scaleExtent([0.5, 200])
      .on("zoom", onZoom)
      .on("end", onZoomEnd);
      
    var xAxisSvg = svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + height + ')')
      .call(xAxis);
    var yAxisSvg = svg.append('g')
      .attr('class', 'y axis')
      .call(yAxis);

    canvas.on("click", onClick)
          .on('mousemove', onMouseMove)

    canvas.call(zoomBehaviour);

    var context = canvas.node().getContext('2d');
    var r = regression.linear(points.map((i)=>([i.x,i.y]))),
    m = r.equation[0], b = r.equation[1];

    svg.append("text")
    .attr("class", "x label")
    .attr("text-anchor", "end")
    .attr("x", width)
    .attr("y", height - 6)
    .text(meas1);

    svg.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .attr("y", 6)
    .attr("dy", ".75em")
    .attr("transform", "rotate(-90)")
    .text(meas2);

  draw();

  var selectedPoint = null;
  
  function resetZoom()
  {
    if (points.length<2500)
    {
      canvas
      .transition()
      .duration(500)
      .call(zoomBehaviour.transform, d3.zoomIdentity);
    }
    else
      canvas.call(zoomBehaviour.transform, d3.zoomIdentity);

    new_xScale = xScale;
    new_yScale = yScale;
    xAxisSvg.call(xAxis.scale(new_xScale));
    yAxisSvg.call(yAxis.scale(new_yScale));

  }

  function openDetails()
  {
    let self = selected_vs
    let req = self.state.request
    sessionStorage.setItem("type", 'data')
    // sessionStorage.setItem("base_dim", 'property')
    // sessionStorage.setItem("dim_filters", self.itemSubstitute(req.dim_filters, self.getId()))
    // sessionStorage.setItem("val_filters", '')
    let 
      xLeft = new_xScale.invert(0),
      xRight = new_xScale.invert(chart_width),
      yTop = new_yScale.invert(0),
      yBottom = new_yScale.invert(chart_height);

      let indices = search(quadTree, xLeft, yBottom, xRight, yTop)
      if (indices.length == 0)
        return;

    let server_data = {}
    server_data.headers = selected_vs.server_js.headers
    server_data.data = []
    
    for (let i in indices)
    {
      server_data.data.push(selected_vs.server_js.data[i])
    }

    sessionStorage.setItem("server_data", JSON.stringify(server_data) )

    window.open('./details.html', '_blank');
  }

  if(this.resetDiv)
  {
    $("#reset-button-div").remove()
  }

  if (this.detailDiv)
    $("#detail-button-div").remove()


  this.resetDiv = $(`#${this.getId()}`).prepend(`<div id="reset-button-div" class="m-1"  style="width:25px; position:absolute; z-index:1000;">
  <input id="reset-button" width="25" height="25" type="image" src="../assets/images/reset_icon.svg"/></div>`)

  this.detailDiv = $(`#${this.getId()}`).append(`<div id="detail-button-div" class="m-1"  style="width:25px; position:absolute; top:40px; z-index:1000;">
  <input id="details-button" width="25" height="25" type="image" src="../assets/images/details-icon.svg"/></div>`)

  $('#reset-button').on('click', resetZoom)
  $('#details-button').on('click', openDetails)



  // Find the closest node within the specified rectangle.
  function findClosest(quadtree, base_point, x0, y0, x3, y3) 
  {
    let point = undefined, dist = Infinity;

    quadtree.visit(function(node, x1, y1, x2, y2) 
    {
      if (!node.length) 
      {
        do 
        {
          var d = node.data;
          let inside = (d.x >= x0) && (d.x < x3) && (d.y >= y0) && (d.y < y3);
          if (inside)
          {
            let new_dist = euclideanDistance(d.x, d.y, base_point[0], base_point[1])
            if (new_dist < dist)
            {
              dist = new_dist;
              point = d;
            }
          }
        } 
        while (node = node.next);
      }
      return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
  });

    return point;
  }


  // Find the closest node within the specified rectangle.
  function search(quadtree, x0, y0, x3, y3) 
  {
    let indices = []

    quadtree.visit(function(node, x1, y1, x2, y2) 
    {
      if (!node.length) 
      {
        do 
        {
          var d = node.data;
          let inside = (d.x >= x0) && (d.x < x3) && (d.y >= y0) && (d.y < y3);
          if (inside)
          {
            indices.push(d.i)
          }
        } 
        while (node = node.next);
      }
      return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
  });

    return indices;
  }

  var zoomed = false

  function onClick() 
  {
    var mouse = d3.mouse(this);

    // map the clicked point to the data space
    var xClicked = new_xScale.invert(mouse[0]);
    var yClicked = new_yScale.invert(mouse[1]);

    var xLeft = new_xScale.invert(mouse[0] - pointRadius)
    var xRight = new_xScale.invert(mouse[0] + pointRadius)
    var yTop = new_yScale.invert(mouse[1] - pointRadius)
    var yBottom = new_yScale.invert(mouse[1] + pointRadius)
    
    var closest = findClosest(quadTree, [xClicked,yClicked], xLeft, yBottom, xRight, yTop)

    if(selectedPoint != null) 
    {
        points[selectedPoint].selected = false;
        selectedPoint = null
    }

    if (!closest)
    {
      draw()
      return
    }
    
    closest.selected = true;
    selectedPoint = closest.i;

    draw()

    let position = $(`#${selected_vs.getId()}`).offset()
    let x = d3.event.x- position.left
    let y = d3.event.y- position.top
    selected_vs.propertyPopup(selected_vs.server_js.data[closest.i], x, y)
  }

// add a circle for indicating the highlighted point
  var hcircle = g.append('circle')
  .attr('class', 'highlight-circle')
  .attr('r', pointRadius + 2) // slightly larger than our points
  .style('fill', 'none')
  .style('display', 'none')
  .style('stroke', 'orange')
  .style('stroke-width', 2)
  
  
  function highlight(d) 
  {
    // no point to highlight - hide the circle
    if (!d) 
    {
      hcircle.style('display', 'none');
    }
    // otherwise, show the highlight circle at the correct position
    else 
    {
      hcircle
        .style('display', '')
        .attr('cx', new_xScale(d.x))
        .attr('cy', new_yScale(d.y));
    }
  }

  function onMouseMove() 
  {
    
    var mouse = d3.mouse(this);
    // map the clicked point to the data space
    var xClicked = new_xScale.invert(mouse[0]);
    var yClicked = new_yScale.invert(mouse[1]);

    var xLeft = new_xScale.invert(mouse[0] - pointRadius)
    var xRight = new_xScale.invert(mouse[0] + pointRadius)
    var yTop = new_yScale.invert(mouse[1] - pointRadius)
    var yBottom = new_yScale.invert(mouse[1] + pointRadius)

    var closest = findClosest(quadTree, [xClicked,yClicked], xLeft, yBottom, xRight, yTop)

    highlight(closest)

    if(closest)
    {
      let position = $(`#${selected_vs.getId()}`).offset()
      let x = d3.event.x- position.left
      let y = d3.event.y- position.top
      selected_vs.tooltipDiv
      .style("opacity", 1)
      .html(`${meas1}:${closest.x}, ${meas2}:${closest.y}`)
      .style("left", (x + 10) + "px")
      .style("top", (y + 10) + "px");
    }
    else
    {
      selected_vs.tooltipDiv
      .style("opacity", 0)
    }

  }
    

  var zoomEndTimeout;
  var currentTransform = d3.zoomIdentity;
  var counter = 0;

  function onZoom() 
  {
    zoomed = true
    currentTransform = d3.event.transform;
    new_xScale = currentTransform.rescaleX(xScale)
    new_yScale = currentTransform.rescaleY(yScale)
    xAxisSvg.call(xAxis.scale(new_xScale));
    yAxisSvg.call(yAxis.scale(new_yScale));
    if (++counter % 2)
      draw(randomIndex);
    
    clearTimeout(zoomEndTimeout);
  }

  function onZoomEnd() 
  {
      if (!zoomed)
      {
        return;
      }

      zoomed = false

      zoomEndTimeout = setTimeout(draw, 5);
  }

  function draw(index) 
  {
    var active;
    context.clearRect(0, 0, chart_width, chart_height);
    context.fillStyle = 'steelblue';
    context.strokeWidth = 0.5;
    context.strokeStyle = 'white';
    context.lineWidth = 0.5
    const c2PI = 2*Math.PI

    if(index) 
    {
        for (let i of index)
        {
            let point = points[i];
            context.beginPath()
            var cx = new_xScale(point.x);
            var cy = new_yScale(point.y);
            context.arc(cx, cy, pointRadius, 0, c2PI);
            context.fill();
            //context.stroke();
            //context.closePath();
        }
    }
    else 
    {
        for (let point of points)
        {
            
            context.beginPath()
            var cx = new_xScale(point.x);
            var cy = new_yScale(point.y);
            context.arc(cx, cy, pointRadius, 0, c2PI);
            context.fill();
            context.stroke();
            //context.closePath();
        }
    }

    // ensure that the actively selected point is drawn last
    // so it appears at the top of the draw order
    if(selectedPoint != null) 
    {
        context.fillStyle = 'red';
        drawPoint(points[selectedPoint], pointRadius);
        context.fillStyle = 'steelblue';
    }

    let rp = [[
      new_xScale(xRange[0]),
        new_yScale(m * xRange[0] + b)
    ], [
      new_xScale(xRange[1]),
      new_yScale(m * xRange[1] + b)
    ]];

    var lineGenerator = d3.line()
      .context(context);
    
    context.strokeStyle = 'red';
    context.lineWidth = 1 
    context.beginPath();
    lineGenerator(rp);
    context.stroke();
  }

  function drawPoint(point, r) 
  {
    var cx = new_xScale(point.x);
    var cy = new_yScale(point.y);
    context.lineWidth = 0.09
    context.beginPath();
    context.arc(cx, cy, r, 0, 2 * Math.PI);
    context.closePath();
    context.fill();
    context.stroke();
}

function euclideanDistance(x1, y1, x2, y2) 
{
    return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

    this.color_lookup = {} ;

    function colorCallback(instance, context) 
    {
      if (n_vals >= 3)
      {
        let val = server_js.data[context.dataIndex][i3]
        return instance.point_colors(val)
      }
      else
        return 'red';

      {
        let city = server_js.data[context.dataIndex][1]

        if (city in instance.color_lookup)
          return instance.color_lookup[city];
        else
        {
          var colors = ['green', 'red', 'blue']
          let n = Object.keys(instance.color_lookup).length
          let color = colors[(n+1)%colors.length]
          instance.color_lookup[city] = color
          return color
        }
      }
       
    }
  }

  
  async getTreeMapData()
  {
    await this.serverRequest()

    let server_js=this.server_js

    let vs_id=this.getId();
    let req=this.state.request;
    let gby_headers = this.itemSubstitute(req.groupbys, vs_id);
    // let val_headers = this.itemSubstitute(req.measures, vs_id);

  
    let root = gby_headers[0]
    let data = [{id:root, value:0}]
    let nodes = new Set()
    let n_gbys = gby_headers.length
    
    if (n_gbys>=2 && gby_headers[0]==gby_headers[1])
      n_gbys = 1

    let n_rows = server_js.length

    let ng = server_js[0][0].length - 1

    for (let r = 0; r < n_rows; ++r )
    {
      let row = server_js[r]
      let gby = row[0]
      let val = row[1][0]
      let str = root
      for (let i = 0; i< n_gbys; ++i)
      {
        let g2 = gby[i].replace(/\./g, '')
        str += '.' + g2
        if (i < ng && !nodes.has(str))
        {
          data.push( { id:str , value: 0});
          nodes.add(str);
        } 
      }
      data.push( { id:str , value: val});
    }
  
    return data;
  }
  async treemap()
  {
    let treemap_div = `${this.getId()}-treemap`
    $(`#${this.getId()}`).html(`<div id="${treemap_div}" style="position:absolute;"></div>`)
    let ht=$(`#${this.getId()}`).height();
    var parent_width = $(`#${this.getId()}`).width();
    var width = Math.round(parent_width*0.67);
    var height = Math.round(ht);
    var margin = Math.round((parent_width - width)/2)

    var format = d3.format(",d");

    var color = d3.scaleOrdinal()
      .range(d3.schemeCategory20
          .map(function(c) { c = d3.rgb(c); c.opacity = 0.8; return c; }));

    var stratify = d3.stratify()
      .parentId(function(d) { return d.id.substring(0, d.id.lastIndexOf(".")); });

    var treemap = d3.treemap()
      .size([width, height])
      .padding(1)
      .round(true);

    let data = await this.getTreeMapData();

    
    if (selected_vs && this!==selected_vs)
    {
      return 
    } 

    var root = stratify(data)
        .sum(function(d) { return d.value; })
        .sort(function(a, b) { return b.height - a.height || b.value - a.value; });

    treemap(root);
    d3.select(`#${treemap_div}`)
      .html("")

    d3.select(`#${treemap_div}`)
      .selectAll(".node")
      .data(root.leaves())
      .enter().append("div")
        .attr("class", "node")
        .attr("title", function(d) 
        { 
          return d.id.substring(d.id.indexOf(".") + 1) + "\n" + format(d.value); 
        })
        .style("left", function(d) { return d.x0 + margin + "px"; })
        .style("top", function(d) { return d.y0 + "px"; })
        .style("width", function(d) { return d.x1 - d.x0 + "px"; })
        .style("height", function(d) { return d.y1 - d.y0 + "px"; })
        .style("background", function(d) { while (d.depth > 1) d = d.parent; return color(d.id); })
      .append("div")
        .attr("class", "node-label")
        .text(function(d) 
        { 
          let s = d.id.substring(d.id.indexOf(".") + 1).replace(/\./g, "\n")//.split(/(?=[A-Z][^A-Z])/g).join("\n"); 
          return s;
        })
      .append("div")
        .attr("class", "node-value")
        .text(function(d) { return format(d.value); });
      

    function type(d) {
    d.value = +d.value;
    return d;
    }
      
    }

  async getCountyData(){
    let state_code_from_name =
    { CT: "09", NY: "36", NJ: "34", MA: "25" }


    await this.serverRequest()
    let server_js = this.server_js

    let value_idx = 0
    let min = Infinity, max = -Infinity
    let lut = {}
    for (let row of server_js)
    {
        let c = row[0][0]
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

  async setCountymap(mapDiv,legendDiv)
  {
    let result = await this.getCountyData();

    if (selected_vs && this!==selected_vs)
    {
      return 
    }

    let instance = this

    let county_data = result.lut;
    let max_data = result.max;
    let min_data = result.min;
    let first_map_draw = true
    let state_codes = new Set(["09", "34", "36"])
    var g = null;
    var path = null;
    var svg = null;
    let colors = [];
    let num_colors = 12;
    let geoScope = null;
    let scheme, null_color ;
    [scheme , null_color ] = this.getColorScheme();
    var tooltipDiv;
    let name_from_state_code =
    { "09": "CT", "36": "NY", "34": "NJ", "25": "MA" }

    for (let i = 0; i <= num_colors; ++i)
        colors.push(scheme(i / num_colors));

    let domain = [],
        m1,
        m2;
    if (min_data <= 0 && max_data <= 0)
    {
        m1 = min_data == 0 ? -1 : min_data + 0.005;
        m2 = max_data == 0 ? -1 : max_data;
        let r = (m2 / m1) ** (1 / (num_colors));

        for (let x = m1; x <= m2; x *= r)
            domain.push(x);
    }
    else if (min_data >= 0 && max_data >= 0) 
    {
        m1 = min_data == 0 ? 1 : min_data + 0.005;
        m2 = max_data == 0 ? 1 : max_data;
        let r = (m2 / m1) ** (1 / (num_colors));

        for (let x = m1; x <= m2; x *= r)
            domain.push(x);
    }
    else 
    {
        m1 = min_data;
        m2 = max_data;

        domain.push(min_data + 0.005);
        let r = max_data ** (1 / (num_colors - 1));

        for (let x = 1; x <= max_data; x *= r)
            domain.push(x);
    }
    var color = d3
        .scaleThreshold()
        .domain(domain)
        .range(colors);

    var width = $(`#${mapDiv}`).width(),
        height = $(`#${mapDiv}`).height(),
        centered;

    if (first_map_draw)
    {
      first_map_draw = false;

      var projection = d3.geoIdentity().reflectY(false);
      
      path = d3
          .geoPath() // updated for d3 v4
          .projection(projection);

      d3.select(`#${mapDiv}`)
      .html("")
     
      tooltipDiv = d3.select(`#${mapDiv}`).append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

      svg = d3
          .select(`#${mapDiv}`)
          .append("svg")
          .attr("width", width)
          .attr("height", height)
          .on("click", stopped, true);

      svg
          .append("rect")
          .attr("class", "background")
          .attr("width", width)
          .attr("height", height)
      
      g = svg.append("g");
    }
    d3.json("./map_us_counties.json", function (error, us)
    {
        if (error) throw error;
        let states = topojson.feature(us, us.objects.states).features;
        let states_filtered = states.filter((d) => state_codes.has(d.id));
        let geoScope = {"type":"FeatureCollection","features":states_filtered};
        let county_features = topojson.feature(us, us.objects.counties).features;
        let county_filtered = county_features.filter((d) =>
            state_codes.has(d.id.substring(0, 2)));

        projection.fitExtent([[0,height*0.05],[width, height * 0.95]], geoScope);

        g.selectAll("path")
            .data(states_filtered)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("class", "feature");

        g.append("path")
            .datum(
                topojson.mesh(us, us.objects.states, function (a, b)
                {
                    if (!state_codes.has(a.id) && !state_codes.has(b.id))
                        return false;
                    else
                        return true;
                })
            )
            .attr("class", "mesh")
            .attr("d", path);

        g.append("g")
            .attr("class", "counties")
            .selectAll("path")
            .data(county_filtered)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("style", function (d)
            {
                let county = d.properties.name;
                let code = d.id.substring(0, 2);
                if (!(code in county_data) || !(county in county_data[code]))
                {
                    return `fill: ${null_color};`
                }
                let s = parseInt(code);
                let value = county_data[code][county];
                return `fill:${color(value)}; `;                  
            })
            .on("click", mapClicked)
            .on("mouseover", hovered)
            .on("mousemove", moved)
            .on("mouseout", mouseOuted);

          g.append("path")
              .attr("class", "county-borders")
              .datum(topojson.mesh(us, us.objects.counties, (d) =>
              state_codes.has(d.id.substring(0, 2))))
              .attr("d", path)
          
          d3.select(".background")
            .on("click",mapReset);

          showLegend(color, m1, m2)

          function mapClicked(d) 
          {
            centered = centered !== d && d;
      
            var paths = svg.selectAll("path")
              .classed("active", d => d === centered);
      
            var t0 = projection.translate(),
              s0 = projection.scale();
      
            projection.fitExtent([[0,height*0.05],[width, height * 0.95]], centered || geoScope);
      
            var interpolateTranslate = d3.interpolate(t0, projection.translate()),
            interpolateScale = d3.interpolate(s0, projection.scale());
      
            var interpolator = function(t) {
              projection.scale(interpolateScale(t))
                .translate(interpolateTranslate(t));
              paths.attr("d", path);
            }; 
        
            d3.transition()
              .duration(750)
              .tween("projection", function() {
               return interpolator;
            });
          }

          function mapReset() 
          {
            var paths = svg.selectAll("path")
              .classed("active", d => d === centered);
      
            var t0 = projection.translate(),
              s0 = projection.scale();
      
            projection.fitExtent([[0,height*0.05],[width, height * 0.95]], geoScope);
      
            var interpolateTranslate = d3.interpolate(t0, projection.translate()),
            interpolateScale = d3.interpolate(s0, projection.scale());
      
            var interpolator = function(t) {
              projection.scale(interpolateScale(t))
                .translate(interpolateTranslate(t));
              paths.attr("d", path);
            }; 
        
            d3.transition()
              .duration(750)
              .tween("projection", function() {
               return interpolator;
            });
          }

          function showLegend(color, min, max,)
          {
                   
              let n_divs = color.range().length;
          
              var client_width = document.getElementById(legendDiv).clientWidth
              let legend_width = client_width / 3
              let rect_width = Math.max(legend_width / 5 , 10)
              let left_margin = client_width / 2 - rect_width

              let rect_idx = 0;
              let rect_id = 0;
              var client_height = document.getElementById(legendDiv).clientHeight
              let legend_height = client_height * 0.8 
              let top_margin = client_height * 0.15
              let rect_height = legend_height / (n_divs + 1)
              
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
              .attr("x", left_margin)
              .attr("y", rectPos(-2))
              .attr("width", rect_width)
              .attr("fill", `${null_color}`)
              .attr("id", "no_data")

              g.append("text")
              .attr("x", left_margin + rect_width * 2)
              .attr("y", rectPos(-2) + rect_height / 2 )
              .text("– No Data")
              .attr("style", "font-size: 75%")
              .attr("id", "no-data")
          
              // let toolbar = w2ui.layout.get('top').toolbarv
              // let id = toolbar.get("values").selected
              // let text = toolbar.get(`values:${id}`).text
              let text = instance.alias(Comma_Sep(instance.state.request.measures,instance.state.id))

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

          function hovered(d)
          { 
            let code = d.id.substring(0, 2)
            let state = name_from_state_code[code]
            if (!state_codes.has(code))
                return
      
            let county = d.properties.name
            let value = 0;
            try
            {
              value = county_data[code][county]
            }
            catch
            {
              return;
            }     
            if (value == null || value == undefined)
              return;

            let idx = color.range().indexOf(color(value))
            let rect_id = `#rect_${idx}`
            let lx = parseInt(d3.select(rect_id).attr("x"))
            let ly = parseInt(d3.select(rect_id).attr("y"))
            let height = parseInt(d3.select(rect_id).attr("height"))
            
            var g = svg.append("g")
            .attr("transform", "translate(0,40)");
        
            d3.select(".key")
                .append("line")   
                .attr("id", "overline")
                .attr("x1", lx-3)
                .attr("y1", ly)
                .attr("x2", lx-3)
                .attr("y2", ly + height)
                .attr("style", `stroke:black;stroke-width:2`)

            tooltipDiv
                .style("opacity", 0.9);
            tooltipDiv.html(`${county} ${state} <br> ${value}`)
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
    });
    
    function mapReset(){}

  }
  async countymap(){
    
    let container = this.getId()
    let legendDiv = container + "Legend"
    let mapDiv = container + "Map"
    $(`#${container}`).html(`
    <div class="row" style="height: 100%">
      <div id="${legendDiv}" class="col-2 p-0" style="background-color: #ddd; border-radius: 1rem; box-shadow: 5px 5px 3px #a0a0a0;">
      </div>
      <div id="${mapDiv}-column" class="col-10 ps-1">
        <div id="${mapDiv}" style='position:relative;height:100%;'></div>
      </div>
    </div>`)
    this.setCountymap(mapDiv,legendDiv)
  }
  
}//end of Class definition

function initMap (){
 
}
