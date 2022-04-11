const stripe = Stripe("pk_test_51KHqxAKquseRsK4mDO8BjsJEmRVkNX7O0cCaQNJqW2rCgBPqnjP7DC6lpmHwP5OPjVkWmxmh4jiLLYe0RRUIKOXp004H2O425f");

// Retrieve the "setup_intent_client_secret" query parameter appended to
// your return_url by Stripe.js
const clientSecret = new URLSearchParams(window.location.search).get(
    'setup_intent_client_secret'
  );
  
  // Retrieve the SetupIntent
  stripe.retrieveSetupIntent(clientSecret).then(({setupIntent}) => {
    const message = document.querySelector('#message')
  
    // Inspect the SetupIntent `status` to indicate the status of the payment
    // to your customer.
    //
    // Some payment methods will [immediately succeed or fail][0] upon
    // confirmation, while others will first enter a `processing` state.
    //
    // [0]: https://stripe.com/docs/payments/payment-methods#payment-notification
    switch (setupIntent.status) {
      case 'succeeded': {
        message.innerText = 'Success! Your payment method has been saved.';
        break;
      }
  
      case 'processing': {
        message.innerText = "Processing payment details. We'll update you when processing is complete.";
        break;
      }
  
      case 'requires_payment_method': {
        message.innerText = 'Failed to process payment details. Please try another payment method.';
  
        // Redirect your user back to your payment page to attempt collecting
        // payment again
  
        break;
      }
    }
  });