var geoFunctions = {
  toGameCoords: function(loc, stage, relativeTo) {
    //var projected = stage.constants.projector.forward([loc.lat, loc.lng]);
    //var coords = {
      //x: projected[0] - stage.constants.xMoff,
      //y: projected[1] + stage.constants.yMoff
    //};

    //return coords;
    var distFromAnchor = geotools.distance(loc.lat, loc.lng, stage.constants.geoAnchor.lat, stage.constants.geoAnchor.lng);
    var c_loc = new jsts.geom.Coordinate(loc.lng, loc.lat);
    var c_anchor = new jsts.geom.Coordinate(stage.constants.geoAnchor.lng, stage.constants.geoAnchor.lat);

    var angle = jsts.algorithm.Angle.angleBetweenCoords(c_anchor, c_loc);
    var y = -(Math.sin(angle) * distFromAnchor / stage.state.metersPerPixel);
    var x = Math.cos(angle) * distFromAnchor / stage.state.metersPerPixel;

     if(relativeTo){
       y = y - relativeTo.position.y;
       x = x - relativeTo.position.x;
     }
    return {y: y, x: x};

    // var hdpp = stage.state.heightDegreesPerPixel;
    // var wdpp = stage.state.widthDegreesPerPixel;
    // //var ppdlon = stage.constants.gameWindowWidth / wdpp;
    // //var ppdlat = stage.constants.gameWindowHeight / hdpp;
    // //var lngFactor =  window.innerWidth / (Math.abs(bounds.w) - Math.abs(bounds.e));
    // //var latFactor = window.innerHeight / (Math.abs(bounds.s) - Math.abs(bounds.n));
    // var latOff = loc.lat - stage.constants.geoAnchor.lat;
    // var lngOff = loc.lng - stage.constants.geoAnchor.lng;

    // var y = -(latOff / hdpp);
    // var x = lngOff / wdpp;
    // if(relativeTo){
    //   y = y - relativeTo.position.y;
    //   x = x - relativeTo.position.x;
    // }
  },

  toGeoCoords: function(entity, stage){
    if(entity.toGlobal){
      entity = entity.toGlobal(stage);
    }
    var pos = {x: entity.x, y: entity.y};
    var metersPerPx = stage.state.metersPerPixel;
    //var bounds = stage.state.bounds;

    var xDist = entity.x * metersPerPx;
    var yDist = entity.y * metersPerPx;

    var lat = geotools.translateLatitude(stage.constants.geoAnchor.lat, stage.constants.geoAnchor.lng, yDist)[0];
    var lng = geotools.translateLongitude(stage.constants.geoAnchor.lat, stage.constants.geoAnchor.lng, xDist)[1];
    return {lat: lat, lng: lng};
  },

  getBounds: function(loc, heightDegreesPerPixel, widthDegreesPerPixel){
    var widthDegrees = window.innerWidth * widthDegreesPerPixel;
    var heightDegrees = window.innerHeight * heightDegreesPerPixel;
    var west = loc.coords.longitude - (widthDegrees / 2);
    var south = loc.coords.latitude - (heightDegrees / 2);
    var east = loc.coords.longitude + (widthDegrees / 2);
    var north = loc.coords.latitude + (heightDegrees / 2);
    var bounds = {w: west, s: south, e: east, n: north};
    return bounds;
  },

  adjustedCoords: function(stage){
    return {coords:
             {latitude: stage.state.lat,
              longitude: stage.state.lng},
            timestamp: Math.floor(Date.now())};
  },

  computeSpeed: function(loc, stage){
    if(!stage.state.lastLocObj){
      return undefined;
    }

    var lastLoc = stage.state.lastLocObj;
    var timeDiff = loc.timestamp - lastLoc.timestamp;
    if(timeDiff === 0)
      return 0;

    var dist = geotools.distance(lastLoc.coords.latitude, lastLoc.coords.longitude, loc.coords.latitude, loc.coords.longitude);

    return dist / (timeDiff / 1000);
  },

  computeHeadingDeg: function(loc, stage){
    if(!stage.state.lastLocObj){
      return undefined;
    }

    var bounds = stage.state.bounds;

    var lastLoc = stage.state.lastLocObj;
    var oldCoords = geoFunctions.toGameCoords({lat: lastLoc.coords.latitude,
                                               lng: lastLoc.coords.longitude}, stage, stage.camera);

    var newCoords = geoFunctions.toGameCoords({lat: loc.coords.latitude,
                                               lng: loc.coords.longitude}, stage, stage.camera);

    var c_old = new jsts.geom.Coordinate(oldCoords.x, oldCoords.y);
    var c_new = new jsts.geom.Coordinate(newCoords.x, newCoords.y);

    var rads = jsts.algorithm.Angle.angleBetweenCoords(c_old, c_new);

    return jsts.algorithm.Angle.toDegrees(rads);
  },

  percentDistanceXY: function(x1, y1, x2, y2){
    var width = stage.constants.gameWindowWidth;
    var height = stage.constants.gameWindowHeight;

    var dx = Math.abs(x1 - x2);
    var dy = Math.abs(y1 - y2);
    return {x: (dx / (width / 2)) * 100,
            y: (dy / (height / 2)) * 100};
  },

  percentDistanceFromCenter: function(x,y,stage){
    var width = stage.constants.gameWindowWidth;
    var height = stage.constants.gameWindowHeight;
    maxDim = Math.max(width, height);
    centerX = width / 2;
    centerY = height / 2;
    var dx = Math.abs(centerX - x);
    var dy = Math.abs(centerY - y);
    return {x: (dx / (width / 2)) * 100,
            y: (dy / (height / 2)) * 100};
  },

  isOnstage: function(sprite) {

  },

  checkCollisions: function(stage, options){
    options = options || {};
    var cat = stage.entities.cat;
    var nodeAreas = stage.containers.nodeContainer.children;
    var collisionDist = options.collisionDist || 30;
    var isCollideCat = function(ent){
      if(ent.position.x < 0 || ent.position.y < 0)
        return false;

      var entX = ent.position.x + ent.width / 2;
      var entY = ent.position.y + ent.height / 2;

      return (Math.abs(cat.position.x - entX) < collisionDist) &&
             (Math.abs(cat.position.y - entY) < collisionDist);
    };

    return _.partition(nodeAreas, isCollideCat);
  },

  checkGeoCollisions: function(stage, options){
    options = options || {};
    var cat = stage.entities.cat;
    var nodeAreas = stage.containers.nodeContainer.children || [];
    nodeAreas = nodeAreas.concat(stage.containers.enemyContainer.children);
    var collisionDist = options.collisionDist || 30;
    var isCollideCat = function(ent){
      if(ent.position.x < 0 || ent.position.y < 0)
        return false;

      var entloc = geoFunctions.helpers.latLngFor(ent);
      var catLoc = geoFunctions.adjustedCoords(stage).coords;

      return geotools.distance(entloc.lat, entloc.lng, catLoc.latitude, catLoc.longitude) < collisionDist;
    };

    return _.partition(nodeAreas, isCollideCat);
  },


  helpers: {
    distance: function(p1, p2){
      var dx = Math.abs(centerX - x);
      var dy = Math.abs(centerY - y);
      return Math.sqrt((dx * dx) + (dy * dy));
    },

    topoFor: function(ent){
      if(ent.topo){
        return ent.topo;
      }
      else if(ent.getTopo){
        return ent.getTopo();
      }
    },

    centroidFor: function(ent){
      return geoFunctions.helpers.topoFor(ent).getCentroid();
    },

    latLngFor: function(ent){
      if(ent.dataElement && ent.dataElement.lat){
        return {lat: ent.dataElement.lat, lng: ent.dataElement.lng};
      }
      else if(ent.getDataElement){
        return ent.getDataElement();
      }
    },

    topoDistance: function(e1, e2){
      var topo1 = geoFunctions.helpers.topoFor(e1);
      var topo2 = geoFunctions.helpers.topoFor(e2);

      return topo1.distance(topo2);
    },

    polyPolyMinGeoDist: function(poly1, poly2){
      return Math.min(_.map(poly1, function(point){
        return geoFunctions.helpers.polyPointMinGeoDist(poly2, point);
      }));
    },

    polyPointMinGeoDist: function(poly, point){
      return Math.min.apply(Math.min, _.map(poly, function(pt){
        return geotools.distance(pt[0], pt[1], point[0], point[1]);
      }));
    },


    geoDistance: function(e1, e2){
      var poly1;
      var poly2;
      var pos1;
      var pos2;

      if(e1.geoPoints || e2.geoPoints){
        if(e1.geoPoints && e2.geoPoints){
          poly1 = e1.geoPoints;
          poly2 = e2.geoPoints;
          return geoFunctions.helpers.polyPolyMinGeoDist(poly1, poly2);
        }
        else if(e1.geoPoints){
          poly1 = e1.geoPoints;
          pos1 = geoFunctions.helpers.latLngFor(e2);
          return geoFunctions.helpers.polyPointMinGeoDist(poly1, [pos1.lat, pos1.lng]);
        }
        else{
          poly1 = e2.geoPoints;
          pos1 = geoFunctions.helpers.latLngFor(e1);
          return geoFunctions.helpers.polyPointMinGeoDist(poly1, pos1);
        }
      }
      else{
        pos1 = geoFunctions.helpers.latLngFor(e1);
        pos2 = geoFunctions.helpers.latLngFor(e2);
        return geotools.distance(pos1.lat, pos1.lng, pos2.lat, pos2.lng);
      }

    }
  }
};
