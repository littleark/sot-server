#!/bin/env node
Array.prototype.unique = function(a){
  return function(){return this.filter(a)}}(function(a,b,c){return c.indexOf(a,b+1)<0
});

var IPADDRESS = process.env.OPENSHIFT_NODEJS_IP;
var PORT      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

 if (typeof IPADDRESS === "undefined") {
    //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
    //  allows us to run/test the app locally.
    console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
    IPADDRESS = "127.0.0.1";
};

var config = require("./config"),
    http = require('http'), 
    util = require('util'),
    request = require('request'),
    qs = require('querystring');

var app = require('express')();
var fs      = require('fs');
var server = require('http').Server(app);
var io = require('socket.io')(server);

io.set('origins', '*:*');

var LanguageDetect = require('languagedetect');
var lngDetector = new LanguageDetect();

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', 'http://localhost');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};

//...
app.configure(function() {
    app.use(require('express').methodOverride());
    app.use(allowCrossDomain);
});



// The root path should serve the client HTML.
app.get('/', function (req, res) {
    res.sendfile(__dirname + '/placeholder.html');
});
app.get("/health",function (req, res) {
    res.send('1');
});

var oauth=config.oauth;

var track="alfano,grillo,berlusconi,renzi,conte,tavecchio";

var params={
  delimeted:"length",
  //track:"bersani,monti,ingroia,grillo,alfano,berlusconi"//,
  track:track
  //locations:"-180,-90,180,90"
  //locations:"7.9,36.5,17.7,47.7"
};

var tweets=[];


var aliases={
  
};

var stats={
  topics:{
    "conte":0,
    "grillo":0,
    "berlusconi":0,
    "tavecchio":0,
    "renzi":0,
    "alfano":0
  }
};

var words=track.split(","),
    l_words=words.length;

//server.listen(PORT);

server.listen(PORT, IPADDRESS, function() {
    console.log('%s: Node server started on %s:%d ...',
                Date(Date.now() ), IPADDRESS, PORT);
});

io.on('connection', function (socket) {
  console.log("connect")
  
  socket.emit('open', { status: 'connected' });

  socket.on('disconnect', function () {
    //console.log("user disconnected")
    
    console.log("disconnect")
    io.sockets.emit('close',{status:"disconnected"});
  });

});

//storeTweets.on("collection-ready",function(){

  
  function createRequest() {
    var oauth=config.oauth;
    //oauth.timestamp=Math.floor( (new Date().getTime())  ).toString()

    console.log("getting","https://stream.twitter.com/1.1/statuses/filter.json?"+qs.stringify(params))

    var req=request.post({
        url: "https://stream.twitter.com/1.1/statuses/filter.json?"+qs.stringify(params),
        oauth:oauth,
        headers:{ 
          "User-Agent": 'Tweet-Collector',
          "Connection": 'Keep-Alive'
        },
        encoding:'utf8',
        //proxy:config.proxy,
        json:true
    },function(e,r,data) {
      if(e) {
        console.log("errore",e);
      }
      //console.log(r)
    });
  
    var message = ""; // variable that collects chunks
    var tweetSeparator = "\r";
    req.on("data",function(chunk){

      message += chunk;

      var tweetSeparatorIndex = message.indexOf(tweetSeparator);
      var didFindTweet = tweetSeparatorIndex != -1;

      if (didFindTweet) {
          console.log("Found tweet");
          var tweet = message.slice(0, tweetSeparatorIndex);
          /*
          clients.forEach(function(client) {
              client.send(tweet);
          });
          */
          try {
            d=JSON.parse(tweet);
          
            //console.log(d)
            if(!d.text) {
              console.log("no text")
              return;
            }
            console.log(d.text);

            if(d.lang=="" || !d.lang || typeof d.lang=='undefined') {
              d.lang=lngDetector.detect(d.text,1)[0][0];
              //console.log("LANG",d.lang)
            }

            var __topics=calculateTopic(d.text);
            console.log("----->",__topics);

            console.log("######################################")
            console.log(" ")

            for(var i=0;i<__topics.length;i++) {
              console.log("sending",__topics[i])
              sendTweet(__topics[i],d);
            }

            console.log("cleaning message");
            message = message.slice(tweetSeparatorIndex + 1);
            console.log("message",message)
          } catch(e) {
            message = message.slice(tweetSeparatorIndex + 1);
            console.log("cant parse")
          }
          
      } else {
        console.log("not yet a tweet")
      }

    });

  }
  createRequest();

//})


app.get('/data', function (req, res) {

  console.log("request for data")

  var pars={$or:[{lang:'it'},{lang:'italian'}]},
    order="asc";

  var h = new Date().getHours();
  if (h>=23 && h<=6) {
    pars={};
  }

  res.send(JSON.stringify(tweets));

});


function sendTweet(c,d) {
    console.log("SENDING TWEET")
    //console.log(d)
    //console.log(c,aliases[c]?aliases[c]:c)
    var tweet={
      "topic":c,
      "created_at":d.created_at,
      "timestamp":new Date(d.created_at).getTime(),
      "id_str":d.id_str,
      "lat":0,
      "lng":0,
      "text":d.text,
      "hashtags":d.hashtags,
      "retweet_count":d.hashtags, //error
      "uid":d.user.id,
      "name":d.user.name,
      "screen_name":d.user.screen_name,
      "followers_count":d.user.followers_count,
      "reply_id":d.in_reply_to_status_id_str,
      "location":d.user.location,
      "lang":d.lang,
      "geo":d.geo,
      "coordinates":d.coordinates,
      "place":d.place
    };
    //console.log(tweet);

    var t={
      c:c,
      t:new Date(d.created_at).getTime(),
      d:d.text,
      id:d.id_str,
      uid:d.user.id,
      name:d.user.name,
      sname:d.user.screen_name,
      f:d.user.followers_count,
      l:d.lang
    };
    //console.log(doc.id_str,doc.timestamp)
    if(d.hashtags) {
      t.h=doc.hashtags;
    }
    if(d.in_reply_to_status_id_str) {
      tweet.r_id=d.in_reply_to_status_id_str;
    }

    var t_now=new Date().getTime();
    tweets=tweets.filter(function(d){
      return (t_now - (1000*60+1000*30)) < d.t;
    });
    tweets.push(t);
    io.sockets.emit('tweet',t);
}


function calculateTopic(text) {
  var topics=[];
  console.log("::::",text.toLowerCase())
  for(var c in stats.topics) {
    if(text.toLowerCase().indexOf(c)!=-1) {
      stats.topics[c]++;
      topics.push(c);
    }
  }
  return topics.unique();
}
//console.log(req)