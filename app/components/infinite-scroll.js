import Ember from 'ember';

export default Ember.Component.extend({
  classNames: "infinite-scroll",

  isLoadingNext: false,
  isLoadingPrev: false,
  isLoading: Ember.computed.or("isLoadingNext", "isLoadingPrev"),

  // if set, this is what we check for scroll events etc...
  // otherwise it's body
  "scroll-container": null,

  // whether to swallow scroll events when you reach the end
  "prevent-overscroll": false,

  "viewport-top-offset": 0,

  // by default assume there's always more to load if actions are bound
  canScrollUp:   Ember.computed.notEmpty("onLoadPrev"),
  canScrollDown: Ember.computed.notEmpty("onLoadNext"),

  itemClass: "infinite-scroll__item",
  topItem:   null,

  scrollBuffer:       50,
  topScrollBuffer:    null,
  bottomScrollBuffer: null,

  topBufferStyle: Ember.computed("topScrollBuffer", function() {
    const buffer = this.get("topScrollBuffer");
    if (this.get("canScrollUp") && buffer) {
      return new Ember.Handlebars.SafeString("height: ${buffer}px");
    }
  }),

  bottomBufferStyle: Ember.computed("bottomScrollBuffer", function() {
    const buffer = this.get("bottomScrollBuffer");
    if (this.get("canScrollDown") && buffer) {
      return new Ember.Handlebars.SafeString("height: ${buffer}px");
    }
  }),

  setupBuffersAndScrollToTop: Ember.on("didInsertElement", function() {
    Ember.run.schedule("afterRender", this, () => {
      const buffer = this.get("scrollBuffer");

      this.set("topScrollBuffer",    buffer);
      this.set("bottomScrollBuffer", this.get("scrollContainer").height() / 2); // ensure there's always space to scroll regardless of content
      this.scrollToTop();
    });
  }),

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

    this.updateTopItem();
  },

  updateTopItem() {
    // don't bother checking if nothing's listening for it
    if (!this.get("top-item-changed")) {
      return;
    }

    const items = this.items();
    if (!items.length) {
      this.set("topItem", null);
      return;
    }

    const topBuffer = this.get("viewport-top-offset");
    const topIndex  = this.findTopView(items, topBuffer, 0, items.length - 1) || items.length - 1;
    const top       = items[topIndex];
    const view      = this.container.lookup("-view-registry:main")[top.id];
    const content   = view && view.get("content");

    if (this.get("topItem") !== content) {
      this.sendAction("top-item-changed", content);
    }

    this.set("topItem", content);
  },

  /**
    Binary search for finding the topmost view on screen.
    @method findTopView
    @param {Array} childViews the childViews to search through
    @param {Number} windowTop The top of the viewport to search against
    @param {Number} min The minimum index to search through of the child views
    @param {Number} max The max index to search through of the child views
    @returns {Number} the index into childViews of the topmost view
  **/
  findTopView: function(childViews, viewportTop, min, max) {
    if (max < min) { return min; }

    while(max>min){
      const mid = Math.floor((min + max) / 2);
      // in case of not full-window scrolling
      const $view      = Ember.$(childViews[mid]);
      const viewBottom = $view.position().top + $view.height();

      if (viewBottom > viewportTop) {
        max = mid-1;
      } else {
        min = mid+1;
      }
    }

    return min;
  },

  restoreScrollPosition: function(item, originalOffset) {
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

  items() {
    return this.$("."+this.get("itemClass"));
  },

  loadPrevious() {
    this.set("isLoadingPrev", true);

    const _this = this;
    const defer = new Ember.RSVP.defer();

    const topmostItem = this.items().first();
    const offset      = topmostItem.offset().top;

    defer.promise.then(function() {
      Ember.run.scheduleOnce("afterRender", _this, _this.restoreScrollPosition, topmostItem, offset);
      Ember.run.scheduleOnce("afterRender", _this, _this.scrolled); // trigger a scroll to see if we need more content to fill
    }).finally(function() {
      _this.set("isLoadingPrev", false);
    });

    this.sendAction("onLoadPrev", defer);
  },

  loadNext() {
    this.set("isLoadingNext", true);

    const _this = this;
    const defer = new Ember.RSVP.defer();

    defer.promise.then(function(){
      Ember.run.scheduleOnce("afterRender", _this, _this.scrolled); // trigger a scroll to see if we need more content to fill
    }).finally(function() {
      _this.set("isLoadingNext", false);
    });

    this.sendAction("onLoadNext", defer);
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

  scrollContainer: Ember.computed("scroll-container", function() {
    const container = this.get("scroll-container");
    if (container) {
      return this.$().closest(container);
    } else {
      return Ember.$(window);
    }
  }),

  setupScrollHandler: Ember.on("didInsertElement", function() {
    const _this = this;
    this.scrollHandler = function scrollHandler() {
      Ember.run.debounce(_this, 'scrolled', 10);
    };

    this.checkOverscrollHandler = function checkOverscrollHandler(e) {
      _this.checkOverscroll(e);
    };

    Ember.on("touchmove scroll", this.scrollHandler, this.get("scrollContainer"));
    if (this.get("prevent-overscroll")) {
      Ember.on(
        "DOMMouseScroll mousewheel",
        this.checkOverscrollHandler,
        this.get("scrollContainer")
      );
    }
  }),

  removeScrollHandler: Ember.on("willDestroyElement", function() {
    this.get("scrollContainer").off("touchmove scroll", this.scrollHandler);
    if (this.get("prevent-overscroll")) {
      this.get("scrollContainer").off("DOMMouseScroll mousewheel", this.checkOverscrollHandler);
    }
  })

});