var view_states=[]
let aliases = {
  'beds:count'     : 'Number of Properties',
  'price:avg'      : 'Price, Average',
  'size:avg'       : 'Size, Average',
  'prop_type'      : 'Property Type',
  'county'         : 'County',
  'state_code'     : 'State',
  'city'           : 'City',
  'postal_code'    : 'Zip Code',
  'elevation:avg'  : 'Elevation, Average ',
  'year_built:min' : 'Earliest Construction (Year)',
  'pop 2019'       : 'Population 2019',
  'city:New York-NY' : 'New York City, NY',
  'city:Brooklyn-NY' : 'Brooklyn, NY',
  'city:Newark-NJ' : 'Newark, NJ',
  'city:Stamford-CT' : 'Stamford, CT',
  'city:New Canaan-CT' : 'New Canaan, CT',
  'city:Greenwich-CT' : 'Greenwich, CT',
  'state_code:NY' : 'New York State',
  'state_code:CT' : 'Connecticut',
  'state_code:NJ' : 'New Jersey',
  'size' : 'Size',
  'price' : 'Price',
  'beds' : 'Beds',
  'baths' : 'Baths',
  'year_built' : 'Year Built',
  'elevation' : 'Elevation',
  'flood_zone:AE,VE,AO' : 'High Flood Risk',
  'flood_zone' : 'Flood Zone',
  'range(property:year_built;1600;10;200)' : 'Year Built' , 
  'range(county:Median_Income_2019;0;1000;200)' : 'County Median Income 2019',
  '' : 'All (No Filter)',
  'building_size:avg'  : 'Building Size, Average',
  'price_per_sqft:avg' : 'Price Per Square Feet, Average',
  'building_size'  : 'Building Size, sqft',
  'price_per_sqft' : 'Price Per Square Feet',
  'assessment_building' : 'Assessed Building Value',
  'assessment_land' : 'Assessed Land Value',
  'assessment_total' : 'Assessed Total Value',
}

let req1 =
  {
    qid: "MD_AGG",
    base_dim: 'property',
    groupbys: ["prop_type"],
    measures: ["beds:count", "price:avg"],
    filters: []
  }

let req2 =
{
  qid: "MD_AGG",
  base_dim: 'property',
  groupbys: ["state_code"],
  measures: ["beds:count", "size:avg"],
  filters: []
}

let req3 =
{
  qid: "MD_AGG",
  base_dim: 'property',
  groupbys: ['?gby_option'],
  measures: ["?val_option", "?val_option2"],
  dim_filters: ["?dim_filter_option"]
}

let treemap_req =
{
  qid: "MD_AGG",
  base_dim: 'property',
  groupbys: ['?gby_option','?gby_option_2'],
  measures: ['?val_option'],
  dim_filters: ["?dim_filter_option"]
}

let req5 =
{
  qid: "MD_AGG",
  base_dim: 'property',
  groupbys: ['county'],
  measures: ['?val_option'],
  val_filters: ['?val_filter_option'] 
}


let req_geo =
{
  qid: "MD_RETR",
  base_dim: 'property',
  dim_filters: ["?dim_filter_option"],
  val_filters: ['?val_filter_option']
}


let req_scatter =
{
  qid: "MD_RETR",
  base_dim: 'property',
  dim_filters: ["?dim_filter_option"],
}

let chart_def = [
  {
    yAxisID: "left",
    type: "bar",
    backgroundColor: "#2271b440",
    borderColor:"#2271b4"
  },
  {
    yAxisID: "right",
    type: "line",
    backgroundColor: "#9b001f",
    borderColor:"#9b001f"
  } 
]

let dropdowns = {
  gby_option:{
    name:'Groupby 1',
    contents:['prop_type','state_code', 'postal_code', 'city', 'county', 'flood_zone', 
    'range(property:year_built;1600;10;200)', 
    'range(county:Median_Income_2019;0;1000;200)'],
    position:'bottom-middle',
    // knob_position:'left'
  },
  // gby_option_2:{
  //   name:'Groupby 2',
  //   contents:['prop_type','state_code', 'postal_code', 'city', 'county', 'flood_zone'],
  //   position:'bottom-left',
    // knob_position:'left'
  //},
  val_option:{
    name:'Value',
    contents: ['beds:count','size:avg', 'price:avg', 'elevation:avg', 'year_built:min'],
    position:'bottom-left',
    // knob_position:'left'
  },

  val_option2:{
    name:'Value',
    contents: ['price:avg', 'beds:count','size:avg', 'elevation:avg', 'year_built:min'],
    position:'bottom-right',
    // knob_position:'left'
  },

  dim_filter_option:{
    name:'City',
    contents: ['', 'city:Brooklyn-NY',  'city:Greenwich-CT', 'city:New Canaan-CT',  'city:Newark-NJ', 'city:New York-NY',  'city:Stamford-CT','state_code:NY', 'flood_zone:AE,VE,AO'],
    position:'top-left',
    // knob_position:'right'
  }
}
let treemap_dropdowns = {
  gby_option:{
    name:'Groupby 1',
    contents:['prop_type','state_code', 'postal_code', 'city', 'county', 'flood_zone'],
    position:'bottom-left',
    // knob_position:'left'
  },
  gby_option_2:{
    name:'Groupby 2',
    contents:['prop_type','state_code', 'postal_code', 'city', 'county', 'flood_zone'],
    position:'bottom-middle',
    // knob_position:'left'
  },
  val_option:{
    name:'Value',
    contents: ['beds:count', 'building_size:avg', 'price_per_sqft:avg', 'price:avg', 'elevation:avg', 'year_built:min'],
    position:'bottom-right',
    // knob_position:'left'
  },
  dim_filter_option:{
    name:'City',
    contents: ['', 'city:Brooklyn-NY',  'city:Greenwich-CT', 'city:New Canaan-CT',  'city:Newark-NJ', 'city:New York-NY',  'city:Stamford-CT','state_code:NY', 'flood_zone:AE,VE,AO'],
    position:'top-left',
    // knob_position:'right'
  }
}


let dropdowns2 = {
  col_option:{
    name:'Color',
    contents:['Greys', 'Blues','Greens',  'Oranges',  'Yellow Brown'],
    position:'bottom-left',
    // knob_position:'left'
  },
  val_option:{
    name:'Value',
    contents: ['beds:count', 'building_size:avg', 'price_per_sqft:avg', 'price:avg', 'elevation:avg', 'year_built:min'],
    position:'bottom-right',
    // knob_position:'right'
  },
  val_filter_option:{
    name:'Filters',
    contents: ['', 'county:Median_Income_2019>40000', 'county:Median_Income_2019>20000,county:Median_Income_2019<=30000', 'county:pop_2019>500000', 'county:pop_2019<50000', 'county:pop_2019<pop_2015', 'property:elevation>600'],
    position:'top-left',
    // knob_position:'right'
  }
}

let geodropdowns = {
  val_filter_option:{
    name:'Filters',
    contents: ['', 'property:price>1000000', 'property:price<200000', 'property:size<1500', 'property:size>5000', 'property:year_built<=1970', 'property:year_built>=1985', 'property:elevation>600'],
    position:'bottom-left',
    // knob_position:'right'
  },
  dim_filter_option:{
    name:'City',
    contents: ['', 'city:Brooklyn-NY',  'city:Greenwich-CT', 'city:New Canaan-CT',  'city:Newark-NJ', 'city:New York-NY',  'city:Stamford-CT','state_code:NY', 'flood_zone:AE,VE,AO'],
    position:'bottom-right',
    // knob_position:'right'
  }
}

let scatterdropdowns = {
  x_axis_option:{
    name:'X-Axis',
    contents: ['building_size', 'price_per_sqft', 'price', 'assessment_building', 'assessment_land', 'assessment_total', 'beds', 'baths', 'year_built', 'elevation'],
    position:'bottom-middle',
    // knob_position:'right'
  },
  y_axis_option:{
    name:'Y-Axis',
    contents: ['price', 'building_size', 'price_per_sqft', 'assessment_building', 'assessment_land', 'assessment_total', 'beds', 'baths', 'year_built', 'elevation'],
    position:'bottom-left',
    // knob_position:'right'
  },
  z_axis_option:{
    name:'Z-Axis',
    contents: ['','size', 'price', 'beds', 'baths', 'year_built', 'elevation'],
    position:'bottom-right',
    // knob_position:'right'
  },
  dim_filter_option:{
    name:'City',
    contents: ['state_code:CT', 'state_code:NY', 'state_code:NJ', 'city:Brooklyn-NY',  'city:Greenwich-CT', 'city:New Canaan-CT',  'city:Newark-NJ', 'city:New York-NY',  'city:Stamford-CT','flood_zone:AE,VE,AO'],
    position:'top-left',
    // knob_position:'right'
  }
}


let view_def=[{id:'TreeMap', view_type:'treemap', request: treemap_req, chart_def: chart_def, dropdowns:treemap_dropdowns, aliases:aliases, tile_config: {header: `Treemap`, subheader: `This is a Treemap`, height:'80vh', width:12}},
{id:'Chart', view_type:'chart',  view_subtype:'barChart', request: req3, dropdowns:dropdowns, aliases:aliases, chart_def: chart_def, tile_config: {header: `Line Chart`, subheader: `this is a Line Chart`, height:'65vh', width:12}},
{id:'Grid', view_type:'grid', request: req3, dropdowns:dropdowns, aliases:aliases, tile_config: {header: `Grid`,  subheader: `This is a Grid`, height:'65vh', width:12}},
{id:'CountyMap', view_type:'countymap', request: req5, dropdowns:dropdowns2, color_scheme:"?col_option", aliases:aliases,  tile_config: {header: `CountyMap`, subheader: `This is a CountyMap`, height:'65vh', width:12}},
{id:'Map', view_type:'geomap', request: req_geo, dropdowns:geodropdowns, aliases:aliases, tile_config: {header: `Map`, subheader: `Map of properties`, height:'65vh', width:12}},
{id:'ScatterChart', view_type:'scatterChart', request: req_scatter, dropdowns:scatterdropdowns, aliases:aliases, x_axis:'?x_axis_option', y_axis:'?y_axis_option', z_axis:'?z_axis_option', tile_config: {header: `ScatterChart`, subheader: `This is a Scatter Chart`, height:'65vh', width:12}}]


const main_ps = new PerfectScrollbar('#main-container',
  {suppressScrollX: true}
)

var input=document.getElementById(`view-knob`)

var labels=[]

for (let view of view_def)
{
  view.tile_config.parent_div=('#main-panel')
  let vs= new View_State (view)
  view_states.push(vs)
  $('#view-select').append(`<option ${view==0?'selected':''} value="${view.id}">${view.id}</option>`)
  labels.push('.')
}

selected_vs=view_states[0]

createVsKnob(labels)

selected_vs.state.tile_config.height = `${getContentHeight()}px`

console.log('content height is :'+selected_vs.state.tile_config.height)
selected_vs.createTile()

resizeContent()

function getContentHeight()
{
  let client_height = document.documentElement.clientHeight
  let row_height = 60 //$('#vs-column').height()
  return client_height - 2.5 * row_height 
}

function resizeContent()
{
  let content_height = getContentHeight()
  selected_vs.state.tile_config.height = `${content_height}px`
  $('.content').height(content_height)
}

function createVsKnob(labels) 
{
  if(vs_knob != null)
    vs_knob.removeEventListeners()
  vs_knob = null
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

  $('#vs-column').append(/*`<input id='view-knob' class='p2' type="range" min="0" max="10" data-dropdown='view-select' 
    data-width="${knob_width}" data-height="${knob_height}" data-angleOffset="220" data-angleRange="280"></div>*/
    `<div class="dropdown float-end ps-3 pt-1">
    <a class="cursor-pointer" id="dropdownTable" data-bs-toggle="dropdown" aria-expanded="false" style="font-size:0.5rem;">
      <i class="fa fa-ellipsis-v fa-3x" aria-hidden="true" style="color:white;line-height:2;"></i>
    </a>
    <ul id="tile-functions" class="dropdown-menu px-2 py-3 " aria-labelledby="dropdownTable" style="">
      <li><a class="dropdown-item border-radius-md" href="./home.html">About</a></li>
      <li><a class="dropdown-item border-radius-md" href="./explore.html">Explore</a></li>
    </ul>
    </div>`)
  /*let input=document.getElementById(`view-knob`)
  input.value = view_states.indexOf(selected_vs)
  input.dataset.labels = labels
  vs_knob = new Knob(input, new Ui.P1({}))*/
}

function refreshTiles(){
  // createVsKnob(this.labels)
  selected_vs.createControls()
  resizeContent()
  // console.log('resizing knobs')
  selected_vs.refresh()
  $(".p1").on("change", controlsKnobChangeCallback)
  $(".p2").on("change", viewKnobChangeCallback)
  $(".controls-select").on("change", controlsDropdownCallBack)
  main_ps.update()
}

function viewsDropdownCallBack ()
 {
  let index = $(this).prop('selectedIndex');
  let knob_id =  $(this).attr('data-knob')
  if(knob_id) {
    $("#"+ knob_id).val(index)
    getKnob(knob_id).changed(0)
  }
  else
    selected_vs=view_states[index]
    selected_vs.state.tile_config.height = `${getContentHeight()}px`
    selected_vs.createTile()
    $(".controls-select").on("change", controlsDropdownCallBack)
}


function viewKnobChangeCallback () 
{
  let dd_id = '#' + $(this).attr('data-dropdown')
  let index = $(this).val();
  $(dd_id).prop('selectedIndex', index);
  selected_vs=view_states[index]
  selected_vs.state.tile_config.height = `${getContentHeight()}px`
  selected_vs.createTile()
  $(".p1").on("change", controlsKnobChangeCallback)
  $(".controls-select").on("change", controlsDropdownCallBack)
}

function controlsDropdownCallBack ()
 {
  let index = $(this).prop('selectedIndex');
  let knob_id =  $(this).attr('data-knob')
  if(knob_id){
    $("#"+ knob_id).val(index)
    getKnob(knob_id).changed(0)
  }
  else
    selected_vs.createContent()
}


function controlsKnobChangeCallback () 
{
  let dd_id = '#' + $(this).attr('data-dropdown')
  let index = $(this).val();
  $(dd_id).prop('selectedIndex', index);
  selected_vs.createContent()
}

function hideMapTooltip ()
{
  d3.select("#prop-popup").style("opacity", 0).style("z-index",-1000)
}

$(".p1").on("change", controlsKnobChangeCallback)
$(".p2").on("change", viewKnobChangeCallback)
$(".controls-select").on("change", controlsDropdownCallBack)
$("#view-select").on("change", viewsDropdownCallBack)
$(window).resize(refreshTiles);

