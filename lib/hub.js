'use strict';

const IOTA         = require('iota.lib.js');
const constants    = require('./const');

const iota              = Symbol('iota');
const store             = Symbol('store');
const attachedHubs      = Symbol('attachedHubs');
const hotWalletSeed     = Symbol('hotWalletSeed');
const hotWalletSecurity = Symbol('hotWalletSecurity');

const incrementAccountIndex  = Symbol('incrementAccountIndex');
const getNewHotWalletAddress = Symbol('getNewHotWalletAddress');
const collectInputs          = Symbol('collectInputs');
const sendTransfer           = Symbol('sendTransfer');
const sweep                  = Symbol('sweep');
const credit                 = Symbol('credit');

class Hub {

  constructor(options) {

    if (!('store' in options)) {
      throw new Error('Please define a storage adapter in options.store');
    }

    if (!('seed' in options)) {
      throw new Error('Provide the seed of your hot wallet');
    }

    const seed = options.seed;

    const security = ('security' in options) ? options.security : 2;

    const provider = (('provider' in options) ? options.provider : constants.PROVIDER)

    this[iota] = new IOTA({
      'provider': provider
    });

    if (!this[iota].valid.isTrytes(seed)) {
      throw new Error('Provide a valid seed for your hot wallet');
    }

    this[hotWalletSeed] = seed;

    this[hotWalletSecurity] = security;

    this[store] = options.store;
    
    this[attachedHubs] = {};

  }

  async create(id, seed, security = 2, name = '') {
    
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


  async attachById(id) {
    
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
    
    if (this[attachedHubs].indexOf(id) == 0 && process.env.NODE_ENV === 'development') {
      console.warn(`Hub #${id} is not attached`);
      return;
    }
    
    this[attachedHubs][id] = null;  
  
  }

  isAttached(id) {
  
    return !! this[attachedHubs].indexOf(id);
  
  }

  async find(id) {
   
    const hub = await this[store].get(constants.HUB_PREFIX, id);
    
    if (!hub) {
      return false;
    }
    
    return hub;
  
  }

  async proccess(id) {
      
    if (!Number.is(id)) {
      throw new Error('Provide a valid Hub id');
    }

    if (!isAttached(id)) {
      throw new Error(`Hub #${id} is not attached. Attach before processing.`);
    }

    const addresses = await this[store].hgetall(constants.ADDRESSES_PREFIX, id);

    const addressesLength = addresses.length;

    const accountsToCheck = [];
    const addressesToCheck = [];
    const indexes = [];

    const l = addresses.length;

    for (let i = 0; i < l; i += 2) {

      if (Math.random() > Math.exp(- (addresses.size - i - 1) * constants.SWEEP_CHECK_DECAY)) {
        continue;
      }

      let accountId, keyIndex;

      [accountId, keyIndex] = addresses[i].split('_');
      
      accountsToCheck.push(accountId);
      addressesToCheck.push(addresses[i+1]);
      indexes.push(keyIndex);

    }

    const addressesToSweep = [];
    const indexesToSweep = [];
    const accountsToSweep = [];
    const balancesToSweep = [];

    const balances = await this.getBalances(addressesToCheck);

    if (addressesToCheck.length !== balances.length) {
      throw new Error(`Could not load addresses while processing hub #${id}`);
    }

    balances.forEach((balance, i) => {
      
      if (balance !== 0) {
        addressesToSweep.push(addressesToCheck[i]);
        indexesToSweep.push(indexes[i]);
        accountsToSweep.push(accountsToCheck[i]);
        balancesToSweep.push(balance);
      }
    
    });

    await Promise.all(addressesToSweep.forEach(async (from, i) => {

      await this[sweep](id, from, indexesToSweep[i], balancesToSweep[i], accountsToSweep[i]);
    
    }));

  }

  async [getNewHotWalletAddress]() {

    const index = await this[store].incr('', constants.HOT_WALLET_INDEX_KEY);
  
    return this[iota]._newAddress(this[hotWalletSeed], index, this[hotWalletSecurity]);
  
  }

  async [sweep](id, from, keyIndex, value, accountId) {
     
    const hub = this[attachedHubs][id]
    
    const seed = hub.seed;
    const security = hub.security;
    
    const to = this[getNewHotWalletAddress];

    const transfers = [{
      'address': to,
      'value': value, 
      'message': '',
      'tag': ''
    }];

    const options = {
      inputs: [{
        'address': from,
        'keyIndex': keyIndex,
        'security': security
      }]
    };

    const sent = await new Promise((resolve) => {
      
      this[iota].api.sendTransfer(seed, transfers, options, (err, res) => {
      
        if (err) {
          console.log(err);
          resolve(false);
        }
        else {
          resolve(true);
        }
      
      });
    
    });

    if (sent) {
    
      const saveSweep = await this[store].rpush(constants.PENDING_SWEEPS_PREFIX, hubId, `${from}_${to}_${accountId}`);
      
      if (!saveSweep) {
        throw new Error(`Could not save sweep from address ${address} for account #${accountId}`);
      }
    
    }
    else {
     
      const saveFailedSweep = await this[store].rpush(constants.FAILING_SWEEPS_PREFIX, hubId, `${address}_${accountId}`);
      
      if (!saveFailedSweep) {
        throw new Error(`Could not save sweep from address ${adddress} for account #${accountId}`);
      }
    
    }

  }

  async [credit](accountId, value) {
  
  }

  async registerAccount(hubId, accountId, name = '') {
  
    if (!hubId || !Number.isInteger(hubId)) {
      throw new Error('Provide a hub id');
    }
    
    if (!accountId || !Number.isInteger(accountId)) {
      throw new Error('Provide an account id');
    }

    const hub = await this[store].get(constants.HUB_PREFIX, hubId);
    
    if (!hub) {
      throw new Error(`Hub #${hubId} does not exist`);
    }

    const exists = await this[store].get(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`);
    
    if (exists) {
      throw new Error(`Account #${accountId} already exists`);
    }

    const accountIndexExists = await this[store].get(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);
    
    if (accountIndexExists) {
      throw new Error(`Account index for account #${accountId} already exists`);
    }
    
    const account = {
      'id': accountId,
      'hubId': hubId,
      'name': name,
      'balance': 0 // confirmed balance after crediting the user
    };

    const stored = await this[store].set(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`, account);
    
    if (stored) {

      const incred = await this[store].incr(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);
      
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
    const accountIndex = await this[store].get(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);
    
    if (accountIndex === false) {
      throw new Error(`Account index not found for account #${id}`);
    }

    if (accountIndex === constants.MAX_ADDRESSES) {
      console.log(`Your customer with account id #${accountId} is a dumbass!`);
      return false;
    }

    const index = accountId * constants.MAX_ADDRESSES + accountIndex;

    const address = this[iota].api._newAddress(seed, index, security, checksum);
    
    const stored = this[store].hset(constants.ADDRESSES_PREFIX, hubId, `${accountId}_${accountIndex}`, address); // Maybe store it with no checksum to save space

    if (stored) {
      return address;
    }

    return false;

  }

  async [incrementAccountIndex](accountId) {

    const incred = await this[store].incr(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);
 
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

    const isSpent = this.isSpent(address);

    if (checkAddress && isSpent) {
      return false;
    }

    if (!checkBalance(hubId, accountId, value)) {
      return false;
    }

    const transfers = [{
      'address': address,
      'value': value,
      'message': '',
      'tag': tag
    }];

    const collectedInputs = await this[collectInputs](value);

    if (!collectedInputs) {
      return false;
    }

    const seed = this[hotWalletSeed];
    const inputs = collectedInputs.inputs;

    if (remainderAddress === '') {
      remainderAddress = await this[getNewHotWalletAddress](hubId, accountId);
    }

    const options = {
      'inputs': inputs,
      'address': remainderAddress
    }

    const sent = await this[sendTransfer(seed, transfers, options)];

    if (sent) {
      return true;
    }

    return false;

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

  async isSpent(address) {
    // TODO: call findTransactionObjects() and check for transfers
  }

  async [collectInputs](value) {
    // TODO: Collect inputs from hot wallet
  }

  async checkBalance(hubId, accountId, value) {

    const account = await this[store].get(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`);

    if (!account) {
      throw new Error(`Account #${accountId} not found`);
    }

    if (value > account.balance) {
      return false;
    }

    return true;

  }

  list() {
    console.dir(this[attahedHubs]);
  }

}

module.exports = (options) => {
  
  return new Hub(options);

}
