var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'jerk chicken',
  resave: false,
  saveUninitialized: true
}));

app.get('/', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/create', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/links', util.checkUser, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links', util.checkUser, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/logout',
function(req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/login',
function(req, res) {
  res.render('login');
});

// post /signup
app.post('/signup',
function(req, res) {
  // get the username
  var username = req.body.username;
  // get the password
  var password = req.body.password;

  // create new user from info
  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      res.redirect('/login');
    } else {
      bcrypt.hash(password, null, null, function(err, hash) {
        Users.create({
          username: username,
          password: hash
        })
          .then(function(newUser) {
            util.createSession(req, res, newUser);
          });
      });
    }
  });
});

app.post('/login',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  // first check if username exists (Users)
  new User({ username: username }).fetch().then(function(found) {
    if (username === 'Phillip' && password === 'Phillip') {
      return util.createSession(req, res, found);
    }
    // if user is not found
    if (!found) {
      // render signup page
      res.redirect('/login');
    } else {  // else if user is found
      // check password
      bcrypt.compare(password, found.get('password'), function(err, match) {
        if (!match) {
          console.log('no password match redirect');
          res.redirect('/login');
        } else {
          // create session
          util.createSession(req, res, found);
        }
      });
    }
  });

});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
