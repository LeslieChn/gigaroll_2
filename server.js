//Dependencies
var express = require ("express");
const http = require('http');
const https = require('https');
const fs = require('fs');
const fetch = require('node-fetch');
const { cpuUsage } = require("process");
const path = require('path');


const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };

//Set Up Express
var app = express();
var PORT = process.env.PORT || 8080;

//Express Data Parsing
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static('public'))

//Routes
// require("./app/routing/htmlRoutes") (app);
// require("./app/routing/apiRoutes") (app);

//Listener
//app.listen(PORT, function() {
//console.log("App listening on Port: "+ PORT);
//});

var httpServer = http.createServer(app);
var httpsServer = https.createServer(options, app)
httpServer.listen(8080, function()
{
    console.log("http server listening on port 8080")
});
httpsServer.listen(8001, function()
{
      console.log("https server listening on port 8001")
});

/*****************************************************************/
var queryURL = "http://127.0.0.1:80/req?";

app.post('/gserver/:query', async (request, response) => {
    
    console.time(request.params.query);
    
    //only comment in the following to simulate a delay
    //await new Promise(r => setTimeout(r, 1000));
    const server_url = queryURL + request.params.query;
    const server_response = await fetch(server_url);
    const server_json = await server_response.json();
  
    response.json(server_json);
    console.timeEnd(request.params.query)
  });
  