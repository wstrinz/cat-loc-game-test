var timeFunctions = {
  interactedRecently: function(osmData, recently) {
    return osmData.lastInteracted && moment(osmData.lastInteracted).isAfter(moment().subtract(1, 'hour'));
  },
  investigatedRecently: function(osmData, recently) {
    return osmData.lastInvestigated && moment(osmData.lastInvestigated).isAfter(moment().subtract(1, 'day'));
  },
};
