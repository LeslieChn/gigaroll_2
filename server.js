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
const chargebee = require('chargebee')
const stripe = require('stripe')('sk_test_51KHqxAKquseRsK4mYoF4Nvf9PhzOcxJgxea49JEiLHA9NtJK0IYAyCWNd6j2Rug7rBlUKaxsT57v0k9Wuy60bero00BVAakyvH')

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



// app.get("/create-setup-intent", async (req, res) => {

//   // Alternatively, set up a webhook to listen for the payment_intent.succeeded event

//   // and attach the PaymentMethod to a new Customer

//   const customer = await stripe.customers.create();

//   // Create a SetupIntent 

//   const setupIntent = await stripe.setupIntents.create({

//     customer: customer.id,
//     payment_method_types: ['card'],

//   });

//   console.log(setupIntent)


//   res.send({

//     clientSecret: setupIntent.client_secret,

//   });

// });

app.post("/confirm_payment", async (req, res) => {

  let intent = {}

  try {

      let payment_method_id = req.body.payment_method_id
      let payment_intent_id = req.body.payment_intent_id
      
      if (payment_method_id) {
          console.log('before')
          // Calling chargebee's create_subscription_estimate api
          let estimate = await getSubscriptionEstimate(req.body);
          console.log('chargebee estimate:' + estimate)
          // Creating payment intent in Stripe
          intent = await stripe.paymentIntents.create({
            payment_method: payment_method_id,
            amount: estimate.invoice_estimate.total,
            currency : estimate.invoice_estimate.currency_code,
            confirm : true,
            confirmation_method : 'manual',
            capture_method: 'manual',
            setup_future_usage : 'off_session'
          });

      } else if (payment_intent_id) {
          // Confirming the payment intent in stripe
          intent = await stripe.paymentIntents.retrieve(payment_intent_id);
          intent = intent.confirm();
      }
      res.json(generatePaymentResponse(intent));
    } catch(error) {
      res.json(error);
  }

async function getSubscriptionEstimate(data) {

    chargebee.configure({site : "gigaroll-test",
    api_key : "test_wrDdypdnRUyv9AGASEsZ6VQomgmjk5R4"})
    
    let ce = chargebee.estimate.create_sub_item_estimate({
    billing_address : {
      line1 : data.addr,
      line2 : data.extended_addr,
      city : data.city,
      zip : data.zip,
      country : data.country
      },
      customer : {
        taxability : "taxable"
      },
      subscription_items : [
        {
          item_price_id : "cbdemo_basic-USD-monthly",
          billing_cycles : 2,
          quantity : 1
        }
      ]
    });
    // await ce.request(function(error,result) {
    // if(error){
    //   //handle error
    //   console.log(error);
    // }
    // else{
    //   console.log(result);
    //   // estimate = result.estimate;
    // }
    // });
    //   return await result.estimate;
    return new Promise((resolve, reject) => {
      ce.request(function(error,result)
        {
          if(error) {
            reject(error)
          }
          else 
          {
            resolve(result.estimate)
            console.log(result)
          }
        })
      });
    }
    function generatePaymentResponse(intent) {

      console.log(intent);

      if ((intent.status == 'requires_source_action' || intent.status == 'requires_action') &&
          intent.next_action.type == 'use_stripe_sdk') {
          // Inform the client to handle the action
          return {
              requires_action : true,
              payment_intent_client_secret : intent.client_secret
            }
      }
      else if (intent.status == 'requires_capture') {
          // The payment didn’t need any additional actions it just needs to be captured
          //  Now can pass this on to chargebee for creating subscription
          return {
              success: true,
              payment_intent_id : intent.id
          }
      }
      else {
          //  Invalid status
          return {
              success : false,
              error : intent.status
          };
      }
  }
  
  
})

app.post("/checkout", async (req, res) => {
  let result = {}
  // validateParameters(req.body);
    try {
         let customer = await createCbCustomer(req.body);
         result = await createSubscription(customer.id, req.body);
        // addShippingAddress(result.subscription, result.customer, req.body);

        /*
         * Forwarding to success page after successful create subscription in ChargeBee.
      */

      res.json(result)
      // res.redirect('/thankyou', '/url?' + querystring.stringify(result))
        
    } catch(e) {
      res.json(e)
      console.log(e)
    }

  async function createCbCustomer (data)
  {
    chargebee.configure({site : "gigaroll-test",
    api_key : "test_wrDdypdnRUyv9AGASEsZ6VQomgmjk5R4"})

    let cc = chargebee.customer.create({
      first_name: data.customer.first_name,
      last_name: data.customer.last_name,
      email: data.customer.email,
      phone: data.customer.phone,
      locale : "en-US",
      billing_address : {
        first_name: data.customer.first_name,
        last_name: data.customer.last_name,
        line1 : data.addr,
        line2 : data.extended_addr,
        city : data.city,
        zip : data.zip,
        country : data.country
        }
    });

    return new Promise((resolve, reject) => {
      cc.request(function(error,result)
        {
          if(error) {
            reject(error)
            console.log(error)
          }
          else 
          {
            resolve(result.customer)
            console.log(result)
          }
        })
      });
  }

    async function createSubscription(id, data) {
    
      /*
       * Constructing a parameter array for create subscription api. 
       * It will have account information, the payment intent got from Stripe and
       * plan details.
       * For demo purpose a plan with id 'basic' is hard coded.
       * Other params are obtained from request object.
       * Note : Here customer object received from client side is sent directly 
       *        to ChargeBee.
       *               
       */
      const customer_id = id

      const createSubscriptionParams = {
        subscription_items : [
          {
            item_price_id : "cbdemo_basic-USD-monthly",
            billing_cycles : 2,
            quantity : 1
          }],
          shipping_address : {
            first_name: data.customer.first_name,
            last_name: data.customer.last_name,
            email: data.customer.email,
            phone: data.customer.phone,
            line1: data.addr,
            line2: data.extended_addr,
            city: data.city,
            state: data.state,
            zip: data.zip_code
          },
          payment_intent : {
              gw_token : data.payment_intent_id,
              gateway_account_id : 'gw_16CGg6SxXexRTG5X'
            }
      };
  
      /* 
      * Sending request to the chargebee server to create the subscription from 
      * the parameters received. The result will have customer,subscription and 
      * card attributes.
      */
      chargebee.configure({site : "gigaroll-test",
      api_key : "test_wrDdypdnRUyv9AGASEsZ6VQomgmjk5R4"})
      let cs = chargebee.subscription.create_with_items(customer_id, createSubscriptionParams);

      return new Promise((resolve, reject) => {
        cs.request(function(error,result)
          {
            if(error) {
              reject(error)
              console.log(error)
            }
            else 
            {
              resolve(result)
              console.log(result)
            }
          })
        });
  }
  
  /*
   * Adds the shipping address to an existing subscription. The first name
   * & the last name for the shipping address is got from the customer 
   * account information.
   */
  function addShippingAddress(subscription, customer, data) {
     /* 
      * Adding address to the subscription for shipping product to the customer.
      * Sends request to the ChargeBee server and adds the shipping address 
      * for the given subscription Id.
      */
      let result = chargebee.address.update({
                  subscription_id : subscription.id,
                  label : "shipping_address",
                  first_name: customer.firstName,
                  last_name : customer.lastName,
                  addr : data.addr,
                  extended_addr: data.extended_addr,
                  city : data.city,
                  state : data.state,
                  zip: data.zip_code
                }).request(function(error,result) {
                  if(error){
                    //handle error
                    console.log(error);
                  }else{
                    console.log(result);
                    ;
                  }
                });
      var address = result.address
      return address
}
});

// app.post('/signup', async (req, res) => {

// let customer = req.body 

// customer.payment_method = {
//   gateway : "stripe",
//   gateway_account_id : acct_1KHqxAKquseRsK4m,
//   first_name : customer.first_name,
//   last_name : customer.last_name,
//   object : "payment_method",
//   reference_id :`${customer_id}/${card_id}`,
//   status : "valid",
//   type: "card"
// }

// chargebee.configure({site : "gigaroll",
//   api_key : "live_eXNaZ4dTg0AwM97wcdRvyDjzm08qZ2wTw"})
// chargebee.customer.create(customer).request(function(error,result) {
//   if(error){
//     //handle error
//     console.log(error);
//   }else{
//     console.log(result);
//     var customer = result.customer;
//     var card = result.card;

//     console.log(customer)
//     console.log(card)
//   }
// })

// });


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





  