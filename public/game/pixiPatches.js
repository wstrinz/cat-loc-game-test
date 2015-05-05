PIXI.DisplayObject.prototype.clean = function(remove)
{
  var rmv = remove || false;
  for (var i = 0; i < this.children.length; i++) {
    this.children[i].clean(true);
  }
  this.removeChildren();
  if(rmv)
  {
    this.parent.removeChild(this);
    if (this instanceof PIXI.Text)
      this.destroy(true);
    else if(this instanceof PIXI.TilingSprite && this.tilingTexture)
      this.tilingTexture.destroy(true);
    else if(typeof this.destroy == 'function')
      this.destroy(false);
  }
};
