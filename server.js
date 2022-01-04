//Dependencies
const express = require ("express");
const session = require ("express-session")
const bodyParser = require ("body-parser")
const http = require('http');
const https = require('https');
const fs = require('fs');
const fetch = require('node-fetch');
const compression = require('compression');
const { cpuUsage } = require("process");
const path = require('path');
const passport = require('passport');
const Strategy = require('passport-local').Strategy;
const db = require('./db');
const md5 = require('md5');
const salt = 'cardamom'
const flash = require ('connect-flash')
const got = require('got');

var login_count = {}

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

    if (!(username in login_count))
      login_count[username]=0

    let count = ++login_count[username]
    db.users.findByUsername(username, function(err, user) {
      if (err) {return cb(err); }
      if (!user) {
        console.log(`login attempt ${count} by non-existent user ${username} failed`)
        return cb(null, false); 
      }
      if (user.password != hashPassword(password)) 
      { 
        console.log(`login attempt ${count} by user ${username} failed with bad password`)
        return cb(null, false); 
      }
      console.log(`login attempt ${count} by user ${username} succeeded`)
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
var HTTP_PORT = process.env.GR_HTTP_PORT || 8080;
var HTTPS_PORT = process.env.GR_HTTPS_PORT || 8001;

//Express Data Parsing
app.use(express.urlencoded({extended:false}));
app.use(express.json());
app.use(express.static('public'))



// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('body-parser').text({ type: 'text/html' }))
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false,  cookie: { sameSite: 'strict' }}));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// Connect flash
app.use(flash());

// Global variables
app.use(function(req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// Make sure maps are being cached by the browser
app.use(function (req, res, next)
{
    if (req.url.includes("map_"))
    {
        res.setHeader('Cache-Control', 'public, max-age=3600'); // cache header
    }
    next();
});

// Compression
const shouldCompress = (req, res) =>
{
    if (req.headers['x-no-compression'])
    {
        // don't compress responses if this request header is present
        return false;
    }

    // fallback to standard compression
    return compression.filter(req, res);
};

app.use(compression({
    // filter decides if the response should be compressed or not,
    // based on the `shouldCompress` function above
    filter: shouldCompress,
    // threshold is the byte threshold for the response body size
    // before compression is considered, the default is 1kb
    threshold: 4096
}));

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

app.post('/getimage/:query', async (request, response) => {
    
  console.time(request.params.query);
  const queryURL = `https://www.zillow.com/homes/`
    //only comment in the following to simulate a delay
  //await new Promise(r => setTimeout(r, 1000));
  const server_url = queryURL + request.params.query + "/";
  
  let server_response
  server_response = await got(server_url,{
    headers: {
      // "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0"
      "Cache-Control": "public, max-age=600"
    }
  });

  let data = server_response.body
  let str = 'https://photos.zillowstatic.com/fp/'

  let pos = data.indexOf('.webp')
  let end = pos + 5  
  let start = data.lastIndexOf(str, pos)
  let img_url = data.substring(start,end)
  pos = end

  response.send(img_url)
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

// app.get('/', 
// require('connect-ensure-login').ensureLoggedIn(),
// function (req, res) {
//   res.redirect('/');
// });

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
  req.flash('success_msg', 'You are logged out');
  res.redirect('/');
});

/*****************************************************************/

var httpServer = http.createServer(app);
var httpsServer = https.createServer(options, app)
if (HTTP_PORT>0)
  {
    httpServer.listen(HTTP_PORT, function()
    {
        console.log(`http server listening on port ${HTTP_PORT}`)
    });
  }
if (HTTPS_PORT>0)
{
  httpsServer.listen(HTTPS_PORT, function()
  {
      console.log(`https server listening on port ${HTTPS_PORT}`)
  });
}





  