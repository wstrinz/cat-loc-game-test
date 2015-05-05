var displayFunctions = {
  descriptionForObject: function(obj){
    if(obj.tags.amenity){
      return "A " + obj.tags.amenity;
    }
    else if(obj.tags.building){
      return "A Building";
    }
    else{
      return JSON.stringify(obj.tags,null,2);
    }
  }
};
