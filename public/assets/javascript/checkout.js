// This is your test publishable API key.

const stripe = Stripe("pk_test_51KHqxAKquseRsK4mDO8BjsJEmRVkNX7O0cCaQNJqW2rCgBPqnjP7DC6lpmHwP5OPjVkWmxmh4jiLLYe0RRUIKOXp004H2O425f");

// let elements;


// initialize();

// checkStatus();


// document

//   .querySelector("#payment-form")

//   .addEventListener("submit", handleSubmit);


// // Fetches a payment intent and captures the client secret


// async function initialize() {

//   const response = await fetch("/create-setup-intent", {method: "GET"});

//   const { clientSecret } = await response.json();


//   const appearance = {

//     theme: 'stripe',

//   };

//   elements = stripe.elements({ appearance, clientSecret });


//   const paymentElement = elements.create("payment");

//   paymentElement.mount("#payment-element");

// }

var elements = stripe.elements();

var cardElement = elements.create('card');

cardElement.mount('#payment-element');
document

  .querySelector("#payment-form")

  .addEventListener("submit", handleSubmit);    

initPage();

async function initPage(){
    

  let sub_status = await getUserKeyVal('chargebee_acct_id')

  console.log(`sub status: ${sub_status}`)
}

async function handleSubmit(e) {

  e.preventDefault();

  setLoading(true);

  stripe.createPaymentMethod('card', cardElement, {})
            
  .then( async function (result) {
      if (result.error) {
        showMessage(result.message);
      } else {
          console.log(result.paymentMethod.id);
          //Otherwise send paymentMethod.id to your server
          
         let res = await fetch('/confirm_payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  payment_method_id: result.paymentMethod.id,
                  addr: $('#address').val(),
                  extended_addr: $('#address2').val(),
                  city: $('#city').val(),
                  state: $('#state').val(),
                  zip_code: $('#zip').val(),
                  country: $('#country').val(),
              })
        })

        let server_res = await res.json()
     
        handleServerResponse(server_res); 

      }
  });

  // const { error } = await stripe.confirmSetup({

  //   elements,

  //   confirmParams: {

  //     // Make sure to change this to your setup completion page

  //     return_url: "http://localhost:8080/signup.html",

  //   }
  // });

  // if (error) {

  //   showMessage(error.message);

  // } else {

  //   showMessage("An unexpected error occured.");

  // }


  setLoading(false);

}

function handleServerResponse(response) {
  if (response.error) {
      showMessage(error.message);
  } else if (response.requires_action) {
      // Use Stripe.js to handle required card action
      handleAction(response);
  } else {
      console.log("payment_intent_id: ", response.payment_intent_id, "success: ", response.success);
      // Show success message and call create subscription
      
      fetch('/checkout', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              customer: {
                  first_name: $('#firstName').val(),
                  last_name: $('#lastName').val(),
                  email: $('#email').val(),
                  phone: $('#phone').val()
              },
              addr: $('#address').val(),
              extended_addr: $('#address2').val(),
              city: $('#city').val(),
              state: $('#state').val(),
              zip_code: $('#zip').val(),
              payment_intent_id: response.payment_intent_id,
          })
      }).then(response => response.json()).then(function (responseJSON) {
        //   window.location.replace(responseJSON.forward);
        console.log(responseJSON) 
        setUserKeyVal('chargebee_acct_id', responseJSON.customer.id);
      });
      
  }
}

function handleAction(response) {
  stripe.handleCardAction(
      response.payment_intent_client_secret
  ).then(function (result) {
      if (result.error) {
          // Show error in payment form
          console.log(JSON.stringify(result));
          showMessage(result.error.message);
      } else {
          // The card action has been handled
          // The PaymentIntent can be confirmed again on the server
          fetch('/confirm_payment', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                  payment_intent_id: result.paymentIntent.id
              })
          }).then(response => response.json()).then(function (confirmResult) {
              console.log("payment_intent_id: ", confirmResult.payment_intent_id, "success: ", confirmResult.success);
              handleServerResponse(confirmResult);
          });
      }
  });
}

async function getUserKeyVal (key) 
{
  let res1 = await fetch('/get_user_key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({key:key})
  })
  let json = await res1.json()
  return json.value
}

async function setUserKeyVal(key, value) {
  // let res1 = await fetch('/get_user_key', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: '{"key":"displayName"}'
  // })
  // let json = await res1.json()
  // console.log(json)
  let body = `{"${key}" : "${value}"}`

  console.log(body)

  let res = await fetch('/update_user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body
  })

  let json = await res.json()
}

// Fetches the setup intent status after setup submission

// async function checkStatus() {

//   const clientSecret = new URLSearchParams(window.location.search).get(

//     "setup_intent_client_secret"

//   );


//   if (!clientSecret) {

//     return;

//   }


//   const { setupIntent } = await stripe.retrieveSetupIntent(clientSecret);

//   console.log(setupIntent.status)

//   switch (setupIntent.status) {

//     case "succeeded":

//       showMessage("Setup succeeded!");

//       break;

//     case "processing":

//       showMessage("Your Setup is processing.");

//       break;

//     case "requires_payment_method":

//       showMessage("Your setup was not successful, please try again.");

//       break;

//     default:

//       showMessage("Something went wrong.");

//       break;

//   }

// }


// ------- UI helpers -------


function showMessage(messageText) {

  const messageContainer = document.querySelector("#setup-message");


  messageContainer.classList.remove("hidden");

  messageContainer.textContent = messageText;


  setTimeout(function () {

    messageContainer.classList.add("hidden");

    messageText.textContent = "";

  }, 4000);

}


// Show a spinner on setup submission

function setLoading(isLoading) {

  if (isLoading) {

    // Disable the button and show a spinner

    document.querySelector("#submit").disabled = true;

    document.querySelector("#spinner").classList.remove("hidden");

    document.querySelector("#button-text").classList.add("hidden");

  } else {

    document.querySelector("#submit").disabled = false;

    document.querySelector("#spinner").classList.add("hidden");

    document.querySelector("#button-text").classList.remove("hidden");

  }

}