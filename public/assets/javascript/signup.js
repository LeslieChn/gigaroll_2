function onClickRegister(){
    let first_name = $('#firstName').val()
    let last_name = $('#lastName').val()
    let email = $('#email').val()
    let address = $('#address').val()
    let city = $('#city').val()
    let state = $('#state').val()
    let zip = $('#zip').val()
    let country = $('#country').val()

    let customer_obj = 
    {
        first_name : first_name,
        last_name : last_name,
        email : email,
        locale : "en-US",
        billing_address : {
            first_name : first_name,
            last_name : last_name,
            line1 : address,
            city : city,
            state : state,
            zip : zip,
            country : "US"
            }
    }

    console.log(customer_obj)

    $.ajax({
        url: '/signup', 
        type: 'POST', 
        contentType: 'application/json', 
        data: JSON.stringify(customer_obj)}
    )
}
$(document).on("click", "#submit", onClickRegister);