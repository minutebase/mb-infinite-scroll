import Ember from 'ember';

function generateItems(total, offset, dir) {
  var items = [];
  var num;
  dir = dir || 1;

  for (var i=0; i<total; i++) {
    num = ((offset || 0) + i * dir);
    items.push(
      Ember.Object.create({
        title: "item "+num,
        num:  num
      })
    );
  }
  return items;
}

export default Ember.Route.extend({

  setupController: function(controller) {
    controller.set("bidirectionalItems", generateItems(1));
  },

  actions: {
    loadNextBidirectional: function(defer) {
      Ember.run.later(this, function() {
        var items   = this.controller.get("bidirectionalItems");
        var lastNum = items.get("lastObject.num");
        items.pushObjects(generateItems(1, lastNum + 1));
        defer.resolve();
      }, 1000);
    },
    loadPrevBidirectional: function(defer) {
      Ember.run.later(this, function() {
        var items   = this.controller.get("bidirectionalItems");
        var firstNum = items.get("firstObject.num");
        items.unshiftObjects(generateItems(1, firstNum - 1, -1).reverse());
        defer.resolve();
      }, 1000);
    }
  }

});