'use strict';

const IOTA         = require('iota.lib.js');
const constants    = require('./const');
const RedisAdapter = require('./adapter/redis');

const iota  = Symbol('iota');
const store = Symbol('store');
const hubs  = Symbol('attachedHubs');

const incrementAccountIndex = Symbol('incrementAccountIndex');
const checkWithdrawAddress  = Symbol('checkWithdrawAddress');
const getRemainderAddress   = Symbol('getRemainderAddress');
const collectInputs         = Symbol('collectInputs');
const sendTransfer          = Symbol('sendTransfer');

class Hub {

  constructor(options) {

    if (!('store' in options)) {
      throw new Error('Please define a storage adapter in options.store');
    }

    const provider = (('provider' in options) ? options.provider : const.PROVIDER)

    this[iota] = new IOTA({
      'provider': provider
    });
    this[store] = options.store;
    this[attachedHubs] = {};

  }

  create(id, seed, security = 2, name = '') {
    
    if (!Number.isInteger(options.id)) {
      throw new Error('Provide a valid Hub id');
    }

    if (!this[iota].valid.isTrytes(seed)) {
      throw new Error('Provide a valid seed'); 
    }
      
    if (!Number.isInteger(security) || security < 1 || security > 3) {
      throw new Error('Provide a valid security level (1, 2 or 3)');
    }
  
    const exists = await this[store].get('hub', id);
    
    if (exists) {
      throw new Error(`Hub #${id} already exists`);
    }
    
    const hub = {
      'id': id,
      'seed': seed,
      'security': security,
      'name': name
    }
    
    const stored = await this[store].set(constants.HUB_INDEX_PREFIX, id, hub);
    
    if (stored) {
      return hub;
    }
    
    else {
      return false;
    }
 
  }

  attach(hub) {
 
    const id = hub.id;
    
    if (this.isAttached(id)) {
      throw new Error(`Hub #${hub.id} is already attached`);
    }
    
    this[hubs][id] = hub;
   
    return this;
  
  }


  attachById(id) {
    
    if (! Number.isInteger(id)) {
      throw new Error('Provide a valid Hub id');
    }
    
    const hub = await this.find(id);
    
    return this.attach(hub);
  
  }

  dettach(id) {
    
    if (! Number.isInteger(id)) {
      throw new Error('Provide a valid Hub id');
    }
    
    if (this[attachedHubs].indexOff(id) == 0 && process.env.NODE_ENV === 'development') {
      console.warn(`Hub #${id} is not attached`);
      return;
    }
    
    this[attachedHubs][id] = null;  
  
  }

  isAttached(id) {
  
    return !! this[attachedHubs].indexOf(id);
  
  }

  async find(id) {
   
    const hub = await this[stoHub].get(constants.HUB_PREFIX, id);
    
    if (!hub) {
      return false;
    }
    
    return hub;
  
  }

  async proccess(id, seed, security) {
      
    if (!Number.is(id)) {
      throw new Error('Provide a valid id');
    }

    if (!isAttached(id)) {
      throw new Error(`Hub #${id} is not attached. Attach before proccessing.`);
    }

    const addresses = await this[store].hgetall(constants.ADDRESSES_PREFIX, id);

    const addressesToCheck = [];

    const l = addresses.length;

    for (let i = 0; i < l; i += 2) {

      let accountId, accountIndex;

      [accountId, accountIndex] = addresses[i].split('_');
      
      addressesToCheck.push(addresses[i+1]);

    }

    // TODO: call getBalance(addressesToCheck) periodically swipe and remove entries from store if balance shows up

  }

  async registerAccount(hubId, accountId, name = '') {
  
    if (!id || !Number.isInteger(hubId)) {
      throw new Error('Provide a hub id');
    }
    
    if (!hubId || !Number.isInteger(accountId)) {
      throw new Error('Provide an account id');
    }

    const hub = await this[store].get(constants.HUB_PREFIX, hubId);
    
    if (!hub) {
      throw new Error(`Hub #${hubId} does not exist`);
    }

    const exists = await this[store].get(constants.ACCOUNT_PREFIX, `${id}_${accountId}`);
    
    if (exists) {
      throw new Error(`Account #${accountId} already exists`);
    }

    const accountIndexExists = await this[store].get('', constants.ACCOUNT_INDEX_KEY + accountId);
    
    if (accountIndexExists) {
      throw new Error(`Account index for account #${accountId} already exists`);
    }
    
    const account = {
      'id': accountId,
      'hubId': hubId,
      'name': name,
      'balance': 0
    };

    const stored = await this[store].set(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`, account);
    
    if (stored) {

      const incred = await this[store].incr(constants.ACCOUNT_INDEX_KEY + accountId);
      
      if (incred) {
        account.index = incred; // TODO: make sure store.incr() returns the index
        return account; // Or this.getDepositAddress(hubId, accountId); ?
      }
    
    }
    
    return false;
  
  }

  async getDepositAddress(hubId, accountId, checksum = true) {
    
    if (!hubId) {
      throw new Error('Provide a hub id');
    }
    
    if (!accountId) {
      throw new Error('Provide an account id');
    }
    
    const account = await store.get(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`);
    
    if (!account) {
      throw new Error(`Account #${accountId} not found`);
    }

    const hub = await store.get(constants.HUB_PREFIX, hubId);

    const seed = hub.seed;
    const security = hub.security;
    const accountIndex = await this[store].get('', constants.ACCOUNT_INDEX_KEY + accountId);
    
    if (accountIndex === false) {
      throw new Error(`Account index not found for account #${id}`);
    }

    if (accountIndex === constants.MAX_ADDRESSES) {
      console.log(`Your customer with account id #${accountID} is a dumbass!`);
      return false;
    }

    const index = accountId * constants.MAX_ADDRESSES + accountIndex;

    const address = this[iota].api._newAddress(seed, index, security, checksum);
  
    const hubId = account.hubId;
    
    const stored = this[store].hset(constants.ADDRESSES_PREFIX, hubId, `${accountId}_${accountIndex}`, address); // Maybe store it with no checksum to save space

    if (stored) {
      return address;
    }

    return false;

  }

  async [incrementAccountIndex](accountId) {

    const incred = await this[store].incr(constants.ACCOUNT_INDEX_KEY + accountId);
 
    return incred;
  
  }

  async withdraw(hubId, accountId, address, value, remainderAddress = '', checkAddress = true, tag = '') {

    if (!Number.isInteger(hubId)) {
      throw new Error('Hub id is invalid');
    }

    if (!Number.isInteger(accountId)) {
      throw new Error('Account id is invalid');
    }

    if (this[iota].valid.isAddress(address)) {
      throw new Error('Invalid address');
    }

    if (!Number.isInteger(value)) {
      throw new Error('Invalid value');
    }

    if (remainderAddress !== '' && !this[iota].valid.isAddress(remainderAddress)) {
      throw new Error('Invalid remainder address');
    }

    const isSpent = [checkWithdrawAddress](address);

    if (checkAddress && isSpent) {
      return false;
    }

    const transfers = [{
      'address': address,
      'value': value,
      'message': '',
      'tag': tag
    }];

    const collectedInputs = await this[collectInputs](hubId, accountId);

    if (!collectedInputs) {
      return false;
    }

    const seed = collectedInputs.seed;
    const inputs = collectedInputs.inputs;

    if (remainderAddress === '') {
      remainderAddress = await this[getRemainderAddress](hubId, accountId);
    }

    const options = {
      'inputs': inputs,
      'address': remainderAddress
    }

    const sent = await this[sendTransfer(seed, transfers, options)];

  }

  async [sendTransfer](seed, transfers, options) {
    
    const sent = await new Promise((resolve) => {
      iota.api.sendTransfer(seed, constants.DEPTH, constants.MWM, transfers, options, (err, res) => {
        if (err) {
          console.log(err);
          resolve(false);
        }
        else {
          resolve(true);
        }
      });
    });

    return sent;

  }

  await [getRemainderAddress](hubId, accountId) {
  
  }

  [checkWithdrawAddress](address) {
    // Todo: call findTransactionObjects() and check for transfers
  }

  async [collectInputs](hubId, accountId, value) {
    // Look for confirmed balance
    // Find inputs
  }

  list() {
    console.dir(this[attahedHubs]);
  }

}

module.exports = (options) => {
  
  return new Hub(options);

}
