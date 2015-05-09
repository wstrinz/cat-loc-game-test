var factories = {
  createPlayer: function(){
    var texture = PIXI.Texture.fromImage("cat.png");
    var cat = new PIXI.Sprite(texture);
    var catHitbox = 15;
    cat.anchor.x = 0.5;
    cat.anchor.y = 0.5;
    cat.scale.x = cat.scale.y = 0.75;
    cat.arrows = [];

    cat.getTopo = function(){
      return (new jsts.geom.Point(cat.position)).buffer(catHitbox);
    };

    cat.getDataElement = function(){
      var stage = cat.stage;
      var coords = geoFunctions.adjustedCoords(stage).coords;
      return {lat: coords.latitude,
              lng: coords.longitude};
    };

    cat.rescale = function(stage){
      var bounds = stage.state.bounds;
      var catDegreesLng = 0.00015;

      //var ppdlon = stage.constants.gameWindowWidth / stage.state;
      var c_height = catDegreesLng / stage.state.widthDegreesPerPixel;
      var minHeight = stage.constants.gameWindowHeight * 0.025;
      var catRatio = 1.0077585569544196;
      cat.height = Math.min(Math.max(minHeight, c_height), 0.045 * stage.constants.gameWindowHeight);
      cat.width = cat.height / catRatio;
    };

    cat.showArrow = function(entity, info){
      var geoDistance = geoFunctions.helpers.geoDistance(entity, cat);
      var topoDistance = geoFunctions.helpers.topoDistance(entity, cat);
      info = info || "Something";
      info += " (" + Math.round(geoDistance) + " meters)";

      var graphics = new PIXI.Graphics();
      var font = '14px Arial';
      var graphicsText = new PIXI.Text(info, {font: font});
      var gameWindowWidth = cat.stage.constants.gameWindowWidth;
      var gameWindowHeight = cat.stage.constants.gameWindowHeight;

      var arrowContainer = new PIXI.DisplayObjectContainer();
      graphics.lineStyle(3, 0x000000, 0.25);
      graphics.beginFill(0xFFFFFF);

      var maxDim = Math.max(gameWindowWidth, gameWindowHeight);
      var percentAway = topoDistance / maxDim;

      //var sigmoid = function(max, min){
        //return function(x){
          //return (max - min) / ( 1 + Math.pow(Math.E, (-x + min))) + min;
        //};
      //};

      var expDecay = function(max, min){
        return function(x){
          return (max - min) * Math.pow(Math.E, (-x/(max * 0.66))) + min;
        };
      };
      var arrowHeight;
      var arrowWidth;
      arrowWidth = expDecay(0.8 * maxDim, 1)(topoDistance);
      arrowWidth = Math.min(arrowWidth, topoDistance);

      arrowHeight = Math.min(Math.max((1 / Math.sqrt(arrowWidth)) * gameWindowHeight, 0.001 * gameWindowHeight), 0.1 * gameWindowHeight);

      var polyPoints = [[0, 0.25 * arrowHeight],
                        [0.7 * arrowWidth, 0.25 * arrowHeight],
                        [0.7 * arrowWidth, 0],
                        [arrowWidth, 0.5 * arrowHeight],
                        [0.7 * arrowWidth, arrowHeight],
                        [0.7 * arrowWidth, 0.75 * arrowHeight],
                        [0, 0.75 * arrowHeight]];


      graphicsText.position = {x: -5, y: -10};

      graphics.drawPolygon(_.flatten(polyPoints));
      graphicsSprite = new PIXI.Sprite(graphics.generateTexture());
      graphicsSprite.alpha = 0.5;
      arrowContainer.addChild(graphicsSprite);
      graphicsSprite.position = {x: cat.width / 2 + 10, y: -arrowHeight / 2};

      var c_e = geoFunctions.helpers.centroidFor(entity).coordinate;
      var c_cat = geoFunctions.helpers.centroidFor(cat).coordinate;

      arrowContainer.rotation = jsts.algorithm.Angle.angleBetweenCoords(c_cat, c_e);

      graphicsSprite.addChild(graphicsText);
      cat.addChild(arrowContainer);
    };

    cat.hideArrows = function(){
      cat.removeChildren();
    };

    return cat;
  },

  button: function(text, clickFn, options){
    var buttonText;
    var buttonBg;
    options = options || {};
    var font = options.font || '20px Arial';
    var textMargin = options.textMargin || 6;
    var widthMargin = options.widthMargin || textMargin;
    var heightMargin = options.heightMargin || textMargin;
    buttonText = new PIXI.Text(text, {font: font});
    buttonBg = new PIXI.Graphics();
    buttonBg.lineStyle(3, 0x000000, 0.25);
    buttonBg.beginFill(0xFFFFFF);
    buttonBg.drawRect(0, 0, buttonText.width + widthMargin * 2, buttonText.height + heightMargin);


    buttonSprite = new PIXI.Sprite(buttonBg.generateTexture());
    buttonSprite.addChild(buttonText);
    buttonSprite.interactive = true;
    buttonSprite.tint = 0x4C5AB3;
    buttonSprite.tap = buttonSprite.click = clickFn;

    buttonText.position = {x: widthMargin, y: heightMargin};
    buttonSprite.buttonText = buttonText;

    return buttonSprite;
  },

  enemy: function(stage, spawner){
    var texture = PIXI.Texture.fromImage("ghost.png");

    var graphics = new PIXI.Sprite(texture);
    graphics.anchor.x = 0.5;
    graphics.anchor.y = 0.5;
    var gfxSprite = graphics;
    var nOtherEnemies = _.filter(stage.entities.enemies, function(e){
      return e.enemyState.homeNode.id == spawner.dataElement.id;
    }).length;
    var enemyState = {lat: spawner.dataElement.lat,
                      lng: spawner.dataElement.lng,
                      lastServerContact: undefined,
                      waitingForServer: false,
                      id: spawner.dataElement.id + "_" + nOtherEnemies,
                      homeNode: {lat: spawner.dataElement.lat,
                                 lng: spawner.dataElement.lng,
                                 id: spawner.dataElement.id},
                      behavior: "wander"};

    var inRangeFn = function(otherEnt, stage){
      evt = {title: 'Enemy', id: gfxSprite.getDataElement().id, graphics: gfxSprite};
      stage.state.currentEvents.push(evt);
      return true;
    };

    gfxSprite.rescale = function(stage){
      var bounds = stage.state.bounds;
      var enemyDegreesLng = 0.00012;
      var enemyDegreesLat = 0.00015;

      var ppdlon = stage.constants.gameWindowWidth / (Math.abs(bounds.w) - Math.abs(bounds.e));
      var ppdlat = stage.constants.gameWindowHeight / (Math.abs(bounds.n) - Math.abs(bounds.s));
      var c_width = enemyDegreesLng * ppdlat;
      var c_height = enemyDegreesLat * ppdlon;
      var minHeight = stage.constants.gameWindowHeight * 0.025;
      var maxHeight = stage.constants.gameWindowHeight * 0.045;
      var dimRatio = 0.8470588235294118;
      gfxSprite.height = Math.min(Math.max(minHeight, c_height), maxHeight);
      gfxSprite.width = gfxSprite.height * dimRatio;
    };

    gfxSprite.position = geoFunctions.toGameCoords({lat: spawner.dataElement.lat, lng: spawner.dataElement.lng}, stage, stage.camera);
    gfxSprite.getTopo = function(){
      return (new jsts.geom.Point(gfxSprite.toGlobal(stage.position))).buffer(3);
    };

    gfxSprite.getDataElement = function(){
      return {lat: gfxSprite.enemyState.lat,
              lng: gfxSprite.enemyState.lng,
              dataElement: gfxSprite.enemyState.homeNode,
              currentWay: gfxSprite.enemyState.currentWay,
              enemy: true};
    };
    gfxSprite.visible = true;
    gfxSprite.inRangeFn = inRangeFn;
    gfxSprite.enemyState = enemyState;

    gfxSprite.updatePosition = function(){
      gfxSprite.position = geoFunctions.toGameCoords(gfxSprite.getDataElement(), stage, stage.camera);
    };

    gfxSprite.doMove = function(){
      var state = gfxSprite.enemyState;
      var newCoords = geoFunctions.toGeoCoords(gfxSprite, stage);
      state.lat = newCoords.lat;
      state.lng = newCoords.lng;
      if(state.lastServerContact){
        if(state.targetNode){
          var playerLoc = geoFunctions.adjustedCoords(stage);
          var target_coords = geoFunctions.toGameCoords({lat: state.targetNodeLat, lng: state.targetNodeLng}, stage, stage.camera);
          var target_topo = {topo: (new jsts.geom.Point(target_coords)).buffer(1)};

          var dist = geotools.distance(state.lat, state.lng, state.targetNodeLat, state.targetNodeLng);
          if(dist < 10){
            state.velocity = 0;

            var nextNode = _.sample(_.filter(_.flatten(_.map(_.filter(stage.containers.roadContainer.children,
                        function(r) {
                          return _.any(r.dataElement, function(e){
                            return e.id == state.targetNode;
                          });
                        }),
                      function(e){
                        var idx = _.findIndex(e.dataElement, function(de){ return de.id == state.targetNode; });
                        var dir = 1;
                        if(state.direction != "forward"){
                          dir *= -1;
                        }
                        return _.compact([e.dataElement[idx + dir]]);
                      })),
                  function(n){
                    return !_.any(stage.containers.tileContainer.children, function(tile){
                      var coord = geoFunctions.toGameCoords(n, stage, stage.camera);
                      return tile.topo.getEnvelopeInternal().contains(
                        new jsts.geom.Coordinate(coord.x, coord.y)
                        );
                    });
                  }
            ));

            if(nextNode){
              state.targetNode = nextNode.id;
              state.targetNodeLat = nextNode.lat;
              state.targetNodeLng = nextNode.lng;
            }
            else{
              if(state.direction == "forward"){
                state.direction = "reverse";
              }
              else{
                state.direction = "forward";
              }
            }
          }

          var playerCoords = geoFunctions.adjustedCoords(stage).coords;
          var playerDist = geotools.distance(state.lat, state.lng, playerCoords.latitude, playerCoords.longitude);
          if(playerDist < 20){
            state.velocity = 2; // meter / tick? possibly event meter per second w/ moment
          }
          else if(playerDist < 200){
            state.velocity = 1; // meter / tick? possibly event meter per second w/ moment
          }
          else{
            state.velocity = 0.25; // meter / tick? possibly event meter per second w/ moment
          }

          var bounds = stage.state.bounds;

          var c_tar = geoFunctions.helpers.centroidFor(target_topo).coordinate;
          var c_self = geoFunctions.helpers.centroidFor(gfxSprite).coordinate;

          state.heading = -jsts.algorithm.Angle.angleBetweenCoords(c_tar, c_self) - Math.PI;
          gfxSprite.rotation = state.heading - Math.pi;
        }
        // check for if close to target node
        // if no, set velocity > 0, direction of travel at target node
        // if yes, set target node to next node in current way, or decide to change ways if at crossing
        //
      }
      else {
        if(state.waitingForServer !== true){
          state.waitingForServer = true;
          $.post("/game/init_enemy", {enemy: JSON.stringify(state)})
            .done(function(resp) {
              state.waitingForServer = false;
              gfxSprite.enemyState = resp.enemy;
              gfxSprite.rescale(stage);
              gfxSprite.updatePosition();
            })
            .fail(function(resp) {
              state.waitingForServer = false;
              console.log( "error", arguments);
            });
        }
      }
    };
    return gfxSprite;
  },

  zoomPanel: function(stage){
    var zoomBg;
    var zoomSprite;
    zoomBg = new PIXI.Graphics();
    zoomBg.lineStyle(2, 0x000000, 0.5);
    zoomBg.beginFill(0xFFFFFF);
    var passStageWrapper = function(fn){
      return function(){
        return fn(stage);
      };
    };
    var fontPx = 0.1 * stage.constants.gameWindowHeight;
    var buttonOpts = {font: fontPx + 'px monospace'};
    var inButton = factories.button('+', passStageWrapper(actions.zoomIn), buttonOpts);
    var outButton = factories.button('-', passStageWrapper(actions.zoomOut), buttonOpts);
    var resetButton = factories.button('=', passStageWrapper(actions.resetZoom), buttonOpts);
    zoomBg.drawRect(0, 0, Math.max(inButton.width, outButton.width, resetButton.width) + 20,
                          (inButton.height + outButton.height + resetButton.height) + 20);



    zoomSprite = new PIXI.Sprite(zoomBg.generateTexture());
    zoomSprite.addChild(inButton);
    zoomSprite.addChild(outButton);
    zoomSprite.addChild(resetButton);

    inButton.position = { x: 10, y: 5 };
    resetButton.position = {x: inButton.position.x,
                            y: inButton.position.y + resetButton.height + 5};
    outButton.position = {x: resetButton.position.x,
                            y: resetButton.position.y + outButton.height + 5};

    zoomSprite.tint = 0x9AA0C2;

    return zoomSprite;
  },

  eventBox: function(stage) {
    var eventBg = new PIXI.Graphics();
    var ypos = stage.constants.gameWindowHeight - 0.15 * stage.constants.gameWindowHeight;


    var fontPx = 0.1 * stage.constants.gameWindowHeight;
    var showHideBg = function(){
      if(eventBg.visible){
        eventBg.visible = false;
      }
      else
      {
        eventBg.redraw();
        eventBg.visible = true;
      }
    };
    var showHideButton = factories.button('!', showHideBg, {font: fontPx + 'px monospace'});
    showHideButton.position = {x: 5, y: stage.constants.gameWindowHeight - showHideButton.height - 5};

    eventBg.alpha = 0.9;
    eventBg.visible = false;
    eventBg.beginFill(0xFFFFFF);
    eventBg.drawRect(showHideButton.width + showHideButton.x - 5, ypos, 0.9 * stage.constants.gameWindowWidth, stage.constants.gameWindowHeight - ypos - 5);

    eventBg.redraw = function(){
      eventBg.removeChildren();

      var closestEvents = _.sortBy(stage.state.currentEvents, function(evt){
        if(evt.enemyState){
          return 1;
        }
        else{
          return geoFunctions.helpers.geoDistance(evt.graphics, stage.entities.cat);
        }
      });

      var fontPx = 0.03 * stage.constants.gameWindowHeight;
      _.reduce(_.take(closestEvents, 5), function(width, evt){
        var buttonGraphics;
        var setActive = function(){
          if(stage.state.activeEvent == evt){
            if(!stage.state.activeEvent.graphics.enemyState){
              stage.state.activeEvent.graphics.visible = false;
            }
            stage.entities.cat.hideArrows();
            stage.state.activeEvent = undefined;
          }
          else{
            if(stage.state.activeEvent){
              if(!stage.state.activeEvent.graphics.enemyState){
                stage.state.activeEvent.graphics.visible = false;
              }
              stage.entities.cat.hideArrows();
            }
            stage.state.activeEvent = evt;
            evt.graphics.visible = true;
            stage.entities.cat.showArrow(evt.graphics, evt.title);
          }
          eventBg.redraw();
        };

        buttonGraphics = factories.button(evt.title, setActive, {font: fontPx + 'px Arial'});
        if(stage.state.activeEvent && stage.state.activeEvent.id == evt.id){
          buttonGraphics.buttonText.setStyle({font: 'bold ' + fontPx + 'px Arial'});
          buttonGraphics.scale = {x: 1.1, y: 1.1};
        }

        eventBg.addChild(buttonGraphics);
        buttonGraphics.position = {x: width + 10, y: stage.constants.gameWindowHeight - eventBg.height + buttonGraphics.height / 2};
        buttonGraphics.visible = true;
        return width + buttonGraphics.width;
      }, 50);
    };

    return {button: showHideButton, menu: eventBg};
  },

  interactionBox: function(stage){
    var interactText;
    var interactBg;
    var font = 0.02 * stage.constants.gameWindowHeight;
    interactText = new PIXI.Text('', {font: font + 'px Arial'});
    interactBg = new PIXI.Graphics();

    interactText.visible = interactBg.visible = false;
    interactBg.position = {x: stage.constants.gameWindowWidth / 4,
                           y: 20};

    interactBg.buttons = [];

    //interactBg.click = interactText.click = interactText.tap  = interactBg.tap = function(){
      //interactBg.visible = interactText.visible = false;
    //};

    interactBg.redraw = function(){

      var infoBox = stage.entities.infoBox;
      infoBox.bg.visible = infoBox.text.visible = infoBox.interactButton.visible = false;
      interactBg.removeChildren();
      interactBg.clear();
      interactBg.alpha = 0.8;
      interactBg.beginFill(0xFFFFFF);
      interactBg.drawRect(0, 0, (6/8) * stage.constants.gameWindowWidth, 0.95 * stage.constants.gameWindowHeight);
      interactBg.position = {x: stage.constants.gameWindowWidth / 8,
                             y: 20};
      interactText.position = {x: interactBg.position.x + 5, y: interactBg.position.y + 25};

      var closeFont = 0.05 * stage.constants.gameWindowHeight + 'px Arial';
      var closeButton = factories.button('X', function(){
        interactBg.visible = interactText.visible = false;
      }, {font: closeFont});

      interactBg.addChild(closeButton);
      closeButton.position = {x: interactBg.width - closeButton.width - 5, y: interactBg.position.y};

      var buttonFont = 0.04 * stage.constants.gameWindowHeight + 'px Arial';
      _.reduce(interactBg.buttons, function(width, butt){
        var buttonGraphics = factories.button(butt.text, function(){
          actions.takeAction(stage, butt.type, butt.id, butt.actionId);
        }, {font: buttonFont});

        interactBg.addChild(buttonGraphics);
        buttonGraphics.position = {x: width + 5, y: interactBg.height - buttonGraphics.height - 20};
        buttonGraphics.visible = true;
        return width + buttonGraphics.width;
      }, 5);
    };

    var loadInteraction = function(osmType, id){
      interactText.setText('Investigating...');
      interactBg.buttons = [];
      interactBg.redraw();
      interactBg.visible = true;
      interactText.visible = true;
      $.get('/'+osmType+'/'+id+'/interact', function(resp){
        interactText.setText(resp.interaction.text);
        interactBg.buttons = resp.interaction.buttons || [];
        interactBg.redraw();
        interactBg.visible = true;
        interactText.visible = true;
        actions.changeBounds(stage, geoFunctions.adjustedCoords(stage));
      });
    };

    return {interactText: interactText, interactBg: interactBg, loadInteraction: loadInteraction};
  },

  textBox: function(stage){
    var nodeText;
    var nodeBg;
    var font = (0.025 * stage.constants.gameWindowHeight) + 'px Arial';
    nodeText = new PIXI.Text('', {font: font});
    nodeBg = new PIXI.Graphics();

    nodeText.visible = nodeBg.visible = false;
    nodeBg.interactive = nodeText.interactive = true;

    var interactFn = function(evt){
      nodeBg.visible = nodeText.visible = interactButton.visible = false;
      var ib = stage.entities.interactionBox;
      stage.entities.eventBox.menu.visible = false;
      if(stage.state.activeEvent && stage.state.activeEvent.id == interactButton.osmObjId){
        stage.state.activeEvent = undefined;
      }
      ib.loadInteraction(interactButton.osmObjType, interactButton.osmObjId);
    };

    var interactButton = this.button('Investigate', interactFn, {font: font});
    interactButton.visible = false;
    interactButton.interactive = false;
    interactButton.alpha = 1;

    var ensureNodeTextFitsScreen = function(nodeText, button) {
      var margin = 5;
      if(nodeText.width + nodeText.x > window.innerWidth) {
        nodeText.x = window.innerWidth - nodeText.width - margin;
      }
      else if(nodeText.x < 0){
        nodeText.x = 0 + margin;
      }
      if(nodeText.height + nodeText.y + button.height > window.innerHeight) {
        nodeText.y = window.innerHeight - nodeText.height - button.height - margin;
      }
      else if(nodeText.y < 0){
        nodeText.y = 0 + margin;
      }
    };

    var redrawBg = function(){
      nodeBg.clear();
      nodeBg.alpha = 0.8;
      nodeBg.visible = false;
      nodeBg.position = {x: nodeText.position.x - 6, y: nodeText.position.y - 6};
      interactButton.visible = false;
      interactButton.position = {x: nodeText.position.x + 2, y: nodeText.position.y + nodeText.height + 5};
      nodeBg.beginFill(0xFFFFFF);
      var boxWidth = Math.max(nodeText.width + 9, interactButton.width + 2);
      nodeBg.drawRect(0, 0, boxWidth + 9, nodeText.height + interactButton.height + 20);
    };

    var showTags = function(osmObj, position, graphicElement, hideCb) {
      var alllowInteract = false;
      var minDist = 30;

      if(graphicElement){
        alllowInteract = geoFunctions.helpers.geoDistance(graphicElement, stage.entities.cat) < minDist;
      }

      nodeBg.click = nodeText.click = nodeBg.tap = nodeText.tap = function(){
        nodeBg.visible = nodeText.visible = interactButton.visible= false;
        if(hideCb)
          hideCb();
      };

      var nodeTextFont = (0.025 * stage.constants.gameWindowHeight) + 'px Arial';
      nodeText.setText(displayFunctions.descriptionForObject(osmObj), {font: nodeTextFont});
      nodeText.position = {x: position.x, y: position.y};
      ensureNodeTextFitsScreen(nodeText, interactButton);
      redrawBg();
      nodeBg.visible = nodeText.visible = interactButton.visible = true;
      interactButton.alpha = 0.25;

      if(alllowInteract){
        interactButton.interactive = true;
        interactButton.alpha = 1;
        interactButton.osmObjId = osmObj.id;
        interactButton.osmObjType = osmObj.nodes ? "ways" : "nodes";
      }
      else {
        interactButton.interactive = false;
      }
    };

    return {text: nodeText, bg: nodeBg, interactButton: interactButton, showFn: showTags};
  },

  node: function(nodeData, stage) {
    var graphics = new PIXI.Graphics();
    var graphicsTap;
    var gfxSprite;
    var gfxTapSprite;
    var color = 0x00FF00;
    var nodeSize = 3;
    var alpha = 0.4;
    var visible = false;
    var isInteresting = this.helpers.isNodeInteresting(nodeData);
    nodeData.positionElement = graphics;

    var inRangeFn = function(otherEnt, stage){

      var success = false;
      if(!timeFunctions.investigatedRecently(nodeData)){
        evt = {title: nodeData.id, id: nodeData.id, graphics: gfxSprite};
        stage.state.currentEvents.push(evt);
        success = true;
      }
      if(stage.state.activeEvent && stage.state.activeEvent.id == nodeData.id){
        var coords = geoFunctions.adjustedCoords(stage).coords;
        if(geotools.distance(nodeData.lat, nodeData.lng, coords.latitude, coords.longitude) < 30){
          stage.entities.infoBox.showFn(nodeData, gfxSprite.position, gfxTapSprite, function(){
            gfxTapSprite.visible = false;
            gfxSprite.visible = false;
          });
        }
      }
      return success;
    };

    if(nodeData.spawn){
      color = 0x000000;
      nodeSize = 12;
      alpha = 1;
      visible = true;
      inRangeFn = function(otherEnt, stage){
        evt = {title: 'Spawner', graphics: gfxSprite};
        stage.state.currentEvents.push(evt);
        actions.spawnEnemyIfNeeded(stage, gfxSprite);
        return true;
      };
    }
    else if(isInteresting){
      nodeSize = 8;
      alpha = 0.9;
      color = 0x1E90FF;
      visible = false;
    }

    graphics.beginFill(0xFFFFFF);
    graphics.drawCircle(0,0,nodeSize);
    graphics.position = geoFunctions.toGameCoords({lat: nodeData.lat, lng: nodeData.lng}, stage, stage.camera);
    gfxSprite = new PIXI.Sprite(graphics.generateTexture());
    gfxSprite.dataElement = nodeData;
    gfxSprite.position = {x: graphics.position.x - graphics.width / 2,
                             y: graphics.position.y - graphics.height / 2};
    gfxSprite.topo = (new jsts.geom.Point(graphics.position)).buffer(nodeSize);
    gfxSprite.alpha = alpha;
    gfxSprite.tint = color;
    gfxSprite.visible = visible;

    if(isInteresting){
      graphicsTap = new PIXI.Graphics();

      var extraSize = 35;
      graphicsTap.beginFill(0xFFFFFF);
      graphicsTap.drawCircle(0,0,nodeSize + extraSize);
      graphicsTap.position = geoFunctions.toGameCoords({lat: nodeData.lat, lng: nodeData.lng}, stage, stage.camera);
      gfxTapSprite = new PIXI.Sprite(graphicsTap.generateTexture());
      gfxTapSprite.position = {x: -extraSize, y: -extraSize};
      gfxTapSprite.alpha = 0.20;
      gfxTapSprite.tint = 0xFF0000;
      gfxTapSprite.visible = true;
      gfxTapSprite.dataElement = nodeData;

      gfxTapSprite.topo = (new jsts.geom.Point(graphicsTap.position)).buffer(nodeSize + extraSize);

      gfxSprite.inRangeFn = gfxTapSprite.inRangeFn = inRangeFn;

      gfxSprite.addChild(gfxTapSprite);
    }

    return { graphics: gfxSprite, graphicsTap: gfxTapSprite };
  },

  building: function(way, nodes, bounds){
    var nodesToDisplay = this.helpers.nodesForWay(way, nodes, {sort: true});
    var graphics = new PIXI.Graphics();
    var color = this.helpers.colorForBuilding(way);
    graphics.lineStyle(1, 0x000A00);

    graphics.beginFill(0xFFFFFF);
    var polyPoints = _.map(nodesToDisplay, function(n){
      return [n.positionElement.position.x, n.positionElement.position.y];
    });

    var geoPoints = _.map(nodesToDisplay, function(n){
      return [n.lat, n.lng];
    });

    graphics.drawPolygon(_.flatten(polyPoints));

    graphics.updateLocalBounds();

    var b = graphics._localBounds;
    var positionElement = {
      position: { x: b.x + b.width / 2,
                  y: b.y + b.height / 2 }
    };
    way.positionElement = positionElement; //{position: {x: firstPos.x, y: firstPos.y}};

    var gfxSprite = new PIXI.Sprite(graphics.generateTexture());
    gfxSprite.position = {x: b.x, y: b.y};
    gfxSprite.tint = color;
    gfxSprite.dataElement = way;
    gfxSprite.geoPoints = geoPoints; //{position: {x: firstPos.x, y: firstPos.y}};

    var polyString = _.map(polyPoints, function(p){
      return p.join(' ');
    }).join(', ');
    gfxSprite.interactive = true;
    gfxSprite.topo = (new jsts.io.WKTReader()).read('POLYGON((' + polyString  + '))');

    return {graphics: gfxSprite};
  },

  road: function(way, nodes) {
    var nodesToDisplay = this.helpers.nodesForWay(way, nodes, {sort: true});
    var graphics = new PIXI.Graphics();
    graphics.lineStyle(4, 0xD1D1E0);
    graphics.dataElement = nodesToDisplay;

    if(nodesToDisplay[0]){
      var firstPos = nodesToDisplay[0].positionElement.position;
      graphics.moveTo(firstPos.x,firstPos.y);
      var linePoints = _.map(_.rest(nodesToDisplay), function(n) {
        var nPos = n.positionElement.position;
        graphics.lineTo(nPos.x,nPos.y);
        //var polyPoints = _.map(nodesToDisplay, function(n){
        //return [n.positionElement.position.x, n.positionElement.position.y];
        //});

        return [nPos.x, nPos.y];
      });

      //linePoints.concat([firstPos.x, firstPos.y]);

      //var line = _.map(linePoints, function(p){
        //return p.join(' ');
      //}).join(', ');
      //graphics.topo = (new jsts.io.WKTReader()).read('LINESTRING((' + line  + '))');
    }

    return graphics;
  },

  unknownTile: function(tile, stage, bounds) {
    var graphics = new PIXI.Graphics();
    var color = 0x060D3E;
    graphics.lineStyle(8, 0x000A00);

    graphics.beginFill(0xFFFFFF);
    var geoPoints = _.map([['n', 'w'], ['n', 'e'], ['s', 'e'], ['s', 'w']], function(dirs){
      return geoFunctions.toGameCoords({lat: tile[dirs[0]], lng: tile[dirs[1]]}, stage, stage.camera);
    });
    var polyPoints = _.map(geoPoints, function(geoPoint){
      return [geoPoint.x, geoPoint.y];
    });
    graphics.drawPolygon(_.flatten(polyPoints));

    var texture = graphics.generateTexture();
    var gfxSprite = new PIXI.Sprite(texture);
    gfxSprite.position = geoPoints[0];
    gfxSprite.tint = color;
    gfxSprite.alpha = 0.9;

    gfxSprite.interactive = true;

    var polyString = _.map(polyPoints, function(p){
      return p.join(' ');
    }).join(', ');
    gfxSprite.topo = (new jsts.io.WKTReader()).read('POLYGON((' + polyString  + '))');

    return {graphics: gfxSprite};
  },

  otherArea: function(way, nodes, bounds){
    var nodesToDisplay = this.helpers.nodesForWay(way, nodes, {sort: true});
    var graphics = new PIXI.Graphics();
    var color = factories.helpers.colorForArea(way);

    if(nodesToDisplay[0]){
      var firstPos = nodesToDisplay[0].positionElement.position;
      graphics.moveTo(firstPos.x,firstPos.y);
      graphics.beginFill(color);
      _.each(_.rest(nodesToDisplay), function(n) {
        var nPos = n.positionElement.position;
        graphics.lineTo(nPos.x,nPos.y);
      });
      graphics.endFill();

      graphics.polyPoints = _.map(nodesToDisplay, function(n){
        return [n.positionElement.position.x, n.positionElement.position.y];
      });

      graphics.geoPoints = _.map(nodesToDisplay, function(n){
        return [n.lat, n.lng];
      });

      graphics.updateLocalBounds();

      var b = graphics._localBounds;
      var positionElement = {
        position: { x: b.x + b.width / 2,
                    y: b.y + b.height / 2 }
      };
      way.positionElement = positionElement; //{position: {x: firstPos.x, y: firstPos.y}};
      graphics.dataElement = way;

      graphics.interactive = true;
    }

    return {graphics: graphics};
  },

  helpers: {
    nodesForWay: function(way, nodes, options) {
      var nodeObjs = _.filter(nodes, function(n){
        return _.includes(way.nodes, n.id);
      });

      if(options.sort){
        var sortedObjs = _.map(way.nodes, function(id){
          return _.find(nodeObjs, function(node){
            return node.id == id;
          });
        });

        nodeObjs = sortedObjs;
      }

      if(options.visible){
        var visibleNodes = _.filter(nodeObjs, function(obj){
          var pos = obj.positionElement.position;
          return pos.x > 0 && pos.y > 0;
        });

        nodeObjs = visibleNodes;
      }

      return nodeObjs;
    },

    isNodeInteresting: function(nodeData){
      if(nodeData.spawn)
        return true;

      var numProps = Object.getOwnPropertyNames(nodeData.tags).length;
      var boringProps = ['highway', 'crossing', 'entrance'];

      if(numProps > 0){
        return _.filter(boringProps, function(p){
          return nodeData.tags[p];
        }).length < numProps;
      }
      else{
        return false;
      }
    },

    colorForBuilding: function(way){
      if(way.lastInvestigated){
        if(timeFunctions.interactedRecently(way))
          return 0x1919A0;
        else
          return 0x7136AA;
      }
      else{
        return 0xE6B800;
      }
    },

    colorForArea: function(way){
      if(way.tags.leisure){
        var lt = way.tags.leisure;
        if(lt == "park"){
          return 0x308330;
        }
        else {
          return 0xF37735;
        }
      }
      else if(way.tags.natural){
        var nt = way.tags.natural;
        if(nt == "water"){
          return 0x007CD2;
        }
        else{
          return 0xFFFFFF;
        }
      }
    },

    lightenColor: function(color, percent) {
      var num = parseInt(color,16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      B = (num >> 8 & 0x00FF) + amt,
      G = (num & 0x0000FF) + amt;
      return (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (B<255?B<1?0:B:255)*0x100 + (G<255?G<1?0:G:255)).toString(16).slice(1);
    }
  }
};
