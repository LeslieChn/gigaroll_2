//Dependencies
var express = require ("express");
const http = require('http');
const https = require('https');
const fs = require('fs');
const fetch = require('node-fetch');
const { cpuUsage } = require("process");
const path = require('path');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var db = require('./db');
const md5 = require('md5');
const salt = 'cardamom'

function hashPassword (pass){
  return md5(salt+pass)
}

// Configure the local strategy for use by Passport.
//
// The local strategy requires a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(new Strategy(
  function(username, password, cb) {
    db.users.findByUsername(username, function(err, user) {
      if (err) { return cb(err); }
      if (!user) { return cb(null, false); }
      if (user.password != hashPassword(password)) { return cb(null, false); }
      return cb(null, user);
    });
  }));

// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  db.users.findById(id, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };

//Set Up Express
var app = express();
var PORT = process.env.PORT || 8080;


//Express Data Parsing
app.use(express.urlencoded({extended:false}));
app.use(express.json());
app.use(express.static('public'))



// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false,  cookie: { sameSite: 'strict' }}));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

//Routes

var queryURL = "http://127.0.0.1:55555/req?";

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

app.get('/login',
function(req, res){
  res.sendFile(path.join(__dirname, "/public/login.html"))
});

app.post('/login', 
passport.authenticate('local', { failureRedirect: '/login'}),
function(req, res) {
  res.redirect('/');
});

app.use(require('connect-ensure-login').ensureLoggedIn(),express.static('private'))

app.get('/', 
require('connect-ensure-login').ensureLoggedIn(),
function (req, res) {
  res.redirect('/');
});

app.get('/user', 
function(req, res) {
  if (!req.user) {
    // The user is not logged in, send back an empty object
    res.json(null);
  }
  else {
    // Otherwise send back the user's username and id
   res.json(req.user);
  }
});

app.get('/logout',
function(req, res){
  req.logout();
  res.redirect('/');
});


// // Routes
// require("./routes/apiRoutes")(app);
// require("./routes/htmlRoutes")(app);

/*****************************************************************/

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

module.exports = app;




  