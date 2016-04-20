import Ember from 'ember';

export default Ember.Controller.extend({
  bidirectionalItems: null,

  setup() {
    this.set("bidirectionalItems", generateItems(1));
  },

  actions: {
    loadNextBidirectional() {
      return later().then(() => {
        const items   = this.get("bidirectionalItems");
        const lastNum = items.get("lastObject.num");
        items.pushObjects(generateItems(1, lastNum + 1));
      });
    },

    loadPrevBidirectional() {
      return later().then(() => {
        const items   = this.get("bidirectionalItems");
        const firstNum = items.get("firstObject.num");
        items.unshiftObjects(generateItems(1, firstNum - 1, -1).reverse());
      });
    }
  }
});

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

function later() {
  return new Ember.RSVP.Promise(resolve => {
    Ember.run.later(resolve, 100);
  });
}