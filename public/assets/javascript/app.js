
async function serverRequest(params) {
  let p = new URLSearchParams(params).toString();

  const api_url = `gserver/${p}`;

  var request = new Request(api_url, { method: "POST" });

  const response = await fetch(request);
  const json = await response.json();

  return json;
}

async function getUser() {

  var request = new Request('/user', { method: "GET" });

  const response = await fetch(request);
  const json = await response.json();
  
  return json;
}

function destroyChart()
{
  if (myChart != null)
  { 
    ChartZoom.stop(myChart);
    myChart.destroy();
    myChart = null;
  }
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

  for (let i = 0; i < a.length; i++) {
    s += a[i];

    if (i < a.length - 1) 
      s += ",";
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
var user_info;
/********************************************************/
function createLayout() {    
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
          { type: 'main', size: "35%", style: pstyle + 'margin: 5px', hidden:false, 
              content: '<canvas style="background-color:ghostwhite; width: 100%; height:1200px" id="myChart"></canvas>', 
              toolbar: {
                  style: pstyle+'margin: 5px; background-color:rgb(235,235,235)',
                  items: [
                    { type: 'menu-radio', id: 'chart-type', text: 'Chart Type',
                       selected: 'bar-line',
                       items: [
                       { id: 'bar-line', text: 'Bar/Line' },
                       { id: 'scatter', text: 'Scatter' },
                      ]
                    },
                    {type: 'spacer'},
                    {id: 'R-squared', type: 'html', html: "<b>R<sup>2</sup>=1</b>"},
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
                    { type: 'menu-radio', id: 'scatter-x', text: 'X-Scale',
                    items: []
                    },
                    { type: 'menu-radio', id: 'scatter-y', text: 'Y-Scale',
                    items: []
                    },
                    { type: 'menu-radio', id: 'scatter-color', text: 'Color-Scale',
                    items: []
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
                    else if (event.target=='chart-type:scatter'){
                      showScatterControls()
                      createScatterChart()
                    }
                    else if (event.target=='chart-type:bar-line'){
                      hideScatterControls()
                      createBarChart()
                    }
                  }
              },
          }
      ]
  });
};

function showScatterControls() {
  w2ui.layout.get('main').toolbar.hide('l-axis-measures','r-axis-measures', 'r-axis-type', 'l-axis-type')
  w2ui.layout.get('main').toolbar.show('scatter-x','scatter-y', 'scatter-color')
}

function hideScatterControls() {
  w2ui.layout.get('main').toolbar.show('l-axis-measures','r-axis-measures', 'r-axis-type', 'l-axis-type')
  w2ui.layout.get('main').toolbar.hide('scatter-x','scatter-y', 'scatter-color')
}


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
  
  user_info = await getUser();

  console.log(user_info)

  if (!user_info) 
  { 
    $("#profileMenu").append(`<li class="nav-item" id="login"><a class="nav-link" href="./login.html">Login</a></li>`)
  }
  else 
  { 
    $("#profileMenu").append(`<li class="nav-item" id="user-button"><a class="nav-link" href="/profile">${user_info.displayName}</a></li>`)
    $("#profileMenu").append(`<li class="nav-item" id="user-button"><a class="nav-link" href="/logout">Logout</a></li>`)
  }

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

  for (let [d, measures] of Object.entries(all_dim_measures)) {
    var rangeitem = $(`<option value=${d}>${d}</option>`);
    ddrangedim.append(rangeitem);
  }
  ddrangedim.trigger("change");
  //add a row for gby and measure
  //the delete button for the first row
  //will not be added in the call back
  onclick_addGbyRow();
  onclick_addMeasureRow();
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
  createLayout()
  w2ui.layout.hide("main", true)
  w2ui.layout.hide("left", true)
  hideScatterControls()

} //initPage

//selected_* arrays should be of the form array of strings
// each element of selected_vals should be of the form measure:func
function onclick_addGbyRow() {
  var str_row;
  var add_gby_button=`<td class="button-cell px-0 pe-md-1"><button type="button" class="btn btn-sm btn-success table-button" id="addgbyrow"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle" viewBox="0 0 16 16">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"></path>
    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"></path>
    </svg></button></td>`
  var delete_gby_button=`<td class="button-cell px-0 pe-md-1"><button class='btn btn-sm btn-warning table-button delete-gbyrow' type='button' value='${last_index}'><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16">
    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"></path>
    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"></path>
    </svg></button></td>`
  var gbytable = $("#gbytable");
  //create unique id's for the dropdowns

  var ddgroupby = "ddgroupby" + last_index;

  used_gby_indices.add(last_index);

  str_row = "<tr id=" + "gbytablerow" + last_index + ">";
  str_row +=
    "<td class='p-1 px-sm-1'><select class='form-select groupby-select'aria-label='Default select example' id=" +
    ddgroupby +
    "></select></td>";
  str_row += add_gby_button

  if (used_gby_indices.size <= 1)
    str_row +='<td></td>'
    else
    str_row += delete_gby_button
  
  str_row += "</tr>";
  gbytable.append(str_row);

  ++last_index;

  var dropdowngby = $("#" + ddgroupby);

  for (let j = 0; j < all_group_bys.length; j++) {
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
  var add_m_button=`<td class="button-cell px-0 pe-sm-1"><button type="button" class="btn btn-sm btn-success table-button" id="addmrow"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-circle" viewBox="0 0 16 16">
  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"></path>
  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"></path>
  </svg></button></td>`
  var delete_m_button=`<td class="button-cell px-0 pe-sm-1"><button class='btn btn-sm btn-warning table-button delete-mrow' type='button' value='${last_index}'><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle" viewBox="0 0 16 16">
  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"></path>
  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"></path>
  </svg></button></td>`
  var measuretable = $("#measuretable");
  //create unique id's for the dropdowns

  var ddmeasure_id = "ddmeasure" + last_index;
  var ddfunc_id = "ddfunc" + last_index;

  used_indices.add(last_index);

  str_row = "<tr id=" + "measuretablerow" + last_index + ">";
  str_row +=
    "<td class='p-1 pe-sm-1'><select class='form-select'aria-label='Default select example' id=" +
    ddmeasure_id +
    "></select></td>";
  str_row +=
    "<td class='p-1 pe-sm-1'><select class='form-select'aria-label='Default select example' id=" +
    ddfunc_id +
    "></select></td>";
  str_row += add_m_button


  if (used_indices.size <= 1)
    str_row +='<td></td>'
    else
    str_row += delete_m_button

  str_row += "</tr>";
  measuretable.append(str_row);

  ++last_index;

  var dropdownmeasure = $("#" + ddmeasure_id);
  var dropdownfunc = $("#" + ddfunc_id);

  for (let j = 0; j < all_measures.length; j++) {
    dropdownmeasure.append(
      "<option value=" + all_measures[j] + ">" + all_measures[j] + "</option>"
    );
  }

  for (let k = 0; k < all_funcs.length; k++) {
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
    throw "Range definition is incomplete!";
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

function getSelectedGbys() 
{
  var g_array=[]
  for (let idx of used_gby_indices) 
  {
    var ddgroupby = "#ddgroupby" + idx;
    var selected_gby = $(ddgroupby).val();
    if (selected_gby == "RANGE") 
    {
      var range_def = getRangeDef();
      g_array.push(range_def);
    } 
    else
     g_array.push(selected_gby);
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
    createBarChart();
    $('#chartlyaxisdd').trigger("change");
    updateTreeMap();
    showBreadCrumbs();
  });
}
/****************************************************/
function getTreeMapData()
{
  let root = selected_gbys[0]
  let data = [{id:root, value:0}]
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
var point_colors = null;

function setupColors(min_data, max_data)
{
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

    point_colors = d3.scaleThreshold()
      .domain(domain)
     .range(colors);
}

function createScatterChart(){
  destroyChart()

  let toolbar=w2ui.layout.get('main').toolbar

  var left_check_items=[]
  var right_check_items=[]
  var third_check_items=[]

  for (let j = 0; j<selected_vals.length; ++j) 
  {
    let val = selected_vals[j]
    left_check_items.push({id: j, text: val, checked:false, keepOpen: true})
    right_check_items.push({id: j, text: val, checked:false, keepOpen: true})
    third_check_items.push({id: j, text: val, checked:false, keepOpen: true})
  }
  toolbar.get("scatter-x").items=left_check_items
  toolbar.get("scatter-y").items=right_check_items
  toolbar.get("scatter-color").items=third_check_items

  toolbar.check(0)
  toolbar.check(1)
  toolbar.refresh()

  let n_vals = selected_vals.length
  let i=0
  let j=0
  if (n_vals>1)
    j=1

  let max_val = -Infinity, min_val = Infinity
  let points=[]
  for (let row of server_js){
    let x=row[1][i]
    let y=row[1][j]
    points.push({x:x,y:y})
    if (n_vals >= 3)
    {
      let val = row[1][2]
      max_val = Math.max(max_val, val)
      min_val = Math.min(min_val, val)
    }
  }

  if (n_vals >= 3)
    setupColors(min_val, max_val)

  const regression = d3.regressionLinear()
    .x(d => d.x)
    .y(d => d.y)

  let reg = regression(points)
  let r2 = Math.round(reg.rSquared*100)/100

  let R2 = w2ui.layout.get('main').toolbar.get('R-squared')
  R2.html = `<b>R<sup>2</sup>=${r2}</b>`
  w2ui.layout.get('main').toolbar.refresh()

  var canvas = $('#myChart')

  const data = {
    datasets: [{
      label: 'Scatter Dataset',
      data: points,
      //backgroundColor: 'rgb(255, 99, 132)'
      pointBackgroundColor: function(context) {
        if (selected_vals.length >= 3)
        {
            let val = server_js[context.dataIndex][1][2]
            return point_colors(val)
        }
        else
          return 'red';

      }
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
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'xy',
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true
            },
            mode: 'xy',
          }
        },
        annotation: {
          annotations: {
            line1: {
              type: 'line',
              xMin: reg[0][0],
              yMin: reg[0][1],
              xMax: reg[1][0],
              yMax: reg[1][1],
              borderColor: 'rgb(99, 99, 99)',
              borderWidth: 1,
            }
          }
        }
      }
    }
  }

  myChart = new Chart(canvas, config);

}
/****************************************************/
function openMap()
{
  let sj = JSON.stringify(server_js)
  sessionStorage.setItem("server_js", sj)

  let sv = JSON.stringify(selected_vals)
  sessionStorage.setItem("selected_vals", sv)

  window.open('./counties-zoom.html', '_blank');
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
    for (let i=0;i<selected_gbys.length;i++){
      $(".gby-breadcrumb").append(`<button class="bread-crumb gby-item">${selected_gbys[i]}</button>`)
    }

}

function showValBreadCrumbs(){

  $(".val-breadcrumb").html("")
    for (let j=0;j<selected_vals.length;j++){
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
         // { type: 'button', id: 'map', text: 'Map', img: '<img src=./assets/images.NE_map.png/>', onClick: openMap},
          {
              type: 'html', id: 'map',
              html:
                  '<button style="border:0px;padding:0px;margin:2px;font-weight:normal" onclick="openMap()"> <img src="./assets/images/NE_map2.png" style="height:28px;width:32px" /> Map </button>',
            }
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
      buttons: '<button class="w2ui-btn" onclick=drillDownOk()>Ok</button>'+
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
    createBarChart();
    $('#chartlyaxisdd').trigger("change");
    updateTreeMap();
    showBreadCrumbs();
  });
}

/******************************************************************************** */
//Chart Logic

function loadChartData(dataset, col_idx)
{
  let values = getDataColumn(col_idx)
  dataset.data = values
  // dataset.backgroundColor = chart_bg_color[dataset.yAxisID]
  // dataset.borderColor = chart_bo_color[dataset.yAxisID]
}

function createBarChart() {

  let toolbar=w2ui.layout.get('main').toolbar
  toolbar.get('l-axis-measures').selected = []
  toolbar.get('r-axis-measures').selected = []

  let axes=['l-axis-measures', 'r-axis-measures']
  for (let axis of axes){
    let items= toolbar.get(axis).items
    for (let item of items){
      item.disabled=false
    }
  }

    destroyChart()
    var canvas = $('#myChart')
    const data = {
      labels: getLabels(),
      datasets: []
    }
    const config ={
      type:  'bar',
      data: data,
      options: {
        plugins: 
        {
          //zoom: false
        },
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
    var l_colors= []
    var r_colors= []
    for (let i=0; i<selected_vals.length;++i){
      l_colors.push(d3.interpolateBlues(0.25+(i+1)/selected_vals.length/2))
      r_colors.push(d3.interpolateReds(0.25+(i+1)/selected_vals.length/2))
    }
    cds = new Chart_Data_State(myChart)
    cds.init_colors(l_colors, r_colors)    
    cds.init('left', 'none', 'bar')
    cds.init('right', 'none', 'bar')
    cds.onchange(loadChartData)

    hideScatterControls()
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

//two palettes, each with two colors (for odd and even rows)
const table_row_colors = [
  ["#F0FFFF", "#F9FFFF"],
  ["#FFFFF0", "#FFFFF9"],
];

async function onclick_submit() {
  disableChart(true);
  // await new Promise(r => setTimeout(r, 5000));
  console.time("onclick_submit");
  try 
  {
    selected_gbys = getSelectedGbys();
    selected_vals = getSelectedMeasures(); 
  
    showBreadCrumbs();  
  }
  catch (err)
  {
    alert(err)
    return
  }
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
    createBarChart();
    $('#chartlyaxisdd').trigger("change");
    updateTreeMap();
    w2ui.layout.show("left", true)
    w2ui.layout.show("main", true)
  });
  console.timeEnd("onclick_submit");
}

$(document).ready(InitPage);
$(document).on("click", "#submitButton", onclick_submit);
$(document).on("click", "#addmrow", onclick_addMeasureRow);
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

$(document).on("click", ".delete-gbyrow", function (e) {
  var index = parseInt(this.value);
  $("#gbytablerow" + index).remove();
  used_gby_indices.delete(index);
});

$(document).on("click", ".delete-mrow", function (e) {
  var index = parseInt(this.value);
  $("#measuretablerow" + index).remove();
  used_indices.delete(index);
});

$("#rangedimdd").on("change", function () {
  var dim = $("#rangedimdd").val();
  var ddrangemeasure = $("#rangemeasuredd");
  ddrangemeasure.html("");
  for (let measure of all_dim_measures[dim]) {
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


