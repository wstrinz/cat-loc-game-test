var catgame = {
  init: function(){
    var stage = new PIXI.Stage(0x5179AE, true);
    var state = {};
    var constants = {};
    stage.state = state;
    stage.constants = constants;
    stage.entities = {};
    stage.containers = {};
    stage.interactive = true;

    constants.gameWindowWidth = window.innerWidth;
    constants.gameWindowHeight = window.innerHeight;

    stage.updatePosition = actions.updatePosition;
    state.bounds = {};

    state.latAdj = 0;
    state.lngAdj = 0;
    state.lat = 0;
    state.lng = 0;
    state.currentEvents = [];
    state.activeEvent = undefined;
    state.lastLocObj = {};
    state.tick = 0;

    stage.constants.defaultHeightDegreesPerPixel = 0.00000400;
    stage.constants.defaultWidthDegreesPerPixel =  0.00000400;
    stage.state.heightDegreesPerPixel = 0.00000350;
    stage.state.widthDegreesPerPixel =  0.00000400;
    stage.state.metersPerPixel = 0.25;

    stage.containers.backgroundNodeContainer = new PIXI.DisplayObjectContainer();
    stage.containers.nodeContainer = new PIXI.DisplayObjectContainer();
    stage.containers.infoContainer = new PIXI.DisplayObjectContainer();
    stage.containers.roadContainer = new PIXI.DisplayObjectContainer();
    stage.containers.buildingContainer = new PIXI.DisplayObjectContainer();
    stage.containers.enemyContainer = new PIXI.DisplayObjectContainer();
    stage.containers.tileContainer = new PIXI.DisplayObjectContainer();
    stage.camera = new PIXI.DisplayObjectContainer();
    stage.containers.otherAreaContainer = new PIXI.DisplayObjectContainer();

    stage.entities.cat = factories.createPlayer();
    stage.entities.enemies = [];
    var zoomPanel = factories.zoomPanel(stage);
    stage.entities.zoomPanel = zoomPanel;
    stage.entities.zoomPanel.position = {x: constants.gameWindowWidth - zoomPanel.width - 10,
                                         y: 60};

    var zoomHiderFont = (0.04 * stage.constants.gameWindowHeight) + 'px Arial';
    var zoomHiderOriginalPos = {x: zoomPanel.position.x,
                                y: zoomPanel.position.y + stage.entities.zoomPanel.height + 3};

    stage.entities.zoomPanelHide = factories.button('≡', function(){
      if(zoomPanel.visible){
        zoomPanel.visible = false;
        this.position = zoomPanel.position;
      }
      else {
        zoomPanel.visible = true;
        this.position = zoomHiderOriginalPos;
      }
    },
    {font: zoomHiderFont, widthMargin: 0.035 * stage.constants.gameWindowWidth});

    stage.entities.zoomPanelHide.position = zoomHiderOriginalPos;

    stage.entities.eventBox = factories.eventBox(stage);

    stage.entities.cat.stage = stage;
    stage.entities.infoBox = factories.textBox(stage);

    stage.state.locText = new PIXI.Text('Location', {font: '14px Arial'});
    stage.state.locText.position = {x: constants.gameWindowWidth - 400, y: 10};

    var recenterButton = new PIXI.Sprite(PIXI.Texture.fromImage("crosshair.png"));
    recenterButton.position = {x: 20, y: 20};
    recenterButton.interactive = true;
    recenterButton.tap = recenterButton.click = function(){
      actions.changeBounds(stage, geoFunctions.adjustedCoords(stage));
    };
    recenterButton.scale = {x: 0.15, y: 0.15};


    stage.entities.interactionBox = factories.interactionBox(stage);

    stage.entities.recenterButton = recenterButton;

    return stage;
  },

  render: function(stage){
    var animate = function(){

      requestAnimFrame( animate );
      //stage.entities.cat.rotation += 0.02; // sorry SpinCat. You will return!

      renderer.render(stage);
    };

    var renderer = PIXI.autoDetectRenderer(stage.constants.gameWindowWidth,
                                           stage.constants.gameWindowHeight);

    document.body.appendChild(renderer.view);

    requestAnimFrame( animate );
  },


  loadWorld: function(stage, bounds, loc){
    stage.state.lastLocObj = loc;
    stage.state.lat = loc.coords.latitude;
    stage.state.lng = loc.coords.longitude;

    stage.camera.addChild(stage.containers.otherAreaContainer);
    stage.camera.addChild(stage.containers.buildingContainer);
    stage.camera.addChild(stage.containers.backgroundNodeContainer);
    stage.camera.addChild(stage.containers.roadContainer);
    stage.camera.addChild(stage.containers.tileContainer);
    stage.camera.addChild(stage.containers.nodeContainer);
    stage.camera.addChild(stage.containers.infoContainer);
    stage.camera.addChild(stage.entities.cat);
    _.each(stage.entities.enemies, function(e){
      stage.containers.enemyContainer.addChild(e);
    });
    stage.camera.addChild(stage.containers.enemyContainer);
    stage.addChild(stage.camera);
    //stage.addChild(stage.entities.cat);
    stage.addChild(stage.entities.recenterButton);
    stage.addChild(stage.state.locText);
    stage.addChild(stage.entities.infoBox.bg);
    stage.addChild(stage.entities.infoBox.text);
    stage.addChild(stage.entities.zoomPanel);
    stage.addChild(stage.entities.zoomPanelHide);
    stage.addChild(stage.entities.eventBox.button);
    stage.addChild(stage.entities.eventBox.menu);
    stage.addChild(stage.entities.interactionBox.interactBg);
    stage.addChild(stage.entities.interactionBox.interactText);
    stage.addChild(stage.entities.infoBox.interactButton);
    geometryGen.loadNodes(stage, bounds, geometryGen.loadWays);
  },

  watchPositionLoop: function(stage){
    return watchPosition(function(loc){
      stage.state.lastReportedLoc = loc;
      actions.updatePosition(stage, stage.state.bounds, loc);
    });
  },

  startEventLoop: function(stage){
    return window.setInterval(function(){
      actions.tick(stage);
    }, 100);
  },

  setGeoAnchor: function(stage, loc){
    //var west = loc.coords.longitude - (widthDegrees / 2);
    //var south = loc.coords.latitude - (heightDegrees / 2);
    //var east = loc.coords.longitude + (widthDegrees / 2);
    //var north = loc.coords.latitude + (heightDegrees / 2);
    //stage.constants.projector = proj4('+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=' + leftLng + ' +x_0=0.0 +y_0=0 +k=1.0 +units=m +no_defs');
    stage.constants.projector = proj4('+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +no_defs');

    var xm = (stage.constants.gameWindowWidth / 2) * stage.state.metersPerPixel;
    var ym = (stage.constants.gameWindowHeight / 2) * stage.state.metersPerPixel;
    var topLat = geotools.translateLatitude(loc.coords.latitude, loc.coords.longitude, ym)[0];
    var leftLng = geotools.translateLongitude(loc.coords.latitude, loc.coords.longitude, -xm)[1];
    var startingProj = stage.constants.projector.forward([topLat, leftLng]);

    stage.constants.xMoff = startingProj[0];
    stage.constants.yMoff = startingProj[1];

    stage.constants.geoAnchor = {lat: topLat, lng: leftLng};
    // stage.constants.geoAnchor = {lng: loc.coords.longitude - (stage.state.widthDegreesPerPixel * stage.constants.gameWindowWidth) / 2,
    //                              lat: loc.coords.latitude + (stage.state.heightDegreesPerPixel * stage.constants.gameWindowHeight) / 2};
    console.log(stage.constants.geoAnchor);
    return stage.constants.geoAnchor;
  },

  setInputHandlers: function(stage, bounds){
    document.onkeydown = function(e){ gameInput.handleKey(e, stage, bounds); };
    stage.click = function(e){
      if(e.originalEvent.shiftKey){
        var clickCoords = geoFunctions.toGeoCoords(e.global, stage);
        var newCoords = {coords:
                          {latitude: clickCoords.lat,
                           longitude: clickCoords.lng},
                         timestamp: Math.floor(Date.now())};

        actions.updatePosition(stage, stage.bounds, newCoords);
      }
    };
  },
};

onLocationGet(function(loc) {
  var stage = catgame.init();
  stage.state.lastReportedLoc = loc;
  catgame.setGeoAnchor(stage, loc);
  actions.changeBounds(stage, loc);
  console.log(stage);
  actions.updatePosition(stage, stage.state.bounds, loc);
  catgame.render(stage);
  stage.state.eventLoopId = catgame.startEventLoop(stage);
  stage.positionWatcher = catgame.watchPositionLoop(stage);
});
