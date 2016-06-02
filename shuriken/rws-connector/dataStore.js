const _ = require('lodash');
const should = require('should');

module.exports = class DataStore {
  constructor() {
    this._data = {};
  }

  add(collection, objectId, fields) {
    console.log(`[  +  ] New object in ${collection}, id ${objectId}`);

    if (collection !== 'users') { //FIXME
      objectId = {'$type': 'oid', '$value': objectId};
    }
    should(fields).not.have.property('_id');
    fields._id = objectId;

    objectId = JSON.stringify(objectId);

    if (!_.has(this._data, collection)) {
      this._data[collection] = {};
    }
    should(this._data[collection]).should.not.have.property(objectId);

    this._data[collection][objectId] = fields;
  }

  remove(collection, objectId) {
    console.log(`[  -  ] Deletion in ${collection}, id ${objectId}`);

    if (collection !== 'users') {
      objectId = {'$type': 'oid', '$value': objectId};
    }
    objectId = JSON.stringify(objectId);

    should(this._data).have.property(collection);
    should(this._data[collection]).have.property(objectId);
    this._data[collection] = _.omit(this._data[collection], objectId);
  }

  change(collection, objectId, fields, cleared) {
    console.log(`[  *  ] Change in ${collection}, id ${objectId}`);

    if (collection !== 'users') { //FIXME
      objectId = {'$type': 'oid', '$value': objectId};
    }
    objectId = JSON.stringify(objectId);

    should(this._data).have.property(collection);
    should(this._data[collection]).have.property(objectId);

    this._data[collection][objectId] = _.omit(
      _.assign(this._data[collection][objectId], fields), cleared);
  }

  findOne(collection, key, value) {
    if (!_.has(this._data, collection)) {
      return undefined;
    }

    if (_.isNil(key)) {
      return _.find(this._data[collection], true);
    } else if (key === '_id') {
      value = JSON.stringify(value);
      return _.get(this._data[collection], value, undefined);
    } else {
      return _.find(this._data[collection], (fields) => {
        return _.isEqual(_.get(fields, key, undefined), value);
      });
    }
  }

  findAll(collection, key, value) {
    if (!_.has(this._data, collection)) {
      return undefined;
    }

    if (_.isNil(key)) {
      return _.map(this._data[collection], (obj) => {return obj;});
    } else if (key === '_id') {
      value = JSON.stringify(value);
      return _.get(this._data[collection], value, undefined);
    } else {
      return _.filter(this._data[collection], (fields) => {
        return _.isEqual(_.get(fields, key, undefined), value);
      });
    }
  }
};
