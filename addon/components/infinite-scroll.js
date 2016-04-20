import Ember from 'ember';

export default Ember.Component.extend({
  isLoadingNext: false,
  isLoadingPrev: false,
  isLoading: Ember.computed.or("isLoadingNext", "isLoadingPrev"),

  // if set, this is what we check for scroll events etc...
  // otherwise it's the element itself
  "scroll-container": null,

  // whether to swallow scroll events when you reach the end
  "prevent-overscroll": false,

  "viewport-top-offset": 0,

  // by default assume there's always more to load if actions are bound
  canScrollUp:   Ember.computed.notEmpty("on-load-prev"),
  canScrollDown: Ember.computed.notEmpty("on-load-next"),

  scrollBuffer:       50,
  topScrollBuffer:    null,
  bottomScrollBuffer: null,

  scrollContainer: Ember.computed("scroll-container", function() {
    const container = this.get("scroll-container");
    if (container) {
      return this.$().closest(container);
    } else {
      return this.$();
    }
  }),

  didInsertElement() {
    this._super(...arguments);
    this.setupBuffersAndScrollToTop();
    this.setupScrollHandler();
  },

  willDestroyElement() {
    this._super(...arguments);
    this.removeScrollHandler();
  },

  setBuffer(direction, height) {
    this.$(`.infinite-scroll__buffer--${direction}`).css({ height });
  },

  setBuffers() {
    if (this.get("canScrollUp")) {
      this.setBuffer("top", this.get("topScrollBuffer"));
    }

    if (this.get("canScrollDown")) {
      this.setBuffer("bottom", this.get("bottomScrollBuffer"));
    }
  },

  setupBuffersAndScrollToTop() {
    Ember.run.schedule("afterRender", this, () => {
      const buffer = this.get("scrollBuffer");

      this.set("topScrollBuffer",    buffer);
      this.set("bottomScrollBuffer", this.get("scrollContainer").height()); // ensure there's always space to scroll regardless of content
      this.setBuffers();

      // otherwise the buffers haven't been added yet
      Ember.run.schedule("afterRender", this, "scrollToTop");
    });
  },

  scrollToTop() {
    if (this.get("_state") !== "inDOM") {
      return;
    }
    this.get("scrollContainer").scrollTop(this.get("scrollBuffer"));
  },

  scrolled() {
    if (this.get("_state") !== "inDOM") {
      return;
    }

    if (this.get("isLoading")) {
      return;
    }

    const $container    = this.get("scrollContainer");
    const topBuffer     = this.get("topScrollBuffer");
    const bottomBuffer  = this.get("bottomScrollBuffer");
    const viewHeight    = $container.height();
    const contentHeight = this.get("element").scrollHeight;
    const viewTop       = $container.scrollTop();
    const viewBottom    = viewHeight + viewTop;

    const actualContentHeight = contentHeight - topBuffer - bottomBuffer;

    if (this.get("canScrollUp") && viewTop < topBuffer) {
      this.loadPrevious();
    } else if (this.get("canScrollDown") && viewBottom > (contentHeight - bottomBuffer) || actualContentHeight < viewHeight) {
      this.loadNext();
    }
  },

  restoreScrollPosition: function(item, originalOffset) {
    if (this.get("_state") !== "inDOM") {
      return;
    }

    if (!item || !item.length) {
      return;
    }

    const $container    = this.get("scrollContainer");
    const currentOffset = item.offset().top;
    const diff          = currentOffset - originalOffset;
    const currentScroll = $container.scrollTop();
    const newScroll     = currentScroll + diff;

    $container.scrollTop(newScroll);
  },

  loadPrevious() {
    this.set("isLoadingPrev", true);

    // topmost item is the first item after the buffer
    const topmostItem = this.$(".infinite-scroll__buffer--top").next();
    const offset      = topmostItem.offset().top;

    this.get("on-load-prev")().then(() => {
      Ember.run.scheduleOnce("afterRender", this, this.restoreScrollPosition, topmostItem, offset);
      Ember.run.scheduleOnce("afterRender", this, this.scrolled); // trigger a scroll to see if we need more content to fill
    }).finally(() => {
      if (this.get("_state") === "inDOM") {
        this.set("isLoadingPrev", false);
      }
    });
  },

  loadNext() {
    this.set("isLoadingNext", true);

    this.get("on-load-next")().then(() => {
      Ember.run.scheduleOnce("afterRender", this, this.scrolled); // trigger a scroll to see if we need more content to fill
    }).finally(() => {
      if (this.get("_state") === "inDOM") {
        this.set("isLoadingNext", false);
      }
    });
  },

  cancelScroll(e) {
    e.stopPropagation();
    e.preventDefault();
    e.returnValue = false;
    return false;
  },

  checkOverscroll(e) {
    const $el = this.get("scrollContainer");
    const el  = this.get("element");

    const scrollTop    = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const height       = $el.height();
    const delta        = (e.type === 'DOMMouseScroll' ? e.originalEvent.detail * -40 : e.originalEvent.wheelDelta);
    const up           = delta > 0;

    if (!up && -delta > scrollHeight - height - scrollTop) {
      $el.scrollTop(scrollHeight);
      return this.cancelScroll(e);
    } else if (up && delta > scrollTop) {
      $el.scrollTop(0);
      return this.cancelScroll(e);
    }
  },

  setupScrollHandler() {
    const _this = this;
    this.scrollHandler = function scrollHandler() {
      Ember.run.debounce(_this, 'scrolled', 10);
    };
    this.get("scrollContainer").on("touchmove scroll", this.scrollHandler);

    if (this.get("prevent-overscroll")) {
      this.checkOverscrollHandler = function checkOverscrollHandler(e) {
        _this.checkOverscroll(e);
      };
      this.get("scrollContainer").on("DOMMouseScroll mousewheel", this.checkOverscrollHandler);
    }
  },

  removeScrollHandler() {
    this.get("scrollContainer").off("touchmove scroll", this.scrollHandler);
    if (this.get("prevent-overscroll")) {
      this.get("scrollContainer").off("DOMMouseScroll mousewheel", this.checkOverscrollHandler);
    }
  }

});