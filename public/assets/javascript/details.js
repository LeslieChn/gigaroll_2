async function serverRequest(params) {
  p = new URLSearchParams(params).toString();

  const api_url = `gserver/${p}`;

  var request = new Request(api_url, { method: "POST" });

  const response = await fetch(request);
  const json = await response.json();

  return json;
}

var grid=null


function updateGrid(server_js) {
  $("#wrapper").html("");
  
  var headers= [];
  
  var data=[]
  var prev_gby = ''
  var row_num = 1

  for (let row of server_js){
    data.push(row)
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
  }
  else
  { 
    grid.updateConfig(config)
    grid.forceRender()
  }
   
}
function processResp(resp)
{
  updateGrid(resp);
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
  
  serverRequest(params).then(processResp);

} //initPage




$(document).ready(InitPage);