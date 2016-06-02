const _ = require('lodash');
const DDP = require('ddp.js').default;
const should = require('should');
const EventEmitter = require('events');

module.exports = class DdpWrapper extends EventEmitter {
  constructor(ddpOptions, dataStore) {
    super();

    this._methodCallbacks = {};
    this._subscriptionReady = {};
    this._subscriptionError = {};
    this._isConnected = false;

    this._ddp = new DDP(ddpOptions);
    this._dataStore = dataStore;

    this._user = undefined;
    this._password = undefined;
    this._isLoggedIn = false;

    this._ddp.on('connected', (msg) => {this._handleConnectedMessage(msg);});
    this._ddp.on('disconnected', (msg) =>
        {this._handleDisconnectedMessage(msg);});

    this._ddp.on('ready', (msg) => {this._handleReadyMessage(msg);});
    this._ddp.on('added', (msg) => {this._handleAddedMessage(msg);});
    this._ddp.on('changed', (msg) => {this._handleChangedMessage(msg);});
    this._ddp.on('removed', (msg) => {this._handleRemovedMessage(msg);});
    this._ddp.on('nosub', (msg) => {this._handleNoSubMessage(msg);});
    this._ddp.on('result', (msg) => {this._handleResultMessage(msg);});
    this._ddp.on('updated', (msg) => {this._noOp(msg);});
  }

  isReady(subscriptionId) {
    should(this._subscriptionReady).have.property(subscriptionId);

    return this._subscriptionReady[subscriptionId];
  }

  isConnected() {
    return this._isConnected;
  }

  isLoggedIn() {
    return this._isLoggedIn;
  }

  setUser(user, password) {
    this._user = user;
    this._password = password;
  }

  login() {
    should(this._user).be.ok();
    should(this._password).be.ok();

    const loginParameters = {
      user: {username: this._user},
      password: this._password,
    };

    if (this.isConnected()) {
      console.log(`[     ] Logging in`);
      this.method('login', loginParameters, (err) => {
        if (_.isNil(err)) {
          console.log(`[ DDP ] Logged in`);
          this._isLoggedIn = true;

          this.emit('loggedIn');
        } else {
          const strErr = JSON.stringify(err);
          console.log(`[  E  ] Error while logging in: ${strErr}`);
        }
      });
    }
  }

  subscribe(name, params) {
    should(this._isLoggedIn).be.true();
    const paramsArray = _.castArray(params);

    const subId = this._ddp.sub(name, paramsArray);
    console.log(`[ SUB ] New subscription to ${name} (ID: ${subId})`);

    should(this._subscriptionReady).not.have.property(subId);
    should(this._subscriptionError).not.have.property(subId);

    // Set as not ready.
    this._subscriptionReady[subId] = false;
    this._subscriptionError[subId] = null;

    return subId;
  }

  unsubscribe(subscriptionId) {
    should(this._isLoggedIn).be.true();

    console.log(`[UNSUB] Delete subscription ID ${subscriptionId}`);

    should(this._subscriptionReady).have.property(subscriptionId);
    should(this._subscriptionError).have.property(subscriptionId);

    this._subscriptionReady = _.omit(this._subscriptionReady, subscriptionId);
    this._subscriptionError = _.omit(this._subscriptionError, subscriptionId);
    this._ddp.unsub(subscriptionId);
  }

  /**
   * Start an RPC via DDP.
   *
   * @param {String} name Method name.
   * @param {Array} params Method arguments.
   * @param {Function} callback Callback invoked when the result is ready.
   * @see https://github.com/mondora/ddp.js/#ddpmethodname-params
   */
  method(name, params, callback) {
    if (name !== 'login') {
      should(this._isLoggedIn).be.true();
    }

    const paramsArray = _.castArray(params);
    const rpcId = this._ddp.method(name, paramsArray);
    this._methodCallbacks[rpcId] = callback;
  }

  /**
   * Forcefully quit the connection.
   */
  disconnect() {
    this._ddp.disconnect();
  }

  _handleConnectedMessage() {
    console.log(`[ DDP ] Connected`);
    this._isConnected = true;

    if (!_.isNil(this._user)) {
      this.login();
    }

    this.emit('connected');
  }

  _handleDisconnectedMessage() {
    this._isConnected = false;

    this.emit('disconnected');
  }

  _handleReadyMessage(msg) {
    const subIds = msg.subs;
    _.each(subIds, (subId) => {
      console.log(`[  @  ] Subscription ID ${subId} marked as ready`);

      if (_.has(this._subscriptionReady, subId)) {
        this._subscriptionReady[subId] = true;
      } else {
        // Probably the subscription was cancelled right after being created.
      }
    });

    this.emit('subscriptionReady', msg);
  }

  _handleAddedMessage(msg) {
    const collection = msg.collection;
    const objectId = msg.id;
    const fields = msg.fields;

    this._dataStore.add(collection, objectId, fields);

    this.emit('documentAdded', msg);
  }

  _handleChangedMessage(msg) {
    const collection = msg.collection;
    const objectId = msg.id;
    const fields = msg.fields;
    const cleared = msg.cleared;

    this._dataStore.change(collection, objectId, fields, cleared);

    this.emit('documentChanged', msg);
  }

  _handleRemovedMessage(msg) {
    const collection = msg.collection;
    const objectId = msg.id;

    this._dataStore.remove(collection, objectId);

    this.emit('documentRemoved', msg);
  }

  _handleNoSubMessage(msg) {
    const subId = msg.id;
    const error = msg.error;

    if (_.has(this._subscriptionError, subId)) {
      this._subscriptionError[subId] = error;
    }

    console.log(`[  E  ] Error while subscribing (ID: ${subId}): ` +
        JSON.stringify(error));

    this.emit('subscriptionFailed', msg);
  }

  _handleResultMessage(msg) {
    const rpcId = msg.id;
    const result = msg.result;
    const error = msg.error;

    should(this._methodCallbacks).have.property(rpcId);
    this._methodCallbacks[rpcId](error, result);
  }

  _noOp(msg) {}
};
