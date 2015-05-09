var geometryGen = {
  addNode: function(nodeData, stage, bounds){
    var newNode = factories.node(nodeData, stage);

    if(newNode.graphicsTap) {
      stage.containers.nodeContainer.addChild(newNode.graphics);
      //newNode.graphics.tap = newNode.graphics.click = function(evt){
        //newNode.graphics.visible = true;
        //var oldTint = newNode.graphics.tint;
        //var oldAlpha = newNode.graphicsTap.alpha;
        //newNode.graphics.tint = 0x1662AF;
        //newNode.graphicsTap.alpha = 0.6;
        //stage.entities.infoBox.showFn(nodeData, evt.global, evt.target, function(){
          //newNode.graphics.tint = oldTint;
          //newNode.graphicsTap.alpha = oldAlpha;
        //});
      //};
    }
    else{
      stage.containers.backgroundNodeContainer.addChild(newNode.graphics);
    }
  },

  addBuilding: function(way, nodes, stage, bounds){
    var building = factories.building(way, nodes, stage);
    building.graphics.tap = building.graphics.click = function(evt){
      stage.entities.infoBox.showFn(way, evt.global, evt.target);
    };
    stage.containers.buildingContainer.addChild(building.graphics);
  },

  addRoad: function(way, nodes, stage, bounds){
    stage.containers.roadContainer.addChild(factories.road(way, nodes));
  },

  addUnknownTile: function(tileBounds, stage, bounds){
    var unknownTile = factories.unknownTile(tileBounds, stage, bounds);
    unknownTile.graphics.tap = unknownTile.graphics.click = function(evt){
      unknownTile.graphics.tint = 0x4C5AB3;
      geometryGen.loadTile(tileBounds, unknownTile, stage, bounds);
    };
    stage.containers.tileContainer.addChild(unknownTile.graphics);
  },

  addArea: function(way, nodes, stage, bounds){
    var area = factories.otherArea(way, nodes, bounds);
    area.graphics.tap = area.graphics.click = function(evt){
      stage.entities.infoBox.showFn(way, evt.global, evt.target);
    };
    geometryGen.helpers.containerForArea(stage, way).addChild(area.graphics);
  },

  loadNodes: function(stage, bounds, cb) {
    $.get('/nodes', {bounds: bounds}, function(resp) {
      stage.state.tilecount = resp.tileCount;
      $.map(resp.nodes, function(node) {
        geometryGen.addNode(node, stage, bounds);
      });
      $.map(resp.tiles, function(tile) {
        geometryGen.addUnknownTile(tile, stage, bounds);
      });

      if(cb)
        cb(stage, bounds, resp.nodes);
    });
  },

  loadTile: function(tile, unknownTile, stage, bounds){
    $.post('/load_tile', {tile: tile}, function(resp) {
      stage.containers.tileContainer.removeChild(unknownTile.graphics);
      var nodes = resp.nodes;

      $.map(resp.nodes, function(node) {
        geometryGen.addNode(node, stage, bounds);
      });

      $.map(resp.ways, function(way) {
        if(way.tags.highway){
          geometryGen.addRoad(way, nodes, stage, bounds);
        }
        else if (way.tags.building == "yes" || way.tags.building == "residential"){
          geometryGen.addBuilding(way, nodes, stage, bounds);
        }
        else if (way.tags.leisure == "park") {
          geometryGen.addArea(way, nodes, stage, bounds);
        }
      });
    });
  },

  loadWays: function(stage, bounds, nodes) {
    $.get('/ways', {bounds: bounds}, function(resp) {
      stage.state.tilecount = resp.tileCount;
      var skipped = $.map(resp.ways, function(way) {
        if(way.tags.highway){
          geometryGen.addRoad(way, nodes, stage, bounds);
        }
        else if (way.tags.building == "yes" || way.tags.building == "residential"){
          geometryGen.addBuilding(way, nodes, stage, bounds);
        }
        else if (geoFunctions.hasAreaTag(way)) {
          geometryGen.addArea(way, nodes, stage, bounds);
        }
        else{
          return way.tags;
        }
      });

      console.log('skipped', _.uniq(skipped));

      actions.updatePosition(stage, stage.state.bounds, geoFunctions.adjustedCoords(stage));
    });
  },

  helpers: {
    containerForArea: function(stage, way){
      if(way.tags.leisure){
        var lt = way.tags.leisure;
        if(lt == "park"){
          return stage.containers.otherAreaContainer;
        }
        else {
          return stage.containers.buildingContainer;
        }
      }
      else{
        return stage.containers.otherAreaContainer;
      }
    },
  }
};
