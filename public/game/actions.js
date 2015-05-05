var actions = {
  updateLocText: function(stage){
    // stage.state.locText.setText('lat: ' +
    //                             (stage.state.lat + stage.state.latAdj) +
    //                             '\nlng: ' +
    //                             (stage.state.lng + stage.state.lngAdj));
    stage.state.locText.setText(JSON.stringify(stage.state.lastReportedLoc, null, 2));
  },

  takeAction: function(stage, osmType, osmId, actionId){
    $.post('/'+osmType+'/'+osmId+'/interact/' + actionId, function(resp){
      stage.entities.interactionBox.interactText.setText(resp.text);
      stage.entities.interactionBox.interactBg.buttons = [];
      stage.entities.interactionBox.interactBg.redraw();
      actions.changeBounds(stage);
    });
  },

  checkForNearbyPOIs: function(stage, bounds, loc){
    var scanDistance = 500;
    var collisionPartition = geoFunctions.checkGeoCollisions(stage, {collisionDist: scanDistance});

    var handleSeen = function(entity){
      if(entity.inRangeFn)
        return entity.inRangeFn(stage.entities.cat, stage);
    };

    var handleUnseen = function(entity){
      if(!entity.enemyState){
        entity.visible = false;
        return false;
      }
      else{
        entity.visible = true;
        return true;
      }
    };

    var nodeCollisions = _.map(collisionPartition[0], handleSeen);
    stage.entities.eventBox.button.visible = stage.state.currentEvents.length > 0;
    var nonCollisions = _.each(collisionPartition[1], handleUnseen);
  },

  updatePosition: function(stage, bounds, loc){
    bounds = bounds || stage.state.bounds;
    // loc = loc || geoFunctions.adjustedCoords(stage);

    var gameCoords = geoFunctions.toGameCoords({lat: loc.coords.latitude,
                                                lng: loc.coords.longitude},
                                                stage, stage.camera);

    var percentDistFromCenter = geoFunctions.percentDistanceFromCenter(gameCoords.x, gameCoords.y, stage);
    var recenterPercent = 75.0;
    var headingDeg = loc.coords.heading || geoFunctions.computeHeadingDeg(loc, stage);
    var speed = loc.coords.speed || geoFunctions.computeSpeed(loc, stage);

    stage.state.lastLocObj = loc;
    stage.state.lat = loc.coords.latitude;
    stage.state.lng = loc.coords.longitude;
    stage.state.currentEvents = [];
    stage.state.speed = speed;
    stage.state.heading = ((headingDeg === 0) || headingDeg) ? jsts.algorithm.Angle.toRadians(headingDeg) : undefined;
    stage.state.gameCoords = gameCoords;

    stage.entities.cat.hideArrows();

    if(percentDistFromCenter.x > recenterPercent || percentDistFromCenter.y > recenterPercent){
      //actions.changeBounds(stage, loc);
    }
    else {
      stage.entities.cat.position.x = gameCoords.x;
      stage.entities.cat.position.y = gameCoords.y;

      actions.checkForNearbyPOIs(stage, bounds, loc);
      actions.makeEnemyMoves(stage);
      actions.updateEnemyPositions(stage);

      if(stage.entities.eventBox.menu.visible){
        stage.entities.eventBox.menu.redraw();
      }
      if(stage.state.activeEvent){
        stage.entities.cat.showArrow(stage.state.activeEvent.graphics, stage.state.activeEvent.title);
      }
      actions.updateLocText(stage);
    }
  },

  changeBounds: function(stage, loc){
    // loc = loc || geoFunctions.adjustedCoords(stage);

    var bounds = geoFunctions.getBounds(loc, stage.state.heightDegreesPerPixel, stage.state.widthDegreesPerPixel);

    stage.state.bounds = bounds;

    stage.state.meters_per_pixel_lat = geotools.distance(bounds.n, bounds.w, bounds.s, bounds.w) / stage.constants.gameWindowHeight;
    stage.state.meters_per_pixel_lng = geotools.distance(bounds.n, bounds.w, bounds.n, bounds.e) / stage.constants.gameWindowWidth;

    navigator.geolocation.clearWatch(stage.positionWatcher);
    this.destroyWorld(stage);
    catgame.loadWorld(stage, bounds, loc);
    this.focusCat(loc, stage, bounds);
    catgame.setInputHandlers(stage, bounds);
    stage.state.latAdj = 0;
    stage.state.lngAdj = 0;
    stage.state.lng = loc.coords.longitude;
    stage.state.lat = loc.coords.latitude;
    stage.state.lastLocObj = loc;
    stage.positionWatcher = catgame.watchPositionLoop(stage, bounds);
    stage.entities.cat.rescale(stage);
    _.each(stage.entities.enemies, function(e){ e.rescale(stage);});
    actions.updateEnemyPositions(stage);
  },

  focusCat: function(loc, stage, bounds){
    stage.entities.cat.position = geoFunctions.toGameCoords({lat: loc.coords.latitude,
                                                             lng: loc.coords.longitude},
                                                            stage, stage.camera);
  },

  recenterOnCat: function(stage){
    var catPos = stage.entities.cat.toGlobal(stage);
    var catGeo = geoFunctions.toGeoCoords(catPos, stage);

    stage.camera.position.x += stage.constants.gameWindowWidth / 2 - catPos.x;
    stage.camera.position.y += stage.constants.gameWindowHeight / 2 - catPos.y;
    //stage.state.bounds = geoFunctions.getBounds({coords: {latitude: catGeo.lat, longitude: catGeo.lng}},
                                                //stage.state.heightDegreesPerPixel, stage.state.widthDegreesPerPixel);
  },

  destroyWorld: function(stage) {
    _.each(_.keys(stage.containers), function(container){
      stage.containers[container].clean();
    });

    stage.removeChildren();
  },

  zoomOut: function(stage){
    //var zoomDeg = 0.000002;
    stage.state.heightDegreesPerPixel *= 1.25;
    stage.state.widthDegreesPerPixel *= 1.25;

    actions.changeBounds(stage, geoFunctions.adjustedCoords(stage));
  },

  zoomIn: function(stage){
    //var zoomDeg = 0.000002;
    stage.state.heightDegreesPerPixel *= 0.75;
    stage.state.widthDegreesPerPixel *= 0.75;

    actions.changeBounds(stage, geoFunctions.adjustedCoords(stage));
  },

  resetZoom: function(stage){
    stage.state.heightDegreesPerPixel = stage.constants.defaultHeightDegreesPerPixel;
    stage.state.widthDegreesPerPixel = stage.constants.defaultWidthDegreesPerPixel;

    actions.changeBounds(stage, geoFunctions.adjustedCoords(stage));
  },

  updateEnemyPositions: function(stage){
    _.each(stage.entities.enemies, function(e){
      e.updatePosition();
    });
  },

  makeEnemyMoves: function(stage){
    _.each(stage.entities.enemies, function(e){
      e.doMove();
    });
  },

  tick: function(stage){
    if((stage.state.tick % 10) === 0){
      if((stage.state.tick % 50) === 0){
        actions.makeEnemyMoves(stage);
        actions.updateEnemyPositions(stage);
      }
    }
    _.each(stage.entities.enemies, function(e){ actions.moveEnemy(stage, e);});
    actions.movePlayer(stage);
    actions.recenterOnCat(stage);
    stage.state.tick += 1;
  },

  movePlayer: function(stage){
    var hasHeading = stage.state.heading || stage.state.heading === 0;
    var hasSpeed = stage.state.speed || stage.state.speed === 0;
    if(hasHeading && hasSpeed){
      var heading = stage.state.heading;
      var cat = stage.entities.cat;

      var xoff = ((stage.state.speed / 10) / stage.state.meters_per_pixel_lng) * Math.cos(heading);
      var yoff = ((stage.state.speed / 10) / stage.state.meters_per_pixel_lat) * Math.sin(heading);
      cat.position = {x: cat.position.x + xoff, y: cat.position.y + yoff};

      stage.state.speed *= 0.95;
    }
    else{
      stage.entities.cat.position.x = stage.state.gameCoords.x;
      stage.entities.cat.position.y = stage.state.gameCoords.y;
    }
  },

  moveEnemy: function(stage, enemy){
    if(enemy.enemyState.velocity > 0){
      var newCoords = geoFunctions.toGeoCoords(enemy, stage);
      var state = enemy.enemyState;
      var geoDist = geotools.distance(newCoords.lat, newCoords.lng, state.targetNodeLat, state.targetNodeLng);
      if(geoDist < 10){
        enemy.doMove();
      }
      else{
        var heading = state.heading;
        var xoff = (state.velocity / stage.state.meters_per_pixel_lng) * Math.cos(heading);
        var yoff = (state.velocity / stage.state.meters_per_pixel_lat) * Math.sin(heading);
        enemy.position = {x: enemy.position.x + xoff, y: enemy.position.y - yoff};
      }
    }
  },

  spawnEnemyIfNeeded: function(stage, spawner){
    var tilecount = stage.state.tilecount;
    var freeTiles = 5;

    if(freeTiles + stage.entities.enemies.length < tilecount){
      var enemy = factories.enemy(stage, spawner);
      stage.entities.enemies.push(enemy);
      stage.containers.enemyContainer.addChild(enemy);
    }
  }
};
