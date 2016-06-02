const _ = require('lodash');
const should = require('should');

module.exports = class DynamicSubscriptionManager {
  /**
   * @param {DdpWrapper} ddp
   */
  constructor(ddp) {
    this._firstTime = true;
    this._ddp = ddp;

    this._activeSubscriptions = {};
    this._subscriptionBuffer = {};
  }

  subscribe(name, args) {
    const key = this._subscriptionHash(name, args);
    this._subscriptionBuffer[key] = {name: name, args: args};
  }

  flushSubscriptions() {
    _.each(this._activeSubscriptions, (sub, key) => {
      if (!_.has(this._subscriptionBuffer, key)) {
        if (this._ddp.isLoggedIn()) {
          this._ddp.unsubscribe(sub);
          _.unset(this._activeSubscriptions, key);
        } else {
          console.log(`[  E  ] Logged out, skipping unsubscribe`);
        }
      }
    });

    _.each(this._subscriptionBuffer, (sub, key) => {
      if (!_.has(this._activeSubscriptions, key)) {
        should(sub).be.not.null();
        this._activeSubscriptions[key] =
            this._ddp.subscribe(sub.name, sub.args);
      }
    });

    this._subscriptionBuffer = {};
    this._firstTime = false;
  }

  allSubscriptionsReady() {
    return !this._firstTime && _.every(this._activeSubscriptions, (sub) => {
      return this._ddp.isReady(sub);
    });
  }

  start() {
    this._subscriptionBuffer = {};
  }

  _subscriptionHash(name, args) {
    return _.join([name, JSON.stringify(args)], '__');
  }
};
