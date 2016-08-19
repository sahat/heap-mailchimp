var express = require('express');
var qs = require('querystring');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var request = require('request');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.set('port', process.env.PORT || '3000');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: 'secret'
}));

// App routes
app.get('/', function(req, res, next) {
  res.render('index', {
    accessToken: req.session.accessToken,
    params: qs.stringify({
      client_id: '901979316119',
      redirect_uri: 'http://127.0.0.1:3000/oauth/mailchimp/callback',
      response_type: 'code'
    })
  });
});

app.get('/oauth/mailchimp/callback', function(req, res) {
  var accessTokenUrl = 'https://login.mailchimp.com/oauth2/token';
  var params = {
    code: req.query.code,
    client_id: '901979316119',
    client_secret: '3b72d473c290a903713a371459763f56',
    redirect_uri: 'http://127.0.0.1:3000/oauth/mailchimp/callback',
    grant_type: 'authorization_code'
  };

  // Exchange authorization code for access token
  request.post({ url: accessTokenUrl, form: params, json: true }, function(error, response, body) {
    console.log(body.access_token);
    req.session.accessToken = body.access_token;
    res.redirect('/');
  });
});

app.get('/oauth/mailchimp/unlink', function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// development error handler
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

app.listen(app.get('port'), function () {
  console.log('Express app listening on port ' + app.get('port') + '!');
});