async function serverRequest(params) {
  p = new URLSearchParams(params).toString();

  const api_url = `gserver/${p}`;

  var request = new Request(api_url, { method: "POST" });

  const response = await fetch(request);
  const json = await response.json();

  return json;
}

class Chart_Data_State
{
    constructor(chart)
    {
        this.chart = chart
        this.label_of_axis = []
        this.type_of_axis = {}
        this.data_changed = function (d,a){}
    }
    init_colors(left_colors, right_colors)
    {
      this.colors = {left:left_colors, right:right_colors}
      this.color_assignment = {left:{}, right:{}}
      this.last_color_idx = {left:0, right:0};
    }

    get_color(label, axis)
    {
      let color = this.color_assignment[axis][label]
      if (color)
      {
        return color;
      }
      else
      {
        let idx = this.last_color_idx[axis]++
        let color = this.colors[axis][idx]
        this.color_assignment[axis][label] = color
        return color
      }
    }

    onchange(f)
    {
        this.data_changed = f;
    }

    init(axis,label,type)
    {
        this.label_of_axis[axis] = new Set(label)
        this.type_of_axis[axis] = type
    }

    update_type(axis,type)
    {
        if (this.type_of_axis[axis] != type)
        {
            for (let d of this.chart.data.datasets)
            {
                if (d.yAxisID == axis)
                    d.type = type;
            }
            this.type_of_axis[axis] = type
            this.chart.update();
        }
    }

    update_label(axis, new_label, arg)
    {
        let label_exists = this.label_of_axis[axis].has(new_label)
        let ds = this.chart.data.datasets

        if (label_exists)
        {

            this.chart.data.datasets = ds.filter( e => e.yAxisID !=axis || e.label!=new_label )
            this.label_of_axis[axis].delete(new_label)
            this.chart.update();
        }
        else 
        {
          let color = this.get_color(new_label, axis)
            let d = 
            {
                label: new_label,
                yAxisID: axis,
                type: this.type_of_axis[axis],
                backgroundColor: color,
                borderColor:color
            }
            this.label_of_axis[axis].add(new_label)
            this.data_changed(d,arg)
            if (axis=='right') 
              this.chart.data.datasets.push(d)
            else 
              this.chart.data.datasets.unshift(d)

            this.chart.update();

        }

    }

}


function Comma_Sep(a) {
  var s = "";

  for (i = 0; i < a.length; i++) {
    s += a[i];

    if (i < a.length - 1) s += ",";
  }

  return s;
}

function formatNumber(num) {
  return num.toLocaleString("en");
}

function cloneDimFilters(dim_filters_obj){
  let clone={}
  for (let [dim,members] of Object.entries(dim_filters_obj)){
    clone[dim]=new Set ()
    for (let m of members)
      clone[dim].add(m)
  }
  return clone
}

function getDimFilterStr(dim_filters_obj)
{
  let str = ''
  for (let [dim,members] of Object.entries(dim_filters_obj)){
    let m_str = ''
    for (let m of members){
      m_str += m + ','
    }
    str += dim + ':' + m_str + ';'
  }
  return str
}

function cloneValFilters(val_filters_obj)
{
  let clone = {}
  for (let [meas, filters] of Object.entries(val_filters_obj)) {
    clone[meas] = new Set()
    for (let f of filters) {
      clone[meas].add({ 'op':f.op, 'rhs':f.rhs} )
    }
  }
  return clone
}

function getValFilterStr(val_filters_obj)
{
  let str=''
  for (let [meas, filters] of Object.entries(val_filters_obj)) {
    for (let f of filters) {
      str += meas + f.op + f.rhs + ','
    }
  }
  return str
}

function findMinMax(arr) 
{
  let min = arr[0], max = arr[0];

  for (let i = 1, len=arr.length; i < len; ++i) 
  {
    let v = arr[i];

    if (v < min)
      min = v;
    else if (v > max)
      max = v
  }

  return [min, max];
}

var base_dim = "";
var all_group_bys = []; //= ["city", "postal_code", "county", "state_code","prop_type", "prop_status"];
var all_dim_measures = {};
var all_measures = []; //["beds", "baths", "size", "price", "year_built", "elevation" ];
var all_funcs = []; // ["avg", "sum", "count", "max", "min"];
var last_index = 0;
var used_indices = new Set();
var used_gby_indices = new Set();
var server_meta;
var server_js;
var server_range=null;
// var gbyarray=[];
// var valarray=[];
var myChart=null;
var cds = null; //Chart_Data_State
var selected_vals=null;
var selected_gbys=null;
var global_dim_filters = {}
var global_val_filters = {}
var treemap_showing = false
/********************************************************/
$(function () {    
  var pstyle = 'border: 1px solid #dfdfdf; padding: 5px;';
  $('#layout').w2layout({
      name: 'layout',
      panels: [
          { type: 'left', size: "65%", resizable: true, style: pstyle, hidden:false, content: '<div id="grid" style="width: 100%; height: 1200px;"></div>' },
          {
            type: "bottom",
            size: '50%',
            resizable: true,
            hidden: true,
            style: pstyle,
            content: '<div id="treemap" style="width: 1200; height: 1200px;background-color:#eee"></div>',
            toolbar: {
              name: "toolbar",
              style:
                "padding: 2px; border-bottom: 3px solid #9f9faf;" +
                "background: linear-gradient(to bottom, #f0f2f4 0%,#e5e7e9 36%,#ccd6dc 100%);" +
                "font-weight:bold; font-size: 1.875em;",
              items: [
                { type: "spacer"},
                {
                  type: 'html', id: 'hide-treemap', 
                  html: 
                  '<button style="border:0px;padding:0px;margin:2px" onclick="hideTreeMap()"> <img src="./assets/images/minimize.svg" style="height:16px;width:16px" /> </button>',
                },      
                //{ type: "html", html: "<pre> </pre>" }, 
                {
                  type: 'html', id: 'restore-treemap', 
                  html: 
                  '<button style="border:0px;padding:0px;margin:2px" onclick="restoreTreeMap()"> <img src="./assets/images/window-split.svg" style="height:16px;width:16px" /> </button>',
                },
                //{ type: "html", html: "<pre> </pre>" },
                {
                  type: 'html', id: 'max-treemap', 
                  html: 
                  '<button style="border:0px;padding:0px;margin:2px" onclick="maximizeTreeMap()"> <img src="./assets/images/maximize2.svg" style="height:16px;width:16px" /> </button>',
                },
              ],
            }
          },
          { type: 'main', size: "35%", style: pstyle + 'margin: 5px', hidden:false, content: '<canvas style="background-color:ghostwhite; width: 100%; height:1200px" id="myChart"></canvas>', 
              toolbar: {
                  style: pstyle+'margin: 5px; background-color:rgb(235,235,235)',
                  items: [
                    { type: 'menu', id: 'chart-type', text: 'Chart Type',
                       items: [
                       { id: 'bar-line', text: 'Bar/Line' },
                       { id: 'scatter-bubble', text: 'Scatter/Bubble' },
                      ]
                    },
                    { type: 'button', id: 'scattergram', text: 'Scattergram', icon: 'fa fa-wrench', onClick: createScatterChart},
                    { type: 'new-line' },
                    { type: 'menu-check', id: 'l-axis-measures', text: 'Left Y-Axis',
                      items: []
                    },
                    { type: 'menu-radio', id: 'l-axis-type',
                    text: function (item) {
                        var text = item.selected;
                        var el   = this.get('l-axis-type:' + item.selected);
                        return el.text;
                    },
                    selected: 'bar',
                    items: [
                        {id: 'bar', text: 'Bar Chart'},
                        {id: 'line', text: 'Line Chart'},
                    ]
                    },
                    { type: 'menu-radio', id: 'scatter-x', text: 'X-Axis',
                    items: []
                    },
                    { type: 'menu-radio', id: 'scatter-y', text: 'Y-Axis',
                    items: []
                    },
                    { type: 'menu-radio', id: 'sb-type',
                    text: function (item) {
                        var text = item.selected;
                        var el   = this.get('sb-type:' + item.selected);
                        return el.text;
                    },
                    selected: 'scatter',
                    items: [
                        {id: 'scatter', text: 'Scatter Chart'},
                        {id: 'bubble', text: 'Bubble Chart'},
                    ]
                    },
                    {type:'spacer'},
                    { type: 'menu-check', id: 'r-axis-measures', text: 'Right Y-Axis',
                      items: []
                    },
                    { type: 'menu-radio', id: 'r-axis-type',
                    text: function (item) {
                        var text = item.selected;
                        var el   = this.get('r-axis-type:' + item.selected);
                        return el.text;
                    },
                    selected: 'bar',
                    items: [
                        {id: 'bar', text: 'Bar Chart'},
                        {id: 'line', text: 'Line Chart'},
                    ]
                    }
                  ],
                  onClick: function (event) {
                    if (event.target.indexOf('l-axis-measures:') >= 0) 
                    {
                      let label = event.subItem.text
                      let col_idx = event.subItem.id
                      disableMenuItem('r-axis-measures', label, event.subItem.checked)
                      cds.update_label('left', label, col_idx)
                    }
                      
                    else if (event.target.indexOf('r-axis-measures:') >= 0) 
                    {
                      let label = event.subItem.text
                      let col_idx = event.subItem.id
                      disableMenuItem('l-axis-measures', label, event.subItem.checked)
                      cds.update_label('right', label, col_idx)
                    }
                    else if (event.target=='l-axis-type:bar'){
                      cds.update_type('left', 'bar')
                    }
                    else if (event.target=='l-axis-type:line'){
                      cds.update_type('left', 'line')
                    }
                    else if (event.target=='r-axis-type:bar'){
                      cds.update_type('right', 'bar')
                    }
                    else if (event.target=='r-axis-type:line'){
                      cds.update_type('right', 'line')
                    }
                    else if (event.target=='chart-type:scatter-bubble'){
                      w2ui.layout.get('main').toolbar.hide('l-axis-measures','r-axis-measures', 'r-axis-type', 'l-axis-type')
                      w2ui.layout.get('main').toolbar.show('scatter-x','scatter-y')
                    }
                    else if (event.target=='chart-type:bar-line'){
                      w2ui.layout.get('main').toolbar.show('l-axis-measures','r-axis-measures', 'r-axis-type', 'l-axis-type')
                      w2ui.layout.get('main').toolbar.hide('scatter-x','scatter-y')
                    }
                  }
              },
          }
      ]
  });
});

function disableMenuItem (axis, label, state) {
  let axis_menu=w2ui.layout.get('main').toolbar.get(axis)
  for (let item of axis_menu.items){
    if (item.text==label){
      item.disabled=state
      return
    }
  }
}
function hideTreeMap()
{
  //w2ui.layout.get("main").size = '100%'
  w2ui.layout.show("main", true)
  w2ui.layout.show("left", true)
  w2ui.layout.hide("bottom", true)
  treemap_showing = false
}
function maximizeTreeMap()
{
  w2ui.layout.hide("main", true) 
  w2ui.layout.hide("left", true)
  w2ui.layout.get("bottom").size = '100%'
  w2ui.layout.show("bottom", true)
  treemap_showing = true
}

function restoreTreeMap()
{
  w2ui.layout.show("main", true)
  w2ui.layout.show("left", true)
  w2ui.layout.get("bottom").size = '50%'
  w2ui.layout.show("bottom", true)
  treemap_showing = true
}
/*********************************************************************/
async function InitPage() {
  console.log("ready!");
  $("#submitButton").prop("disabled", true)
  var dim_info = null;
  dim_info = await serverRequest({ qid: "GET_DIMS" });

  if (dim_info == null) {
    alert("couldn't get dim info from server");
  }
  for (const [dim, traits] of Object.entries(dim_info)) {
    if (traits["num_dim_attribs"] > 0 && traits["num_val_attribs"] > 0) {
      base_dim = dim;
      break;
    }
  }
  if (base_dim == "") {
    alert("couldn't find base dim");
  }

  all_group_bys = await serverRequest({
    qid: "GET_DIM_DIMATTRIBS",
    dim: base_dim,
  });
  all_funcs = await serverRequest({ qid: "GET_SUMM_FUNCS" });
  all_dim_measures = await serverRequest({
    qid: "GET_DIM_MEASURES",
    dim: base_dim,
  });
  all_measures = all_dim_measures[base_dim];

  var ddrangedim = $("#rangedimdd");

  for ([d, measures] of Object.entries(all_dim_measures)) {
    var rangeitem = $(`<option value=${d}>${d}</option>`);
    ddrangedim.append(rangeitem);
  }
  ddrangedim.trigger("change");
  //add a row for gby and measure
  //the delete button for the first row
  //will not be added in the call back

  $("#addrow").trigger("click");
  $("#addgbyrow").trigger("click");
  $('#ddgroupby1').val("prop_type");
  $('#grid').w2grid({
    name : 'grid',  
    show: {
      toolbar: true,
      footer: true
    },
    multiSearch: true,
  })
  $('#grid').hide()
  $("#submitButton").prop("disabled", false)
} //initPage

//selected_* arrays should be of the form array of strings
// each element of selected_vals should be of the form measure:func
function onclick_addGbyRow() {
  var str_row;
  var gbytable = $("#gbytable");
  //create unique id's for the dropdowns

  var ddgroupby = "ddgroupby" + last_index;

  used_gby_indices.add(last_index);

  str_row = "<tr id=" + "gbytablerow" + last_index + ">";
  str_row +=
    "<td><select class='form-select groupby-select'aria-label='Default select example' id=" +
    ddgroupby +
    "></select></td>";
  if (used_gby_indices.size > 1)
    str_row +=
      "<td><button class='btn btn-sm btn-warning delete-gbyrow-class'type='button' value=" +
      last_index +
      ">Delete</button></td>";
  str_row += "</tr>";
  gbytable.append(str_row);

  ++last_index;

  var dropdowngby = $("#" + ddgroupby);

  for (j = 0; j < all_group_bys.length; j++) {
    dropdowngby.append(
      "<option value=" + all_group_bys[j] + ">" + all_group_bys[j] + "</option>"
    );
  }

  if (used_gby_indices.size == 1)
    dropdowngby.append(
      `<option style="background-color:SandyBrown" value="RANGE">RANGE</option>`
    );
}
/*******************************************************************************************/
function onclick_addMeasureRow() {
  var str_row;
  var measuretable = $("#measuretable");
  //create unique id's for the dropdowns

  var ddmeasure_id = "ddmeasure" + last_index;
  var ddfunc_id = "ddfunc" + last_index;

  used_indices.add(last_index);

  str_row = "<tr id=" + "measuretablerow" + last_index + ">";
  str_row +=
    "<td><select class='form-select'aria-label='Default select example' id=" +
    ddmeasure_id +
    "></select></td>";
  str_row +=
    "<td><select class='form-select'aria-label='Default select example' id=" +
    ddfunc_id +
    "></select></td>";
  if (used_indices.size > 1)
    str_row +=
      "<td><button class='btn btn-sm btn-warning delete-row-class'type='button' value=" +
      last_index +
      ">Delete</button></td>";
  str_row += "</tr>";
  measuretable.append(str_row);

  ++last_index;

  var dropdownmeasure = $("#" + ddmeasure_id);
  var dropdownfunc = $("#" + ddfunc_id);

  for (j = 0; j < all_measures.length; j++) {
    dropdownmeasure.append(
      "<option value=" + all_measures[j] + ">" + all_measures[j] + "</option>"
    );
  }

  for (k = 0; k < all_funcs.length; k++) {
    dropdownfunc.append(
      "<option value=" + all_funcs[k] + ">" + all_funcs[k] + "</option>"
    );
  }
}

function onclick_updateDimFilter() {
  var dim=$(this).attr('data-value')
  delete global_dim_filters[dim]
  updateQuery()
}

function onclick_updateValFilter() {
  var meas=$(this).attr('data-meas')
  delete global_val_filters[meas]
  updateQuery()
}

function getRangeDef() {
  var range_dim = $("#rangedimdd").val();
  var range_val = $("#rangemeasuredd").val();
  var range_start = parseFloat($("#rangeStart").val());
  var range_size = parseFloat($("#rangeSize").val());
  var range_buckets = parseInt($("#numBuckets").val());
  if (isNaN(range_start) || isNaN(range_size) || isNaN(range_buckets)) {
    alert("Range definition is incomplete!");
    return "";
  }
  var range_def =
    "range(" +
    range_dim +
    ":" +
    range_val +
    ";" +
    range_start +
    ";" +
    range_size +
    ";" +
    range_buckets +
    ")";
  return range_def;
}

function getSelectedGbys() {
  var g_array=[]
  for (let idx of used_gby_indices) {
    var ddgroupby = "#ddgroupby" + idx;
    var selected_gby = $(ddgroupby).val();
    if (selected_gby == "RANGE") {
      var range_def = getRangeDef();
      g_array.push(range_def);
    } else g_array.push(selected_gby);
  }
  return g_array;
}

function getSelectedMeasures() {
  var m_array = [];
  for (let idx of used_indices) {
    var ddmeasure_id = "#ddmeasure" + idx;
    var ddfunc_id = "#ddfunc" + idx;
    var selected_val = $(ddmeasure_id).val();
    selected_val += ":" + $(ddfunc_id).val();
    m_array.push(selected_val);
  }
  return m_array;
}

function disableChart (state){
  $("#chartlyaxisdd").prop("disabled",state);
  $("#chartryaxisdd").prop("disabled",state);
}

function initChart(selected_vals) {
  var left_check_items=[]
  var right_check_items=[]
  var chartDropdowns = [$("#chartlyaxisdd"), $("#chartryaxisdd")]
  
  // for (let i=0; i<chartDropdowns.length; i++) {
  //   dd=chartDropdowns[i]
  //   dd.html("")
  //   if (i==1){
  //     dd.append(`<option value=-1>none</option>`)
  //   }
  let toolbar = w2ui.layout.get("main").toolbar

    for (let j = 0; j<selected_vals.length; ++j) 
    {
      let val = selected_vals[j]
      left_check_items.push({id: j, text: val, checked:false, keepOpen: true})
      right_check_items.push({id: j, text: val, checked:false, keepOpen: true})
    }
    toolbar.get("l-axis-measures").items=left_check_items
    toolbar.get("r-axis-measures").items=right_check_items
    toolbar.get('l-axis-measures').selected = []
    toolbar.get('r-axis-measures').selected = []
  // }
}
  
async function getServerDataColumn (tag, col_idx){
  var params = {
    qid: "TAG_RETR",
    first_row: 0,
    num_rows: 0,
    tag:tag
  }
  var res= await serverRequest(params)
  return res
}

function getLocalDataColumn (col_idx){
  var data_col=[]
  for (let row of server_js){
    data_col.push(row[1][col_idx])
  }
  return data_col
}

function getLabels (){
  var labels=[]
  for (let row of server_js){
    labels.push(row[0][0])
    //to do: handle multiple group bys
  }
  return labels
}

function getDataColumn (col_idx){
  return getLocalDataColumn(col_idx)
  //to do: may need to go to server to extract data
}
function cellAttribute1(cell, row, col) {

  if (cell != null) {
    let width = row.cells[0].data[1];
    let tcolor = ''
    if (width == 1)
      tcolor = ';color:silver'
    return {
      'style': `border-top:${width}px solid` + tcolor

    }
  }
}

function cellAttribute2(cell, row, col) {

  if (cell != null) {
    return {
      'style': `border-top:${row.cells[0].data[1]}px solid` 

    }
  }
}

function updateQuery ()
{
  var params = {
    qid: "MD_AGG",
    dim: base_dim,
    gby: Comma_Sep(selected_gbys),
    val: Comma_Sep(selected_vals),
    dim_filters: encodeURIComponent(getDimFilterStr(global_dim_filters)),
    val_filters: getValFilterStr(global_val_filters)
  };

  //var response = await serverRequest(params);
  serverRequest(params).then((server_result) => {
    server_meta=server_result["meta"]
    if (server_meta.status != "OK"){
      alert("The data server returned "+ server_meta.status)
      return
    }
    server_js=server_result["data"]
    if (server_meta.is_range)
      server_range = server_result.range;
  
    updateGrid(server_js, selected_gbys, selected_vals);
    disableChart(false);
    initChart(selected_vals);
    if (myChart != null){ 
      myChart.destroy();
    }
    createChart();
    $('#chartlyaxisdd').trigger("change");
    updateTreeMap();
    showBreadCrumbs();
  });
}
/****************************************************/
function getTreeMapData()
{
  let root = selected_gbys[0]
  data = [{id:root, value:0}]
  let nodes = new Set()

  let sel = w2ui.grid.getSelection();
  let n_sel = sel.length
  let n_rows = n_sel
  if (n_rows == 0 )
    n_rows = server_js.length

  let ng = server_js[0][0].length - 1

  for (let r = 0; r < n_rows; ++r )
  {
    let row = (n_sel == 0)? server_js[r] : server_js[sel[r]-1] 
    let gby = row[0]
    let val = row[1][0]
    let str = root
    for (let i = 0; i< gby.length; ++i)
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
function updateTreeMap()
{
  if (treemap_showing)
    showTreeMap();
}

function showTreeMap()
{
  if (!treemap_showing)
    maximizeTreeMap();
  var client_width = document.documentElement.clientWidth
  var width = Math.round(client_width*0.67);
  var height = Math.round(width*0.67);
  var margin = Math.round((client_width - width)/2)

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


  {

  let data = getTreeMapData();
  var root = stratify(data)
      .sum(function(d) { return d.value; })
      .sort(function(a, b) { return b.height - a.height || b.value - a.value; });

treemap(root);
d3.select("#treemap")
   .html("")

d3.select("#treemap")
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
}

function type(d) {
d.value = +d.value;
return d;
}
  
}


function showTreeMap2()
{
  maximizeTreeMap();

  var width = 1500,
    height = 1000,
    ratio = 4;

var format = d3.format(",d");

var color = d3.scaleOrdinal()
    .range(d3.schemeCategory10
        .map(function(c) { c = d3.rgb(c); c.opacity = 0.6; return c; }));

var stratify = d3.stratify()
        .parentId(function(d) { return d.id.substring(0, d.id.lastIndexOf(".")); });
    

var treemap = d3.treemap()
    .tile(d3.treemapSquarify.ratio(1))
    .size([width / ratio, height]);

 {
  let data = getTreeMapData()

  var root = stratify(data)
      .sum(function(d) { return d.value; })
      .sort(function(a, b) { return b.height - a.height || b.value - a.value; });

  treemap(root);
  
  d3.select("#treemap")
  .html("")

  d3.select("#treemap")
    .selectAll(".node")
    .data(root.leaves())
    .enter().append("div")
      .attr("class", "node")
      .attr("title", function(d) 
      { 
        return d.id.substring(d.id.indexOf(".") + 1) + "\n" + format(d.value); 
      })
      .style("left", function(d) { return Math.round(d.x0 * ratio) + "px"; })
      .style("top", function(d) { return Math.round(d.y0) + "px"; })
      .style("width", function(d) { return Math.round(d.x1 * ratio) - Math.round(d.x0 * ratio) - 1 + "px"; })
      .style("height", function(d) { return Math.round(d.y1) - Math.round(d.y0) - 1 + "px"; })
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
}

function type(d) {
  d.value = +d.value;
  return d;
}
}

function showTreeMap3()
{
  maximizeTreeMap()

  d3.select("svg")
   .html("")

   var svg = d3.select("svg"),
   width = 1200,
   height = 1200;

var format = d3.format(",d");

//var color = d3.scaleMagma()
//   .domain([-4, 4]);

const color = d3.scaleOrdinal().range(['lightgrey', 'indianred', 'steelblue']).domain([2, 1, 0])
// var color = d3.scaleOrdinal()
//     .range(d3.schemeCategory10
//         .map(function(c) { c = d3.rgb(c); c.opacity = 0.6; return c; }));
var stratify = d3.stratify()
    .parentId(function(d) { return d.id.substring(0, d.id.lastIndexOf(".")); });

var treemap = d3.treemap()
    .size([width, height])
    .paddingOuter(3)
    .paddingTop(19)
    .paddingInner(1)
    .round(true);

 {
  
  var data = getTreeMapData()

  var root = stratify(data)
      .sum(function(d) { return d.value; })
      .sort(function(a, b) { return b.height - a.height || b.value - a.value; });

  treemap(root);

  var cell = svg
    .selectAll(".node")
    .data(root.descendants())
    .enter().append("g")
      .attr("transform", function(d) { return "translate(" + d.x0 + "," + d.y0 + ")"; })
      .attr("class", "node")
      .each(function(d) { d.node = this; })
      .on("mouseover", hovered(true))
      .on("mouseout", hovered(false));

  cell.append("rect")
      .attr("id", function(d) { return "rect-" + d.id; })
      .attr("width", function(d) { return d.x1 - d.x0; })
      .attr("height", function(d) { return d.y1 - d.y0; })
      .style("fill", function(d) { return color(d.depth); });

  cell.append("clipPath")
      .attr("id", function(d) { return "clip-" + d.id; })
    .append("use")
      .attr("xlink:href", function(d) { return "#rect-" + d.id + ""; });

  var label = cell.append("text")
      .attr("clip-path", function(d) { return "url(#clip-" + d.id + ")"; });

  label
    .filter(function(d) { return d.children; })
    .selectAll("tspan")
      .data(function(d) { return d.id.substring(d.id.lastIndexOf(".") + 1).split(/(?=[A-Z][^A-Z])/g).concat("\xa0" + format(d.value)); })
    .enter().append("tspan")
      .attr("x", function(d, i) { return i ? null : 4; })
      .attr("y", 13)
      .text(function(d) { return d; });

  label
    .filter(function(d) { return !d.children; })
    .selectAll("tspan")
      .data(function(d) { return d.id.substring(d.id.lastIndexOf(".") + 1).split(/(?=[A-Z][^A-Z])/g).concat(format(d.value)); })
    .enter().append("tspan")
      .attr("x", 4)
      .attr("y", function(d, i) { return 13 + i * 10; })
      .text(function(d) { return d; });

  cell.append("title")
      .text(function(d) { return d.id + "\n" + format(d.value); });
}

function hovered(hover) {
  return function(d) {
    d3.selectAll(d.ancestors().map(function(d) { return d.node; }))
        .classed("node--hover", hover)
      .select("rect")
        .attr("width", function(d) { return d.x1 - d.x0 - hover; })
        .attr("height", function(d) { return d.y1 - d.y0 - hover; });
  };
}
}

function getGridSelectionFromTreeMap(title)
{
  let idx = title.indexOf("\n")
  let gby = title.slice(0,idx).split('.')
  let n_gby = gby.length

  for (let r = 0; r < w2ui.grid.records.length; ++r )
  {
    let n_found = 0
    let rec = w2ui.grid.records[r]
    for (let i = 0; i< n_gby; ++i)
    {
      if (rec[selected_gbys[i]] != gby[i])
        break
      else
        ++n_found 
    }
    if (n_gby == n_found)
    {
       return w2ui.grid.records[r].recid;
    }
  }
  return -1; // not found
}
var dblclick_triggered = false;

function onclick_treemapNode()
{
  let title=$(this).attr('title')
  var $this = $(this);
  if ($this.hasClass('clicked'))
  {
      dblclick_triggered = true
      ondblclick_treemapNode(title);
      return;
  }
  else
  {
        $this.addClass('clicked');
        setTimeout(function() { 
                if (!dblclick_triggered)
                  process_click(title)
                dblclick_triggered = false
                $this.removeClass('clicked'); },200);
  }
  function process_click(title)
  {
    let idx = getGridSelectionFromTreeMap(title)
    if (idx != -1)
    {
        w2ui.grid.selectNone();
        w2ui.grid.select(idx);
        popup();
    }
 }
}

function ondblclick_treemapNode(title)
{
  let idx = getGridSelectionFromTreeMap(title)
  if (idx != -1)
  {
      w2ui.grid.selectNone();
      w2ui.grid.select(idx);
      openDetailsPage();
  }
}
/****************************************************/
function createScatterChart(){
  if (myChart !== null) {
    myChart.destroy()
  }
  let i=0
  let j=0
  if (server_js[0][1].length>1)
    j=1

  let points=[]
  for (let row of server_js){
    let x=row[1][i]
    let y=row[1][j]
    points.push({x:x,y:y})
  }

  console.log("creating chart");

  var canvas = $('#myChart')

  const data = {
    datasets: [{
      label: 'Scatter Dataset',
      data: points,
      backgroundColor: 'rgb(255, 99, 132)'
    }],
  };

  const config ={
    type:  'scatter',
    data: data,
    options: {
      aspectRatio: 1.2,
      scales: {
        x: {
          type: 'linear',
          position: 'bottom'
        }
      },
      plugins: {
        tooltip: {
            callbacks: {
                label: function(ctx) {
                    // console.log(ctx);
                    let label = server_js[ctx.dataIndex][0][0] //ctx.dataset.labels[ctx.dataIndex];
                    label += " (" + ctx.parsed.x + ", " + ctx.parsed.y + ")";
                    return label;
                }
            }
        }
      }
    }
  }
    myChart = new Chart(canvas, config);

}
/****************************************************/
function openDetailsPage()
{
  //make deep copy of global filters 
  let local_dim_filters=cloneDimFilters(global_dim_filters)
  let local_val_filters=cloneValFilters(global_val_filters)

  let sel = w2ui.grid.getSelection();
  console.log(sel)
  let dim_filters = ""
  let val_filters = ""

  for (let i=0; i<selected_gbys.length; ++i)
  {
    let g = selected_gbys[i];

    if (i == 0 && server_meta.is_range) 
    {
      meas = selected_gbys[0].split(';')[0].slice(6) //parse the line, range(dim:measure;etc)
      //result is of the form dim:measure

      //assume selected ranges are continuous
      //TODO: remove this assumption in the future

      //merge the range intervals by only looking
      //at the first and last intervals

      let [min_idx, max_idx] = findMinMax(sel);

      let rg1 = w2ui.grid.get(min_idx)[g]
      let rg_interval1 = server_range[rg1]

      let rg2 = w2ui.grid.get(max_idx)[g]
      let rg_interval2 = server_range[rg2]

      let rg_interval = [ rg_interval1[0], rg_interval2[1]]

      local_val_filters[meas]=new Set()

      if (rg_interval[0] == 'Below')
        local_val_filters[meas].add ( {'op':'<', 'rhs':rg_interval[1]} )
      
      else if (rg_interval[1] == 'Above')
        local_val_filters[meas].add ( {'op':'>=', 'rhs':rg_interval[0]} )
    
      else
      {
        local_val_filters[meas].add ( {'op':'<', 'rhs':rg_interval[1]} )
        local_val_filters[meas].add ( {'op':'>=', 'rhs':rg_interval[0]} )
      } 
    }
    else
    {
      let gby_set = new Set()
      for (let s of sel)
        gby_set.add(w2ui.grid.get(s)[g])

      if (!local_dim_filters.hasOwnProperty(g)){
        local_dim_filters[g]=new Set()
      }  
      for (let e of gby_set)
        local_dim_filters[g].add(e)
    }
  } 
  dim_filters=getDimFilterStr(local_dim_filters)
  val_filters=getValFilterStr(local_val_filters)

  sessionStorage.setItem("base_dim", base_dim)
  sessionStorage.setItem("dim_filters", dim_filters)
  sessionStorage.setItem("val_filters", val_filters)
  window.open('./details.html', '_blank');

  console.log(dim_filters)
}

function showBreadCrumbs(){
  showGbyBreadCrumbs()
  showValBreadCrumbs()
  showDimFilterBreadCrumbs()
  showValFilterBreadCrumbs()
}

function showGbyBreadCrumbs(){

  $(".gby-breadcrumb").html("")
    for (i=0;i<selected_gbys.length;i++){
      $(".gby-breadcrumb").append(`<button class="bread-crumb gby-item">${selected_gbys[i]}</button>`)
    }

}

function showValBreadCrumbs(){

  $(".val-breadcrumb").html("")
    for (j=0;j<selected_vals.length;j++){
    $(".val-breadcrumb").append(`<button class="bread-crumb val-item">${selected_vals[j]}</button>`)
    }
}

function showDimFilterBreadCrumbs(){
  
  $(".dim-breadcrumb").html("")
    for (let [dim, members] of Object.entries(global_dim_filters)){
      let str=dim+':'
      let count=0
      for (let m of members){
        str+=m
        count++
        if (count==2 && members.size>2){
          str+= " \u22EF "
          break
        }
        else if (count < members.size - 1)
          str += " \u2014"

      }
    $(".dim-breadcrumb").append(`<button class="bread-crumb dim-item" data-value="${dim}">${str}</button>`)
    }
}

function showValFilterBreadCrumbs(){
  
  $(".val-filter-breadcrumb").html("")
    for (let [meas, filters] of Object.entries(global_val_filters)){
      let str=""
      for (let f of filters)
      {
        str = meas + f.op + f.rhs
        $(".val-filter-breadcrumb").append(`<button class="bread-crumb val-filter-item" data-meas="${meas}">${str}</button>`)
      }
    
    }
}

function updateGrid(server_js, gby_headers, val_headers) {

  $('#grid').show()
  $().w2destroy('grid');
  // w2ui.grid.clear(true)
  // w2ui.grid.columns=[]
  let searches=[]
  let columns=[]
  for (let col of gby_headers){
    columns.push({field:col, text:col, attr:col, sortable:true})
    searches.push({field:col, text:col, label:col, type:"text"})
  }
  for (let col of val_headers){
    columns.push({field:col, text:col, sortable:true})
    searches.push({field:col, text:col, label:col, type:"float"})
  }
  // w2ui.grid.searches=searches
  let count=1
  let records=[]
  for (let row of server_js){
    let rec={recid:count++}
    let n_gbys=gby_headers.length
    for (let i=0; i<n_gbys; i++){
      rec [gby_headers[i]]=row[0][i]
    }
    for (let i=0; i<val_headers.length; i++){
      rec[val_headers[i]]=row[1][i]
    }
    records.push(rec)
  }
  $('#grid').w2grid({
    name : 'grid',  
    show: {
      toolbar: true,
      footer: true,
      lineNumbers: true,
    },
    toolbar: {
      items: [
          { type: 'break' },
          { type: 'button', id: 'launch-details', text: 'Details', img: 'icon-page', disabled: true },
          { type: 'button', id: 'drilldown', text: 'Drilldown', icon: 'fas fa-sort-amount-down', disabled: true },
          { type: 'button', id: 'treemap', text: 'Tree Map', icon: 'fas fa-tree' },
        ],
      onClick: function (target, data) {
          if (target == 'launch-details')
            openDetailsPage();
          else if (target == 'drilldown')
            popup();
          else if (target == 'treemap' )
            showTreeMap()
      }
    },
    multiSearch: true,
    columns: columns,
    searches: searches,
    records: records,

    onSelect: function(event) {
      event.onComplete = function(){
        if (this.getSelection().length > 0){
          this.toolbar.enable('launch-details');
          this.toolbar.enable('drilldown')
        }
      }
    },

    onUnselect: function(event) {
        event.onComplete = function()
        {
          if (this.getSelection().length == 0){
            this.toolbar.disable('launch-details');
            this.toolbar.disable('drilldown')
          }
        }
     },
 
    onClick: function(event) {
      event.onComplete = function()
        {
          if (this.getSelection().length == 0){
            this.toolbar.disable('launch-details');
            this.toolbar.disable('drilldown')
          }
        }
     },

  })

}
/****************************************************/
function popup() {

  w2popup.open({
      title: 'Drilldown',
      body: '<div class="w2ui-centered" style="line-height: 1.8">Choose a new Groupby<br><label>Available Groupbys:</label><input type="list" class="w2ui-input" id="drilldown-groupby" style="width: 300px"></div>',
      buttons: '<button class="w2ui-btn" onclick="drillDownOk()">Ok</button>'+
      '<button class="w2ui-btn" onclick="w2popup.close()">Cancel</button>',
      onOpen(event) {
        event.done(() => {
            $('#w2ui-popup input').focus()
        })
      },
      onKeydown(event) {
        console.log('keydown', event)
      },
      onMove(event) {
        console.log('popup moved', event)
    }
    });
    let g=new Set(selected_gbys.concat(Object.keys(global_dim_filters)))
    let g2=all_group_bys.filter(e=>!g.has(e))
    $('input[type=list]').w2field('list', { items: g2})
}

function drillDownOk() {
  let groupby=$('#drilldown-groupby').val()
  w2popup.close()

  let sel = w2ui.grid.getSelection();
  console.log(sel)
  let val_filters = ""

  for (let i=0; i<selected_gbys.length; ++i)
  {
    let g = selected_gbys[i];

    if (i == 0 && server_meta.is_range) 
    {
      meas = selected_gbys[0].split(';')[0].slice(6) //parse the line, range(dim:measure;etc)
      //result is of the form dim:measure

      //assume selected ranges are continuous
      //TODO: remove this assumption in the future

      //merge the range intervals by only looking
      //at the first and last intervals

      let [min_idx, max_idx] = findMinMax(sel);

      let rg1 = w2ui.grid.get(min_idx)[g]
      let rg_interval1 = server_range[rg1]

      let rg2 = w2ui.grid.get(max_idx)[g]
      let rg_interval2 = server_range[rg2]

      let rg_interval = [ rg_interval1[0], rg_interval2[1]]

      
      global_val_filters[meas]=new Set()

      if (rg_interval[0] == 'Below')
        global_val_filters[meas].add ( {'op':'<', 'rhs':rg_interval[1]} )
      
      else if (rg_interval[1] == 'Above')
        global_val_filters[meas].add ( {'op':'>=', 'rhs':rg_interval[0]} )
    
      else
      {
        global_val_filters[meas].add ( {'op':'<', 'rhs':rg_interval[1]} )
        global_val_filters[meas].add ( {'op':'>=', 'rhs':rg_interval[0]} )
      } 
    }
    else
    {
      if (!global_dim_filters.hasOwnProperty(g)){
        global_dim_filters[g]=new Set()
      }
      let gby_set = new Set()
      for (let s of sel)
        gby_set.add(w2ui.grid.get(s)[g])
      
      for (let e of gby_set)
        global_dim_filters[g].add(e)
    }
  }  

  var params = {
    qid: "MD_AGG",
    dim: base_dim,
    gby: groupby,
    val: Comma_Sep(selected_vals),
    dim_filters: encodeURIComponent(getDimFilterStr(global_dim_filters)),
    val_filters: getValFilterStr(global_val_filters)
  };

  selected_gbys=[groupby]
  //make the state of gby's on the page
  //consistent with the new drilldown gby
  $('#ddgroupby1').val(groupby);
  for (let idx of used_gby_indices)
  {
    if (idx != 1)
      $("#gbytablerow" + idx).remove(); //don't remove row 1
  }
  used_gby_indices.clear();
  used_gby_indices.add(1);//clear everything except row 1

  serverRequest(params).then((server_result) => {
    server_meta=server_result["meta"]
    if (server_meta.status != "OK"){
      alert("The data server returned "+ server_meta.status)
      return
    }
    server_js=server_result["data"]
    if (server_meta.is_range)
      server_range = server_result.range;
  
    updateGrid(server_js, selected_gbys, selected_vals);
    disableChart(false);
    initChart(selected_vals);
    if (myChart != null){ 
      myChart.destroy();
    }
    createChart();
    $('#chartlyaxisdd').trigger("change");
    updateTreeMap();
    showBreadCrumbs();
  });
}

/******************************************************************************** */
//Chart Logic
function updateChart (col_idx, update_data, side){
  const datasets=myChart.config.data.datasets
  datasets[0].type=leftcharttype
  // myChart.config.data.datasets[1].type=rightcharttype
  // if (update_data==true){
  //   if(col_idx==-1 && datasets.length==2){
  //     datasets.pop()
  //   }
  //   else if (side==1 && col_idx>0)
  //   let data_col=getDataColumn(col_idx)
  //   myChart.data.datasets[0].data=data_col
  // }
  myChart.update()
}
var chart_bg_color = {'left': 'rgba(255, 67, 46, 0.8)',
                 'right':  'rgba(54, 162, 235, 0.8)'}

var chart_bo_color = {'left': 'rgba(255, 67, 46, 1)',
'right':  'rgba(54, 162, 235, 1)'}


function loadChartData(dataset, col_idx)
{
  let values = getDataColumn(col_idx)
  dataset.data = values
  // dataset.backgroundColor = chart_bg_color[dataset.yAxisID]
  // dataset.borderColor = chart_bo_color[dataset.yAxisID]
}

function createChart() {
  // createStackedBarChart()
  
  console.log("creating chart");
  //var col_idx = parseInt($("#chartlyaxisdd").val());
  //var values = getDataColumn(col_idx)
 // var values2 = values.map(x=>x*2)
  //var leftcharttype = $("#left-type-dd").val()
  //var rightcharttype = $("#right-type-dd").val()
  //const labels = getLabels();

    var canvas = $('#myChart')
    const data = {
      labels: getLabels(),
      datasets: []
    }
    const config ={
      type:  'bar',
      data: data,
      options: {
        aspectRatio: 1.2,
        scales: {
            'left': {
                type: 'linear',
                position: 'left'
            },
            'right': {
                type: 'linear',
                position: 'right' 
            },
          }
      }
    }
    myChart = new Chart(canvas, config);

    cds = new Chart_Data_State(myChart)
    var l_colors= []
    var r_colors= []
    for (let i=0; i<selected_vals.length;++i){
      l_colors.push(d3.interpolateBlues(0.25+(i+1)/selected_vals.length/2))
      r_colors.push(d3.interpolateReds(0.25+(i+1)/selected_vals.length/2))
    }
    cds.init_colors(l_colors, r_colors)    
    cds.init('left', 'none', 'bar')
    cds.init('right', 'none', 'bar')
    cds.onchange(loadChartData)
};

function calculatePoint(i, intervalSize, colorRangeInfo) {
  var { colorStart, colorEnd, useEndAsStart } = colorRangeInfo;
  return (useEndAsStart
    ? (colorEnd - (i * intervalSize))
    : (colorStart + (i * intervalSize)));
}

/* Must use an interpolated color scale, which has a range of [0, 1] */
function interpolateColors(dataLength, colorScale, colorRangeInfo) {
  var { colorStart, colorEnd } = colorRangeInfo;
  var colorRange = colorEnd - colorStart;
  var intervalSize = colorRange / dataLength;
  var i, colorPoint;
  var colorArray = [];

  for (i = 0; i < dataLength; i++) {
    colorPoint = calculatePoint(i, intervalSize, colorRangeInfo);
    colorArray.push(colorScale(colorPoint));
  }

  return colorArray;
}

function createStackedBarChart() {

  const DATA_COUNT = 3;
  const colorRangeInfo1 = {
    colorStart: 0.2,
    colorEnd: 1,
    useEndAsStart: true,
  }
  const colorRangeInfo2 = {
    colorStart: .1,
    colorEnd: 1,
    useEndAsStart: true,
  }
  const colorRangeInfo3 = {
    colorStart: 0,
    colorEnd: 0.65,
    useEndAsStart: true,
  }
  const colorScale1 = d3.interpolateInferno;
  const colorScale2 = d3.interpolateRdYlBu;
  const colorScale3 = d3.interpolateCool;

  var COLORS1 = interpolateColors(DATA_COUNT, colorScale1, colorRangeInfo1);
  var COLORS2 = interpolateColors(DATA_COUNT, colorScale2, colorRangeInfo2);
  var COLORS3 = interpolateColors(DATA_COUNT, colorScale3, colorRangeInfo3);

  const NUMBER_CFG = { count: DATA_COUNT, min: -100, max: 100 };

  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const data = {
    labels: labels,
    datasets: [
      {
        label: "Dataset 1",
        yAxisID: 'A',
        data: [1,0,0,0,0,0,2],
        backgroundColor: COLORS2[0],
        stack: "Stack 0",
      },
      {
        label: "Dataset 2",
        yAxisID: 'B',
        data: [100,200,300,400,500,600,700],
        backgroundColor: COLORS2[1],
        stack: "Stack 1",
      },
      {
        label: "Dataset 3",
        yAxisID: 'A',
        data: [1,2,5,6,7],
        backgroundColor: COLORS2[2],
        stack: "Stack 0",
      },
    ],
  };
  // </block:setup>
 /* Grab chart element by id */

 /* Create color array */

  // <block:config:0>
  const config = {
    type: "bar",
    data: data,
    options: {
      plugins: {
        title: {
          display: true,
          text: "Chart.js Bar Chart - Stacked",
        },
      },
      responsive: true,
      interaction: {
        intersect: false,
      },
      scales: {
        yAxes: [{
          id: 'A',
          type: 'linear',
          position: 'left',
        }, {
          id: 'B',
          type: 'linear',
          position: 'right',
        }],
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
        },
      },
    },
  };
  // </block:config>
  myChart = new Chart($('#myChart'),config);
}

//two palettes, each with two colors (for odd and even rows)
const table_row_colors = [
  ["#F0FFFF", "#F9FFFF"],
  ["#FFFFF0", "#FFFFF9"],
];


async function onclick_submit() {
  disableChart(true);
  // await new Promise(r => setTimeout(r, 5000));
  console.time("onclick_submit");
  selected_gbys = getSelectedGbys();
  selected_vals = getSelectedMeasures(); 
  
  showBreadCrumbs();

  var params = {
    qid: "MD_AGG",
    dim: base_dim,
    gby: Comma_Sep(selected_gbys),
    val: Comma_Sep(selected_vals),
    dim_filters: encodeURIComponent(getDimFilterStr(global_dim_filters)),
    val_filters: getValFilterStr(global_val_filters)
  };

  //var response = await serverRequest(params);
  serverRequest(params).then((server_result) => {
    console.time("process response");
    server_meta=server_result["meta"]
    if (server_meta.status != "OK"){
      alert("The data server returned "+ server_meta.status)
      return
    }
    server_js=server_result["data"]
    if (server_meta.is_range)
      server_range = server_result.range;
  
    updateGrid(server_js, selected_gbys, selected_vals);
    console.timeEnd("process response");
    disableChart(false);
    initChart(selected_vals);
    if (myChart != null){ 
      myChart.destroy();
    }
    createChart();
    $('#chartlyaxisdd').trigger("change");
    updateTreeMap();
  });
  console.timeEnd("onclick_submit");
}

$(document).ready(InitPage);
$(document).on("click", "#submitButton", onclick_submit);
$(document).on("click", "#addrow", onclick_addMeasureRow);
$(document).on("click", "#addgbyrow", onclick_addGbyRow);
$(document).on("click",".dim-item", onclick_updateDimFilter)
$(document).on("click",".val-filter-item", onclick_updateValFilter)
$(document).on("click",".node", onclick_treemapNode)


$(document).on("hidden.bs.collapse", "#allmeasures2", function (e) {
  var msr_str = "Chosen Measures : ";

  for (let idx of used_indices) {
    var ddmeasure_id = "#ddmeasure" + idx;
    var ddfunc_id = "#ddfunc" + idx;
    var selected_val = $(ddmeasure_id).val();
    selected_val += ":" + $(ddfunc_id).val();
    msr_str += selected_val + " ";
  }
  $("#measurestring").html(msr_str);
});

$(document).on("click", ".delete-gbyrow-class", function (e) {
  var index = parseInt(this.value);
  $("#gbytablerow" + index).remove();
  used_gby_indices.delete(index);
});

$(document).on("click", ".delete-row-class", function (e) {
  var index = parseInt(this.value);
  $("#measuretablerow" + index).remove();
  used_indices.delete(index);
});

$("#rangedimdd").on("change", function () {
  var dim = $("#rangedimdd").val();
  var ddrangemeasure = $("#rangemeasuredd");
  ddrangemeasure.html("");
  for (measure of all_dim_measures[dim]) {
    ddrangemeasure.append(
      "<option value=" + measure + ">" + measure + "</updaoption>"
    );
  }
});

const allowedChars_posInteger = new Set("0123456789");
$(".positive-integer-input").on("keypress", function (e) {
  var key = e.originalEvent.key;
  var val = 0;
  if (this.value != "") val = parseInt(this.value);

  if (val == 0 && key == "0") {
    return false;
  } 
  else 
  return allowedChars_posInteger.has(e.originalEvent.key);
});
const allowedChars_Float = new Set("0123456789+-.Ee");
$(".float-input").on("keypress", function (e) {
  return allowedChars_Float.has(e.originalEvent.key);
});


