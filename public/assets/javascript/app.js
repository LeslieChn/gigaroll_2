
async function serverRequest(params) {
  p = new URLSearchParams(params).toString();

  const api_url = `gserver/${p}`;

  var request = new Request(api_url, { method: "POST" });

  const response = await fetch(request);
  const json = await response.json();

  return json;
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

async function InitPage() {
  console.log("ready!");
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
  for (let dd of chartDropdowns) {
    dd.html("")
    var i=0
    for (let val of selected_vals) {
      dd.append(`<option value=${i++}>${val}</option>`);
    }
  }
  var typeDropdown = $("#charttypedd")
  typeDropdown.html("")
  var chartTypes = ["line", "bar", "radar", "pie"]
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

  if (cell) {
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

  if (cell) {
    return {
      'style': `border-top:${row.cells[0].data[1]}px solid` 

    }
  }
}
/****************************************************/
var grid=null
function updateGrid(server_js, gby_headers, val_headers) {
  $("#wrapper").html("");

const x = 
{ 'name': 'Row',  
sort: {
  compare: (a, b) => {
    if (a[0] > b[0]) {
      return 1;
    } else if (b[0] > a[0]) {
      return -1;
    } else {
      return 0;
    }
  }
},
formatter : (cell,row) => {return cell[0]},

'attributes' : (cell,row,col) => {
  // add these attributes to the td elements only
  if (cell) {
  return {
  'data-cell-content':cell,
  'data-row' : row,
  'data-col' : col,
  'style'    : `border-top:${cell[1]}px solid`,

  'ondblclick': () => {
    let dim_filters=''
    let val_filters=''
    //build filters out of groupbys from the row the user doubleclicks
    for (let i = 0; i < selected_gbys.length; ++i) {
      
      if (i == 0 && server_meta.is_range) {
        meas = selected_gbys[0].split(';')[0].slice(6) //parse the line, range(dim:measure;etc)
                                                      //result is of the form dim:measure
        let rg = row.cells[i + 1].data
        let rg_interval = server_range[rg]
        
        if (rg_interval[0] == 'Below')
          val_filters = `${meas}<${rg_interval[1]}`;
        else if (rg_interval[1] == 'Above')
          val_filters = `${meas}>=${rg_interval[0]}`;
        else
          val_filters = `${meas}>=${rg_interval[0]},${meas}<${rg_interval[1]}`;
      }
      else
        dim_filters += selected_gbys[i] + ':' + row.cells[i + 1].data + ';';
    }

    sessionStorage.setItem("base_dim", base_dim)
    sessionStorage.setItem("dim_filters", dim_filters)
    sessionStorage.setItem("val_filters", val_filters)
    window.open('./details.html', '_blank');
  },

  'onmouseenter': () => {
    //console.log(cell);
    //console.log(row);
    //console.log(col);
  },
  'onmouseleave': () => {
    //console.log("leaving");
  }
  };
  }
}
}
  
  var headers= [x];
  let c = 0;
  for (let h of gby_headers.concat(val_headers)) {
    ++c;
    headers.push(
      {
        name: h,
        attributes: (c==1? cellAttribute1 : cellAttribute2),
      }
    )
  }
  var data=[]
  var prev_gby = ''
  var row_num = 1

  for (let row of server_js){
    let r = [[row_num++,0]].concat(row[0]).concat(row[1])
  

    if (prev_gby == r[1])
    {
       //continuation of a block
        border_width = 1
    }
    else
    {
      //started new block
      prev_gby = r[1]
      border_width = 2
    }

    r[0][1] = border_width
    data.push(r)
  }

  var config = {
    columns: headers, 
    data: data,
    sort: {
      multiColumn: false
    },
    search: true,
    autoWidth : true,
    // width:"50%",
    fixedHeader: true,
    resizable: true,
    language: {
      'search': {
        'placeholder': '🔍 Search...'
      },
      'pagination': {
        'previous': '⬅️',
        'next': '➡️'
      }
    },
    style: {
      table: {
        border: '3px solid #ccc',
      },
      th: {
        'background-color': '#276e8c',
        color: 'white',
        'border-bottom': '3px solid #ccc',
        'text-align': 'center'
      },
    }, 
    pagination: {
    enabled: true,
    limit: 20,
    summary: true
    },
    className: {
      table: 'table table-striped table-responsive',
    }
  }
  if (grid==null){
    grid=new gridjs.Grid(config).render(document.getElementById("wrapper"))
    //grid.on('cellClick', function (e,cell,col,row) 
    //{
    //  console.log('cell:',e);
    //  console.log('col:', col);
    //  console.log('row:', row);
    //}
    //)
  }
  else
  { grid.updateConfig(config)
    grid.forceRender()
  }
   
}
/******************************************************************************** */
//Chart Logic
function updateChart (col_idx, update_data){
  var typeofchart = $("#charttypedd").val()
  myChart.config.type=typeofchart
  if (typeofchart=="radar") {
    myChart.config.options.scales.x.ticks.display=false 
    }
  if (update_data==true){
    let data_col=getDataColumn(col_idx)
    myChart.data.datasets[0].data=data_col
  }
  myChart.update()
}
function createChart() {
  // createStackedBarChart()
  console.log("creating chart");
  var col_idx = parseInt($("#chartlyaxisdd").val());
  var values = getDataColumn(col_idx)
  var typeofchart = $("#charttypedd").val()
  const labels = getLabels();
  const data = {
    labels: labels,
    datasets: [{
      label: '',
      backgroundColor: '#ff9100',
      borderColor: '#ff9100',
      data: values,
    }]
  };
  const config = {
    type: typeofchart,
    data,
    options: {
      aspectRatio: 1.2,
    }
    };
  myChart = new Chart($('#myChart'),config);
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
var selected_gbys

async function onclick_submit() {
  disableChart(true);
  // await new Promise(r => setTimeout(r, 5000));
  console.time("onclick_submit");
  selected_gbys = getSelectedGbys();
  console.log(selected_gbys);
  var selected_vals = getSelectedMeasures(); 
   
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

    /*var tblhead = $("#tableHead");
    tblhead.html("");

    tblhead.append("<th scope='col'>Row</th>");

    for (i = 0; i < selected_gbys.length; i++) {
      tblhead.append("<th scope='col'>" + selected_gbys[i] + "</th>");
    }

    for (i = 0; i < selected_vals.length; i++) {
      tblhead.append("<th scope='col'>" + selected_vals[i] + "</th>");
    }

    var tbl = $("#resultsTable");
    tbl.html("");
    var str_row = "";
    var prev_gby = "";
    var row_palette = 0;
    var row_color = 0;
    gbyarray=[];
    valarray=[];
    
    for (i = 0; i < server_js.length; i++) {
      const row = server_js[i];
      //populate the table
      const gbys = row[0];
      const vals = row[1];
      var border_width = "1px";
      //choose the row color
      if (gbys[0] != prev_gby && gbys.length > 1) {
        //if we started a new block (based on the first gby)
        //switch the palette
        //but only do this if we have more than one gby

        row_palette = 1 - row_palette;
        row_color = 0;
        border_width = "3px";
      } else row_color = 1 - row_color; //alternate the row color

      var bcolor = table_row_colors[row_palette][row_color];
      str_row += `<tr style="border-top: ${border_width} solid">`;
      var cell_style = `style="background-color:${bcolor};border-right:1px solid"`;

      str_row += `<td ${cell_style}>${i + 1}</td>`;
      for (g = 0; g < gbys.length; g++) {
        var gby = gbys[g];
        gbyarray.push(gby)
        var opacity = 1;
        if (g == 0 && gby == prev_gby) {
          //gby=" "
          opacity = 0.25;
        }

        if (opacity != 1)
          str_row += `<td style="background-color:${bcolor};border-right:1px solid"><b style="color:#CCCCCC">${gby}</b></td>`;
        else str_row += `<td ${cell_style}"><b>${gby}</b></td>`;
      }

      prev_gby = gbys[0];
      for (v = 0; v < vals.length; v++) {
        var val = vals[v]
        valarray.push(val)
        str_row += `<td ${cell_style}"><b>${formatNumber(vals[v])}</b></td>`;
      }
      str_row += "</tr>";
      if (i % 100 == 99) {
        tbl.append(str_row);
        str_row = "";
      }
    }
    tbl.append(str_row);
    */
    updateGrid(server_js, selected_gbys, selected_vals);
    console.timeEnd("process response");
    disableChart(false);
    initChart(selected_vals);
    if (myChart != null){ 
      myChart.destroy();
    }
    createChart();
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
      "<option value=" + measure + ">" + measure + "</option>"
    );
  }
});

$("#chartlyaxisdd").on("change", function () {
  var col_idx = parseInt($("#chartlyaxisdd").val());
  updateChart(col_idx, true)
});


$("#charttypedd").on("change", function () {
  updateChart(0, false)
});

const allowedChars_posInteger = new Set("0123456789");
$(".positive-integer-input").on("keypress", function (e) {
  var key = e.originalEvent.key;
  var val = 0;
  if (this.value != "") val = parseInt(this.value);

  if (val == 0 && key == "0") {
    return false;
  } else return allowedChars_posInteger.has(e.originalEvent.key);
});
const allowedChars_Float = new Set("0123456789+-.Ee");
$(".float-input").on("keypress", function (e) {
  return allowedChars_Float.has(e.originalEvent.key);
});


