import Ember from 'ember';

function generateItems(total, offset, dir=1) {
  const items = [];

  for (let i=0; i<total; i++) {
    const num = ((offset || 0) + i * dir);
    items.push(
      Ember.Object.create({
        title: "item "+num,
        num:  num
      })
    );
  }
  return Ember.A(items);
}

export default Ember.Route.extend({

  setupController: function(controller) {
    controller.set("bidirectionalItems", generateItems(1));
  },

  actions: {
    loadNextBidirectional: function(defer) {
      Ember.run.later(this, function() {
        const items   = this.get("controller.bidirectionalItems");
        const lastNum = items.get("lastObject.num");
        items.pushObjects(generateItems(1, lastNum + 1));
        defer.resolve();
      }, 250);
    },
    loadPrevBidirectional: function(defer) {
      Ember.run.later(this, function() {
        const items   = this.get("controller.bidirectionalItems");
        const firstNum = items.get("firstObject.num");
        items.unshiftObjects(generateItems(1, firstNum - 1, -1).reverse());
        defer.resolve();
      }, 250);
    }
  }

});