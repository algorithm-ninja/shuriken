'use strict';

const _ = require('lodash');

/**
 * Defines a reactive dict (similar to ReactiveDict), without using EJSON.
 * This is necessary since we don't care about serializability, while we care
 * about preserving object integrity when assigning.
 */
export class ReactiveMap {
  constructor() {
    // Internal dictionary.
    this._data = {};

    // Keeps track about who used .all() or .get().
    this._allDeps = new Tracker.Dependency();

    // Keeps track about who is interested in which keys. Notice that the keys
    // in _keyDeps may be a superset of the keys in _data. Indeed, we keep track
    // of requests of keys which don't necessarily exist in _data, calling
    // the observer when the key becomes available.
    this._keyDeps = {};
  }

  /**
   * Sets one key to a value.
   *
   * @param {Any} key The key.
   * @param {Any} value The value.
   */
  set(key, value) {
    let isNewKey = !_.has(this._data, key);
    let isUpdate = isNewKey ? true : (_.get(this._data, key) !== value);

    // If this is a new key, create a new Dependency object for the key.
    if (!_.has(this._keyDeps, key)) {
      this._keyDeps[key] = new Tracker.Dependency();
    }
    this._data[key] = value;

    // If this is an update or a new key, notify all observers.
    if (isUpdate) {
      this._allDeps.changed();
      this._keyDeps[key].changed();
    }
  }

  /**
   * Returns the value given its key.
   *
   * @param {Any} key
   * @return {Any} value
   */
   get(key) {
     if (!_.has(this._keyDeps, key)) {
       this._keyDeps[key] = new Tracker.Dependency();
     }
     this._keyDeps[key].depend();
     return _.get(this._data, key, undefined);
   }

   /**
    * Returns the internal dict.
    *
    * @return {Object}
    */
   all() {
     this._allDeps.depend();
     return _.cloneDeep(this._data);
   }

   /**
    * Returns the number of keys currently stored. You can use it reactively.
    *
    * @return {Number}
    */
   size() {
     return _.size(this.all());
   }

   /**
    * Clears the structure.
    */
   clear() {
     const oldData = this._data;
     this._data = {};

     this._allDeps.changed();
     _.each(oldData, (value, key) => {
       this._keyDeps[key].changed();
     });
   }

}
