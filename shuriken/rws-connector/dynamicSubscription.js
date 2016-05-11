const _ = require('lodash');
const should = require('should');

module.exports = class DynamicSubscription {
  constructor(func, sub, unsub, isReady) {
    this._func = func;
    this._sub = sub;
    this._unsub = unsub;
    this._isReady = isReady;
    this._activeSubscriptions = {};
    this._subscriptionBuffer = {};

    this._firstTime = true;
  }

  subscribe(name, args) {
    const key = _.join([name, JSON.stringify(args)], '__');
    if (_.has(this._subscriptionBuffer, key)) {
      console.warn(`Ignoring multiple subscriptions to ${key}`);
    } else {
      if (!_.has(this._activeSubscriptions, key)) {
        //console.info(`New subscription ${key}`);
        this._subscriptionBuffer[key] = this._sub(name, args);
      } else {
        // console.info(`Ignoring already existing subscription ${key}`);
        this._subscriptionBuffer[key] = null;
      }
    }
  }

  _flushSubscriptions() {
    _.each(this._activeSubscriptions, (sub, key) => {
      if (!_.has(this._subscriptionBuffer, key)) {
        //console.info(`Removing subscription ${key}`);
        this._unsub(sub);
        _.unset(this._activeSubscriptions, key);
      }
    });

    _.each(this._subscriptionBuffer, (sub, key) => {
      if (!_.has(this._activeSubscriptions, key)) {
        should(sub).be.not.null();
        this._activeSubscriptions[key] = sub;
      }
    });

    this._subscriptionBuffer = {};
    this._firstTime = false;
  }

  run(args) {
    this._func.apply(this, arguments);
    this._flushSubscriptions();
  }

  ready() {
    return !this._firstTime && _.every(this._activeSubscriptions, (sub) => {
      return this._isReady(sub);
    });
  }
};
