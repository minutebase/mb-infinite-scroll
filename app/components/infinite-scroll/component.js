import Ember from 'ember';

export default Ember.Component.extend({
  classNames: "infinite-scroll",

  isLoadingNext: false,
  isLoadingPrev: false,
  isLoading: Ember.computed.any("isLoadingNext", "isLoadingPrev"),

  // by default assume there's always more to load if actions are bound
  canScrollUp:   Ember.computed.notEmpty("onLoadPrev"),
  canScrollDown: Ember.computed.notEmpty("onLoadNext"),

  itemClass: "infinite-scroll__item",
  topItem:   null,
  topItemBuffer: 0,

  scrollBuffer:       50,
  topScrollBuffer:    null,
  bottomScrollBuffer: null,

  topBufferStyle: function() {
    var buffer = this.get("topScrollBuffer");
    if (this.get("canScrollUp") && buffer) {
      return "height: " + buffer + "px";
    }
  }.property("topScrollBuffer"),

  bottomBufferStyle: function() {
    var buffer = this.get("bottomScrollBuffer");
    if (this.get("canScrollDown") && buffer) {
      return "height: " + buffer + "px";
    }
  }.property("bottomScrollBuffer"),

  setupBuffersAndScrollToTop: function() {
    var buffer = this.get("scrollBuffer");

    this.set("topScrollBuffer",    buffer);
    this.set("bottomScrollBuffer", this.$().height()); // ensure there's always space to scroll regardless of content

    Ember.run.schedule("afterRender", this, this.scrollToTop);
  }.on("didInsertElement"),

  scrollToTop: function() {
    if (this.get("_state") !== "inDOM") {
      return;
    }
    this.$().scrollTop(this.get("scrollBuffer"));
  },

  scrolled: function() {
    if (this.get("_state") !== "inDOM") {
      return;
    }

    if (this.get("isLoading")) {
      return;
    }

    var $el           = this.$();
    var topBuffer     = this.get("topScrollBuffer");
    var bottomBuffer  = this.get("bottomScrollBuffer");
    var viewHeight    = $el.height();
    var contentHeight = this.get("element").scrollHeight;
    var viewTop       = $el.scrollTop();
    var viewBottom    = viewHeight + viewTop;

    var actualContentHeight = contentHeight - topBuffer - bottomBuffer;

    if (this.get("canScrollUp") && viewTop < topBuffer) {
      this.loadPrevious();
    } else if (this.get("canScrollDown") && viewBottom > (contentHeight - bottomBuffer) || actualContentHeight < viewHeight) {
      this.loadNext();
    }

    this.updateTopItem();
  },

  // TODO - don't bother if we don't have views to find
  updateTopItem: function() {
    var items = this.items();
    if (!items.length) {
      this.set("topItem", null);
      return;
    }

    var found   = this.findTopView(items, this.get("topItemBuffer"), 0, items.length - 1) || items[items.length - 1];
    var view    = Ember.View.views[found.id];
    var content = null;

    if (view) {
      content = view.get("content");
    }

    this.set("topItem", content);
  },

  findTopView: function(childViews, topBuffer, min, max) {
    if (max < min) {
      return childViews[min];
    }

    var mid         = Math.floor((min + max) / 2);
    var $view       = $(childViews[mid]);
    var viewBottom  = $view.offset().top + $view.outerHeight(true);
    var viewportTop = this.$().offset().top;

    if (viewBottom > viewportTop) {
      return this.findTopView(childViews, topBuffer, min, mid-1);
    } else {
      return this.findTopView(childViews, topBuffer, mid+1, max);
    }
  },

  restoreScrollPosition: function(item, originalOffset) {
    if (!item || !item.length) {
      return;
    }

    var currentOffset = item.offset().top;
    var diff          = currentOffset - originalOffset;
    var currentScroll = this.$().scrollTop();
    var newScroll     = currentScroll + diff;

    this.$().scrollTop(newScroll);
  },

  items: function() {
    return this.$("."+this.get("itemClass"));
  },

  loadPrevious: function() {
    this.set("isLoadingPrev", true);

    var _this = this;
    var defer = new Ember.RSVP.defer();

    var topmostItem = this.items().first();
    var offset      = topmostItem.offset().top;

    defer.promise.then(function() {
      Ember.run.scheduleOnce("afterRender", _this, _this.restoreScrollPosition, topmostItem, offset);
      Ember.run.scheduleOnce("afterRender", _this, _this.scrolled); // trigger a scroll to see if we need more content to fill
    }).finally(function() {
      _this.set("isLoadingPrev", false);
    });

    this.sendAction("onLoadPrev", defer);
  },

  loadNext: function() {
    this.set("isLoadingNext", true);

    var _this = this;
    var defer = new Ember.RSVP.defer();

    defer.promise.then(function(){
      Ember.run.scheduleOnce("afterRender", _this, _this.scrolled); // trigger a scroll to see if we need more content to fill
    }).finally(function() {
      _this.set("isLoadingNext", false);
    });

    this.sendAction("onLoadNext", defer);
  },

  cancelScroll: function(e) {
    e.stopPropagation();
    e.preventDefault();
    e.returnValue = false;
    return false;
  },

  checkOverscroll: function(e) {
    var $el = this.$();
    var el  = this.get("element");

    var scrollTop    = el.scrollTop;
    var scrollHeight = el.scrollHeight;
    var height       = $el.height()
    var delta        = (e.type == 'DOMMouseScroll' ? e.originalEvent.detail * -40 : e.originalEvent.wheelDelta);
    var up           = delta > 0;

    if (!up && -delta > scrollHeight - height - scrollTop) {
      $el.scrollTop(scrollHeight);
      return this.cancelScroll(e);
    } else if (up && delta > scrollTop) {
      $el.scrollTop(0);
      return this.cancelScroll(e);
    }
  },

  setupScrollHandler: function() {
    var _this = this;
    this.scrollHandler = function scrollHandler(e) {
      Ember.run.debounce(_this, 'scrolled', 10);
    };

    this.checkOverscrollHandler = function checkOverscrollHandler(e) {
      _this.checkOverscroll(e);
    }

    this.$().on("touchmove scroll",          this.scrollHandler);
    this.$().on("DOMMouseScroll mousewheel", this.checkOverscrollHandler);
  }.on("didInsertElement"),

  removeScrollHandler: function() {
    this.$().off("touchmove scroll",          this.scrollHandler);
    this.$().off("DOMMouseScroll mousewheel", this.checkOverscrollHandler);
  }.on("willDestroyElement")

});