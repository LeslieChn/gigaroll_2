function subscribe()
{

    let email = $("#email").val()
    let first_name = $("#firstName").val()
    let last_name = $("#lastName").val()
    let address = $("#address").val()
    let city = $("#city").val()
    let state = $("#state").val()
    let zip = $("#zip").val()
    let country = $("#country").val()

    let data = {
        first_name : first_name,
        last_name : last_name,
        address : address,
        city : city,
        state : state,
        zip : zip,
        country : country,
        email : email
    }

    console.log(data)

    $.ajax({
        type: "POST",
        url: `/subscribe`,
        data: JSON.stringify({data:data}),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
      });
}

$('#subscribe').on('click', subscribe)