var gameInput = {
  handleKey: function(e, stage, bounds){
    e = e || window.event;

    if (e.keyCode == '85') {
      e.preventDefault();

      if(stage.state.lastLocObj){
        var lastCoords = stage.state.lastLocObj.coords;

        var newCoords = {coords:
          {latitude: lastCoords.latitude + stage.state.latAdj,
            longitude: lastCoords.longitude + stage.state.lngAdj},
            timestamp: Math.floor(Date.now())};

        stage.state.latAdj = 0;
        stage.state.lngAdj = 0;

        actions.updatePosition(stage, stage.state.bounds, newCoords);
      }
    }
    else if (e.keyCode == '38') {
      // up arrow
      e.preventDefault();
      stage.state.latAdj += 0.0001;
    }
    else if (e.keyCode == '40') {
      e.preventDefault();
      stage.state.latAdj -= 0.0001;
    }
    else if (e.keyCode == '37') {
      e.preventDefault();
      stage.state.lngAdj -= 0.0001;
    }
    else if (e.keyCode == '39') {
      e.preventDefault();
      stage.state.lngAdj += 0.0001;
    }
    else if (e.keyCode == '82') {
      actions.changeBounds(stage, geoFunctions.adjustedCoords(stage));
    }
    else if (e.keyCode == '67') {
      console.log({lat: stage.state.lat + stage.state.latAdj,
                   lng: stage.state.lng + stage.state.lngAdj,
                   latAdj: stage.state.latAdj,
                   lngAdj: stage.state.lngAdj});
    }
    else if (e.keyCode == '189') {
      actions.zoomOut(stage);
    }
    else if (e.keyCode == '187') {
      if(e.shiftKey){
        actions.zoomIn(stage);
      }
      else{
        actions.resetZoom(stage);
      }
    }
  }
};
