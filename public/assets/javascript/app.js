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
        this.label_of_axis = {}
        this.type_of_axis = {}
        this.data_changed = function (d,a){}
    }

    onchange(f)
    {
        this.data_changed = f;
    }

    init(axis,label,type)
    {
        this.label_of_axis[axis] = label
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
        let old_label = this.label_of_axis[axis]
        let ds = this.chart.data.datasets

        if (old_label != new_label)
        {
            if (new_label == 'none')
            {
                this.chart.data.datasets = ds.filter( e => e.yAxisID !=axis )
                this.chart.update();
            }
            else if (old_label == 'none')
            {
                let d = 
                {
                    label: new_label,
                    yAxisID: axis,
                    type: this.type_of_axis[axis]
                }
                this.data_changed(d,arg)
                this.chart.data.datasets.push(d)
                this.chart.update();

            }
            else
            {
                for (let d of this.chart.data.datasets)
                {
                    if (d.yAxisID== axis)
                    {
                        d.label = new_label;
                        this.data_changed(d,arg)
                    }
                }
                this.chart.update();
            }
            this.label_of_axis[axis] = new_label
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
/********************************************************/
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
  console.log(base_dim);
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

  console.log(dim_info);
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
    "<td><select class='form-select'aria-label='Default select example' id=" +
    ddgroupby +
    "></select></td>";
  if (used_gby_indices.size > 1)
    str_row +=
      "<td><button class='btn btn-warning delete-gbyrow-class'type='button' value=" +
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
      "<td><button class='btn btn-warning delete-row-class'type='button' value=" +
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
  var g_array = [];
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
  var chartDropdowns = [$("#chartlyaxisdd"), $("#chartryaxisdd")]
  
  for (let i=0; i<chartDropdowns.length; i++) {
    dd=chartDropdowns[i]
    dd.html("")
    if (i==1){
      dd.append(`<option value=-1>none</option>`)
    }
    for (let j = 0; j<selected_vals.length; ++j) 
    {
      let val = selected_vals[j]
      dd.append(`<option value=${j}>${val}</option>`);
    }
  }
  var typeDropdown = $(".chart-type")
  typeDropdown.html("")
  var chartTypes = ["bar","line"]
  for(let ctype of chartTypes){
    typeDropdown.append(`<option value=${ctype}>${ctype}</option>`)
  }
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
/****************************************************/
function data_false (){
  return false
}

function data_true (){
  return true
}

function updateGrid(server_js, gby_headers, val_headers) {
  /*searches: [
    { field: 'recid', text: 'ID ', type: 'int' },
    { field: 'lname', text: 'Last Name', type: 'text' },
    { field: 'fname', text: 'First Name', type: 'text' },
    { field: 'email', text: 'Email', type: 'text' },
    { field: 'sdate', text: 'Start Date', type: 'date' }
],*/
  $('#grid').show()
  $().w2destroy('grid');
  // w2ui.grid.clear(true)
  // w2ui.grid.columns=[]
  let searches=[]
  let columns=[]
  for (let col of gby_headers){
    columns.push({field:col, text:col, attr:col, sortable:true})
    searches.push({field:col, text:col, type:"text"})
  }
  for (let col of val_headers){
    columns.push({field:col, text:col, sortable:true})
    searches.push({field:col, text:col, type:"float"})
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
      footer: true
    },
    toolbar: {
      items: [
          { type: 'break' },
          { type: 'button', id: 'mybutton', text: 'My other button', img: 'w2ui-icon-colors' },
          { type: 'button', id: 'mybutton2', text: 'thing', img: 'w2ui-icon-columns' }
      ],
      onClick: function (target, data) {
          console.log(target);
      }
    },
    multiSearch: true,
    columns: columns,
    searches: searches,
    records: records
  })
//   // w2ui['grid'].addColumn('email', [
//   //   { field: 'lname', text: 'Last Name', size: '30%' },
//   //   { field: 'fname', text: 'First Name', size: '30%' }
// ]);
    // $('#grid').w2grid({
    //     name: 'grid',
    //     header: 'List of Names',
    //     columns: [
    //         { field: 'fname', text: 'First Name'  },
    //         { field: 'lname', text: 'Last Name' },
    //         { field: 'email', text: 'Email'},
    //         { field: 'sdate', text: 'Start Date'}
    //     ],
    //     records: [
    //         { recid: 1, fname: "Peter", lname: "Jeremia", email: 'peter@mail.com', sdate: '2/1/2010' },
    //         { recid: 2, fname: "Bruce", lname: "Wilkerson", email: 'bruce@mail.com', sdate: '6/1/2010' },
    //         { recid: 3, fname: "John", lname: "McAlister", email: 'john@mail.com', sdate: '1/16/2010' },
    //         { recid: 4, fname: "Ravi", lname: "Zacharies", email: 'ravi@mail.com', sdate: '3/13/2007' },
    //         { recid: 5, fname: "William", lname: "Dembski", email: 'will@mail.com', sdate: '9/30/2011' },
    //         { recid: 6, fname: "David", lname: "Peterson", email: 'david@mail.com', sdate: '4/5/2010' }
    //     ]
    // });
}

/******************************************************************************** */
//Chart Logic
function updateChart (col_idx, update_data, side){
  var leftcharttype = $("#left-type-dd").val()
  var rightcharttype = $("#right-type-dd").val()
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
  dataset.backgroundColor = chart_bg_color[dataset.yAxisID]
  dataset.borderColor = chart_bo_color[dataset.yAxisID]
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
  console.log(selected_gbys);
  selected_vals = getSelectedMeasures(); 
   
  console.log(selected_vals);

  var params = {
    qid: "MD_AGG",
    dim: base_dim,
    gby: Comma_Sep(selected_gbys),
    val: Comma_Sep(selected_vals),
  };

  //var response = await serverRequest(params);
  serverRequest(params).then((server_result) => {
    console.time("process response");
    server_meta=server_result["meta"]
    console.log(server_meta);
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
  });
  console.timeEnd("onclick_submit");
}

$(document).ready(InitPage);
$(document).on("click", "#submitButton", onclick_submit);
$(document).on("click", "#addrow", onclick_addMeasureRow);
$(document).on("click", "#addgbyrow", onclick_addGbyRow);

$(document).on("hidden.bs.collapse", "#allgroupbys2", function (e) {
  var gby_str = "Chosen Groupbys : ";
  for (let idx of used_gby_indices) {
    var ddgroupby = "#ddgroupby" + idx;
    var selected_gby = $(ddgroupby).val();
    gby_str += selected_gby + " ";
  }
  $("#groupbystring").html(gby_str);
});

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

$(document).on("show.bs.collapse", "#allgroupbys2", function (e) {
  $("#groupbystring").html("");
});

$(document).on("show.bs.collapse", "#allmeasures2", function (e) {
  $("#measurestring").html("");
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
  console.log(dim);
  var ddrangemeasure = $("#rangemeasuredd");
  ddrangemeasure.html("");
  for (measure of all_dim_measures[dim]) {
    ddrangemeasure.append(
      "<option value=" + measure + ">" + measure + "</updaoption>"
    );
  }
});

$("#chartlyaxisdd").on("change", function () {
  let col_idx = parseInt($("#chartlyaxisdd").val());
  let label = $("#chartlyaxisdd option:selected").text();
  cds.update_label('left', label , col_idx)
});

$("#chartryaxisdd").on("change", function () {
  let col_idx = parseInt($("#chartryaxisdd").val());
  let label = $("#chartryaxisdd option:selected").text(); 
  cds.update_label('right', label , col_idx)
});


$("#left-type-dd").on("change", function () {
  cds.update_type('left', $("#left-type-dd").val())
});

$("#right-type-dd").on("change", function () {
  cds.update_type('right', $("#right-type-dd").val())
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


