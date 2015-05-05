var logit = function(){ console.log(arguments); };

var onLocationGet = function(cb){
  navigator.geolocation.getCurrentPosition(cb, logit, {enableHighAccuracy: true});
};

var setVal = function(id, txt){
  if(txt === null || txt === undefined)
    txt = "null";

  $('div#' + id + '>p.value').text(txt);
};

var lastStamp = 0;

var watchPosition = function(callback, opts){
  navigator.geolocation.watchPosition(function(loc){
    callback(loc);
  }, logit, {enableHighAccuracy: true});
};

var getPosition = function(cb, opts) {
  navigator.geolocation.watchPosition(function(loc){
    cb(loc);
  }, logit, {enableHighAccuracy: true});
};
