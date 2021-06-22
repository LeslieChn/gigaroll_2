var db = require("../db");
var passport = require("../config/passport");
var axios = require("axios");


module.exports = function(app) {


  // Route for signing up a user. The user's password is automatically hashed and stored securely thanks to
  // how we configured our Sequelize User Model. If the user is created successfully, proceed to log the user in,
  // otherwise send back an error
  app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

  // Route for logging user out
  app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
  });

  // Route for getting some data about our user to be used client side
  app.get("/api/user_data", function(req, res) {
    if (!req.user) {
      // The user is not logged in, send back an empty object
      res.json({});
    }
    else {
      // Otherwise send back the user's username and id
      // Sending back a password, even a hashed password, isn't a good idea
      res.json({
        username: req.user.username,
        id: req.user.id
      });
      // res.json({req});
    }
  });


  app.post("/api/review",function(req, res){
    db.Review.create(req.body)
    .then(function(dbReview) {
      res.json(dbReview);
    });
  })

  app.post("/api/favorite",function(req, res){
    db.Favorite.create(req.body)
    .then(function(dbFavorite) {
      res.json(dbFavorite);
    });
  })

  app.delete("/api/favorite/:id", function(req, res){
    db.Favorite.destroy({
      where: {
        id: req.params.id
      }
    }).then(function(dbfavorite) {
      res.json(dbfavorite);
    });
  })
};
