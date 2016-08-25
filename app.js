var express = require('express');
var qs = require('querystring');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var request = require('request');
var heap = require('heap-api');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');
app.set('port', process.env.PORT || '3000');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: 'secret'
}));

app.get('/', function(req, res) {
  res.render('index', {
    metadata: JSON.stringify(req.session.metadata, null, 2),
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
  var metadataUrl = 'https://login.mailchimp.com/oauth2/metadata';
  var params = {
    code: req.query.code,
    client_id: '901979316119',
    client_secret: '3b72d473c290a903713a371459763f56',
    redirect_uri: 'http://127.0.0.1:3000/oauth/mailchimp/callback',
    grant_type: 'authorization_code'
  };

  // Exchange authorization code for access token
  request.post({ url: accessTokenUrl, form: params, json: true }, function(error, response, body) {
    req.session.accessToken = body.access_token;

    // Get user metadata
    var headers = { Authorization: 'OAuth ' + req.session.accessToken };
    request.get({ url: metadataUrl, headers: headers, json: true }, function (error, response, body) {
      req.session.metadata = body;
      res.redirect('/');
    });
  });
});

app.get('/oauth/mailchimp/unlink', function(req, res) {
  req.session.destroy();
  res.redirect('/');
});

app.post('/reports', function(req, res) {
  var baseUrl = req.session.metadata.api_endpoint;
  var reportsUrl = baseUrl + '/3.0/reports';
  var headers = { Authorization: 'OAuth ' + req.session.accessToken };

  request.get({ url: reportsUrl, headers: headers, json: true }, function(error, response, body) {
    res.send(200);
  });
});

app.post('/activity', function(req, res) {
  var appId = req.body.appId;
  var baseUrl = req.body.metadata.api_endpoint;
  var listsUrl = [baseUrl, '/3.0/lists'].join('');
  var headers = { Authorization: 'OAuth ' + req.body.accessToken };

  // Get all MailChimp lists
  request.get({ url: listsUrl, headers: headers, json: true }, function(error, response, body) {

    var listId = body.lists[0].id;
    var membersUrl = [baseUrl, '/3.0/lists/', listId, '/members'].join('');

    // Get all members for a given list
    request.get({ url: membersUrl, headers: headers, json: true }, function(error, response, body) {
      var promises = [];
      var emailMap = {};
      body.members.forEach(function(member) {
        emailMap[member.id] = member.email_address;
        var promise = new Promise(function(resolve, reject) {
          var memberActivityUrl = [baseUrl, '/3.0/lists/', listId, '/members/', member.id, '/activity'].join('');
          request.get({ url: memberActivityUrl, headers: headers, json: true }, function(error, response, body) {
            resolve(body);
          });
        });
        promises.push(promise);
      });
      Promise.all(promises).then(function(values) {
        values.forEach(function(member) {
          member.activity.forEach(function(activity) {
            heap(appId).track(activity.action, emailMap[member.email_id], {
              timestamp: activity.timestamp,
              url: activity.url,
              type: activity.type,
              campaign_id: activity.campaign_id,
              title: activity.title,
              parent_campaign: activity.parent_campaign
            });
          });
          res.status(200).end();
        });
      });
    });
  });
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
    console.error(err);
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
