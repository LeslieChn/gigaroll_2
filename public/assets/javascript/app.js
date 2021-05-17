var queryURL = "http://127.0.0.1/req?";

 async function serverRequest(url,params) {
	 
  url += (new URLSearchParams( params ) ).toString();
  const request = new Request(url, {method: 'GET'}); 
  const  resp = await fetch(request);
  js =  await resp.json()
  return js
  };

function Comma_Sep (a) {
  var s = "";


  for (i=0; i<a.length; i++) {

    s+=a[i];

    if(i<a.length-1)
      s+=",";

  };

  return s;
};

function formatNumber(num) {
  return num.toLocaleString('en')
}

var base_dim= ""
var all_group_bys=[];//= ["city", "postal_code", "county", "state_code","prop_type", "prop_status"]; 
var all_dim_measures={}
var all_measures=[];//["beds", "baths", "size", "price", "year_built", "elevation" ];
var all_funcs=[];// ["avg", "sum", "count", "max", "min"];
var last_index = 0
var used_indices = new Set()
var used_gby_indices = new Set()


async function InitPage() {
  console.log("ready!");
  var dim_info = null
  dim_info = await serverRequest (queryURL, {"qid":"GET_DIMS"})

  if (dim_info==null){
    alert("couldn't get dim info from server")
  }
  for (const [dim, traits] of Object.entries(dim_info)) {
      if (traits["num_dim_attribs"]>0 && traits["num_val_attribs"]>0){
        base_dim=dim;
        break
      }
  }
  console.log(base_dim);
  if (base_dim==""){
    alert("couldn't find base dim");
  };

  all_group_bys = await serverRequest (queryURL, {"qid": "GET_DIM_DIMATTRIBS", "dim": base_dim} )
  all_funcs = await serverRequest (queryURL, {"qid": "GET_SUMM_FUNCS"})
  all_dim_measures = await serverRequest (queryURL, {"qid": "GET_DIM_MEASURES", "dim": base_dim} )
  all_measures = all_dim_measures[base_dim]

  var ddrangedim=$("#rangedimdd")

  for ([d, measures] of Object.entries(all_dim_measures)){
    var rangeitem = $(`<option value=${d}>${d}</option>`);
    ddrangedim.append(rangeitem);
  }
  ddrangedim.trigger("change")
  //add a row for gby and measure
  //the delete button for the first row
  //will not be added in the call back
  
  $("#addrow").trigger("click")
  $("#addgbyrow").trigger("click")

  console.log(dim_info);

}//initPage

  //selected_* arrays should be of the form array of strings
  // each element of selected_vals should be of the form measure:func
  function onclick_addGbyRow() {
    var str_row;
    var gbytable =  $("#gbytable");
    //create unique id's for the dropdowns
    
    var ddgroupby= "ddgroupby"+ last_index;
    
    used_gby_indices.add(last_index);
  
    str_row = "<tr id="+"gbytablerow"+last_index+">" ; 
    str_row += "<td><select class='form-select'aria-label='Default select example' id="+ddgroupby+"></select></td>";
	if (used_gby_indices.size > 1)
		str_row += "<td><button class='btn btn-warning delete-gbyrow-class'type='button' value="+last_index+">Delete</button></td>";
    str_row += "</tr>";
    gbytable.append(str_row);
  
    ++last_index;
  
    var dropdowngby = $("#"+ddgroupby);

    for (j = 0; j<all_group_bys.length; j++) {
      dropdowngby.append("<option value="+all_group_bys[j]+">"+all_group_bys[j]+"</option>")
    };

	if (used_gby_indices.size == 1)
       dropdowngby.append(`<option style="background-color:SandyBrown" value="RANGE">RANGE</option>`)
  }
  /*******************************************************************************************/
function onclick_addMeasureRow() {
  var str_row;
  var measuretable =  $("#measuretable");
  //create unique id's for the dropdowns
  
  var ddmeasure_id = "ddmeasure"+ last_index;
  var ddfunc_id = "ddfunc" + last_index;
  
  used_indices.add(last_index);

  str_row = "<tr id="+"measuretablerow"+last_index+">" ; 
  str_row += "<td><select class='form-select'aria-label='Default select example' id="+ddmeasure_id+"></select></td>";
  str_row += "<td><select class='form-select'aria-label='Default select example' id="+ddfunc_id+"></select></td>";
  if (used_indices.size > 1)
	str_row += "<td><button class='btn btn-warning delete-row-class'type='button' value="+last_index+">Delete</button></td>";
  str_row += "</tr>";
  measuretable.append(str_row);

  ++last_index;

  var dropdownmeasure = $("#"+ddmeasure_id);
  var dropdownfunc = $("#"+ddfunc_id);

  for (j = 0; j<all_measures.length; j++) {
    dropdownmeasure.append("<option value="+all_measures[j]+">"+all_measures[j]+"</option>")
  };

  for (k = 0; k<all_funcs.length; k++) {
    dropdownfunc.append("<option value="+all_funcs[k]+">"+all_funcs[k]+"</option>")
  };
}

function getRangeDef () {
  var range_dim= $("#rangedimdd").val();
  var range_val= $("#rangemeasuredd").val();
  var range_start = parseFloat($("#rangeStart").val())
  var range_size = parseFloat($("#rangeSize").val())
  var range_buckets = parseInt($("#numBuckets").val())
  if (isNaN(range_start) || isNaN(range_size)|| isNaN(range_buckets)){
      alert("Range definition is incomplete!")
      return "";
  }
  var range_def='range(' + range_dim + ':' + range_val + ';' + range_start + ';' + range_size + ';' + range_buckets + ')'
  return range_def;
}

function getSelectedGbys (){
  var g_array = []
  for (let idx of used_gby_indices){
    var ddgroupby = "#ddgroupby"+idx;
    var selected_gby = $(ddgroupby).val();
    if(selected_gby=="RANGE"){
      var range_def=getRangeDef()
      g_array.push(range_def)
    }
    else 
      g_array.push(selected_gby);
  }
  return g_array;
}


function getSelectedMeasures (){
  var m_array = []
  for (let idx of used_indices){
    var ddmeasure_id = "#ddmeasure"+idx;
    var ddfunc_id = "#ddfunc"+idx;
    var selected_val = $(ddmeasure_id).val();
    selected_val+=":"+$(ddfunc_id).val();
    m_array.push(selected_val);
  }
  return m_array;
}

//two palettes, each with two colors (for odd and even rows)
const table_row_colors = [ ["#F0FFFF", "#F9FFFF"], ["#FFFFF0", "#FFFFF9"] ];

function onclick_submit (){

  var selected_gbys = getSelectedGbys();
  console.log(selected_gbys);
  var selected_vals = getSelectedMeasures();
  console.log(selected_vals);

  //var selected_funcs = $('#allFuncs option:selected').val();
  //console.log(selected_funcs);
 // dim=property&gby=prop_type&val=beds:count";

  console.log(queryURL);

  var server_js;

  var params = {
    "qid": "MD_AGG",
    "dim" : base_dim,
  };

  params ["gby"] = Comma_Sep (selected_gbys);
  params ["val"] = Comma_Sep (selected_vals)


  $.ajax({
    url: queryURL,
    data:params,
    method: "GET",
  }).then(function (response) {
    console.time("process response")
    server_js = response;
  
    var tblhead = $("#tableHead");
    tblhead.html("");

    tblhead.append("<th scope='col'>Row</th>")


    for (i = 0; i <selected_gbys.length; i++){
      tblhead.append("<th scope='col'>"+selected_gbys[i]+"</th>")
    };

    for (i = 0; i <selected_vals.length; i++){
      tblhead.append("<th scope='col'>"+selected_vals[i]+"</th>")
    };

    var tbl = $("#resultsTable");
    tbl.html("");
    var str_row=""
    var prev_gby=""
	var row_palette = 0
	var row_color = 0
	
    for (i = 0; i < server_js.length; i++) {
      const row = server_js[i];
    
      //populate the groupby
      const gbys = row[0];
      const vals = row[1];
	  var border_width = "thin"
	  
	  //choose the row color
	  if (gbys[0] != prev_gby && gbys.length > 1)
	  {
		  //if we started a new block (based on the first gby)
		  //switch the palette
		  //but only do this if we have more than one gby
		  
		  row_palette = 1 - row_palette
		  row_color = 0
		  border_width = "thick"
	  }
	  else 
		row_color = 1 - row_color //alternate the row color

	  var bcolor = table_row_colors[row_palette][row_color]
      str_row += `<tr  style= background-color:${bcolor}">` ; 
	  var cell_style = `style="background-color:${bcolor};border-top: ${border_width} solid"`
	  
      str_row += `<td ${cell_style}>${i+1}</td>`;
	  //console.log("row: %d  pal: %d  col: %d", i+1, row_palette, row_color)

	  
      for (g = 0; g < gbys.length; g++) {
        var gby = gbys[g]
		var opacity = 1;
        if (g==0 && gby==prev_gby)
		{
          //gby=" "
		  opacity=0.25
		}

			
        str_row += `<td style="opacity:${opacity};background-color:${bcolor};border-top: ${border_width} solid"><b>${gby}</b></td>`;
      }		
	  
      prev_gby = gbys[0]
      for (v = 0; v < vals.length; v++) {
        str_row+= `<td ${cell_style}><b>${formatNumber(vals[v])}</b></td>`;
      }
      str_row += "</tr>";
      if (i%100==99){
        tbl.append(str_row)
        str_row=""
      }
    }
    tbl.append(str_row);
    console.timeEnd("process response")
  })
}

$(document).ready(InitPage);
$(document).on("click", "#submitButton", onclick_submit);
$(document).on("click", "#addrow", onclick_addMeasureRow);
$(document).on("click", "#addgbyrow", onclick_addGbyRow);

$(document).on('hidden.bs.collapse', "#allgroupbys2", function (e) {
  var gby_str = "Chosen Groupbys : "
  for (let idx of used_gby_indices) {
    var ddgroupby= "#ddgroupby"+idx;
    var selected_gby = $(ddgroupby).val();
    gby_str+=selected_gby+" " 
  }
  $("#groupbystring").html(gby_str)
})

$(document).on('hidden.bs.collapse', "#allmeasures2", function (e) {
  var msr_str = "Chosen Measures : "

  for (let idx of used_indices) {
    var ddmeasure_id = "#ddmeasure"+idx;
    var ddfunc_id = "#ddfunc"+idx;
    var selected_val = $(ddmeasure_id).val();
    selected_val+=":"+$(ddfunc_id).val();
    msr_str+=selected_val+" " 
  }
  $("#measurestring").html(msr_str)
});

$(document).on('show.bs.collapse', "#allgroupbys2", function (e) {
  $("#groupbystring").html("")
});

$(document).on('show.bs.collapse', "#allmeasures2", function (e) {
  $("#measurestring").html("")
});

$(document).on("click", ".delete-gbyrow-class", function (e) { 
  var index = parseInt(this.value)
  $("#gbytablerow"+index).remove();
  used_gby_indices.delete(index);
});

$(document).on("click", ".delete-row-class", function (e) { 
  var index = parseInt(this.value)
  $("#measuretablerow"+index).remove();
  used_indices.delete(index);
});

$("#rangedimdd").on("change",function() {
  var dim=$("#rangedimdd").val()
  console.log(dim)
  var ddrangemeasure=$("#rangemeasuredd")
  ddrangemeasure.html("")
  for (measure of all_dim_measures[dim]){
    ddrangemeasure.append("<option value="+measure+">"+measure+"</option>")
  }
});
const allowedChars_posInteger = new Set ("0123456789")
$(".positive-integer-input").on("keypress",function(e) {
   var key=e.originalEvent.key
   var val= 0
   if (this.value != "") 
    val = parseInt(this.value)

  if ( val==0 && key=="0"){
    return false
  }
  else 
    return allowedChars_posInteger.has(e.originalEvent.key)
   
}
);
const allowedChars_Float = new Set ("0123456789+-.Ee")
$(".float-input").on("keypress",function(e) {
  return allowedChars_Float.has(e.originalEvent.key)
  }
);

