//Dependencies
var express = require ("express");

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
app.listen(PORT, function() {
 console.log("App listening on Port: "+ PORT);
});

