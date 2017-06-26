'use strict';

const EventEmitter = require('events').EventEmitter;
const IOTA         = require('iota.lib.js');
const constants    = require('./const');

const iota              = Symbol('iota');
const store             = Symbol('store');
const attachedHubs      = Symbol('attachedHubs');
const hotWalletSeed     = Symbol('hotWalletSeed');
const hotWalletSecurity = Symbol('hotWalletSecurity');

const incrementAccountIndex  = Symbol('incrementAccountIndex');
const getNewHotWalletInput   = Symbol('getNewHotWalletInput');
const getHotWalletInput      = Symbol('getHotWalletInput');
const collectInputs          = Symbol('collectInputs');
const sendTransfer           = Symbol('sendTransfer');
const getLatestInclusion     = Symbol('getLatestInclusion');
const sweep                  = Symbol('sweep');
const credit                 = Symbol('credit');

class Hub extends EventEmitter {

  constructor(options) {

    super();

    if (!('store' in options)) {
      throw new Error('Please define a storage adapter in options.store');
    }

    if (!('seed' in options)) {
      throw new Error('Provide the seed of your hot wallet');
    }

    const seed = options.seed;

    const security = ('security' in options) ? options.security : 2;

    const provider = ('provider' in options) ? options.provider : constants.PROVIDER;

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

    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid Hub id');
    }

    if (!this[iota].valid.isTrytes(seed)) {
      throw new Error('Provide a valid seed'); 
    }
      
    if (!Number.isInteger(security) || security < 1 || security > 3) {
      throw new Error('Provide a valid security level (1, 2 or 3)');
    }
  
    const exists = await this[store].get(constants.HUB_PREFIX, id);
    
    if (exists) {
      throw new Error(`Hub #${id} already exists`);
    }
    
    const hub = {
      'id': id,
      'seed': seed,
      'security': security,
      'name': name
    };
 
    const stored = await this[store].set(constants.HUB_PREFIX, id, hub);

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
    
    this[attachedHubs][id] = hub;
   
    return this;
  
  }


  async attachById(id) {
    
    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid Hub id');
    }
    
    const hub = await this.find(id);
   
    if (!hub) {
      throw new Error(`Failed to find hub #${id}`);
    }

    return this.attach(hub);
  
  }

  dettach(id) {
    
    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid Hub id');
    }
    
    if (this[attachedHubs].indexOf(id) == 0) {
      console.warn(`Hub #${id} is not attached`);
      return false;
    }
    
    this[attachedHubs][id] = null;  
 
    return true;

  }

  isAttached(id) {
 
    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid hub id');
    }

    return (id in this[attachedHubs]);
  
  }

  async find(id) {

    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid hub id');
    }

    const hub = await this[store].get(constants.HUB_PREFIX, id);
    
    if (!hub) {
      console.log(`Failed to find hub #${id}`);
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

      let accountId, keyIndex;

      [accountId, keyIndex] = addresses[i].split('_');
      
      accountId = parseInt(accountId);
      keyIndex = parseInt(keyIndex);

      accountsToCheck.push(accountId);
      addressesToCheck.push(addresses[i+1]);
      indexes.push(keyIndex);

    }

    const toSweep = [];

    const balances = await this.getBalances(addressesToCheck);

    if (! balances) {
      console.log(`Failed to get balances for hub #${id}`);
      return false;
    }

    await Promise.all(balances.forEach(async (balance, i) => {
      
      if (balance !== 0) {

        const accountId = accountsToCheck[i];

        const key = `${id}_${accountId}`;

        const account = await this[store].get(constants.ACCOUNT_PREFIX, key);
    
        if (!account) {
          console.log(`Failed to fetch account #${accountId} while processing hub #${id} and updating balance on tangle of value ${value}`);
        } 
        else {
          
          account.balanceOnTangle += balance;
        
          const save = await this[store].set(constants.ACCOUNT_PREFIX, key, account);   

          if (!save) {
            console.log(`Failed to update balance on tangle of value ${value} for account #${accountId} while processing hub #${id}`);
          }
        
        }

        const address = addressesToCheck[i];
        const index = indexesToCheck[i];

        const sweep = {
          'address': address,
          'keyIndex': index,
          'value': balance,
          'account': accountId
        };

        toSweep.push(sweep);

        this.emit('deposit', {
          'hub': id,
          'account': accountId,
          'address': sweep.address,
          'keyIndex': sweep.keyIndex,
          'value': sweep.value
        });

        const field = `${accountId}_${index}`; 

        const burn = await this[store].hdel(constants.ADDRESSES_PREFIX, id, field);
        
        if (burn) {
          
          const toHell = await this[store].hset(constants.USED_ADDRESSES_PREFIX, id, field, address);
        
        }

        if (!burn || !toHell) {
          console.log(`Marking address ${address} of account #${accountId} as used failed while processing hub #${id}`);
        }

      }
    
    }));

    const sweep = await this[sweep](id, toSweep);

    if (!sweep) {
     
      console.log(`Sweeps failed while processing hub #${id}`);  
      
      return false;
    
    }

    return true;

  }

  async sync(id) {

    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid id');
    }

    if (!isAttached(id)) {
      throw new Error(`Hub #${id} is not attached. Attach and proccess a hub before syncing.`);
    }

    if (('notEvenWithDb' in this[attachedHubs][id]) && this[attachedHubs][id].notEvenWithDb == true ) {
      
      console.log(`The pending sweeps list for hub #${id} contains sweeps that have been credited. Make sure that the list is even with account credits before syncing.`);
      
      return false;
    
    }

    const sweeps = await this[store].lrange(constants.PENDING_SWEEPS_PREFIX, id, 0, -1);

    if (!sweeps) {
    
      console.log(`Failed to fetch pending sweeps for hub #${id}`);
      
      return false;
    
    }

    if (sweeps.length === 0) {
      
      console.log(`Hub #${id} has no pending sweeps. No need to sync.`);
    
      return true;
    
    }

    const lenght = sweeps.length;

    const txs = [];

    sweeps.foreach((sweep) => {

      hashes.push(sweep.tx);
    
    });

    let i = 0;

    let failedRemovals = 0;

    while (txs.length) {
    
      const batch = txs.splice(0, constants.INCLUSION_STATES_BATCH_SIZE);
    
      const states = await this[getLatestInclusion](batch);
      
      if (!states) {
        
        i += batch.length;
        
        console.log(`Failed to fetch inclusion states while syncing hub #${id}`);
     
        continue;

      }

      await Promise.all(states.forEach(async (confirmed) => {

        if (confirmed) {
          
          const account = sweeps[i].account;
          const value = sweeps[i].value;

          const credit = await this[credit](id, account, value);

          if (credit) {
          
            const removedSweeps = await this[store].ltrim(constants.PENDING_SWEEPS_PREFIX, id, 1 + failedRemovals, -1);

            if (!removedSweeps) {
              
              failedRemovals++;
              
              console.log(`Failed to remove sweep from pending list after crediting ${value} to account #${account}, while syncing hub #${id}`);
            
            }

            else if (failedRemovals > 0) {
              
              console.log(`Succefully removed ${failedRemovals} pending sweeps that failed to remove before, while syncing hub #${id}`);

              failedRemovals = 0;

            }

          }

        }

        ++i;

      }));

    }

    if (failedRemovals > 0) {
      
      this[attachedHubs][id].notEvenWithDb = true;

      console.log(`The pending sweeps list for hub #${id} contains sweeps that have been credited. Make sure that the list is even with account credits before syncing again.`);

      return false;

    }

    return true;

  }

  async getBalances(addresses) {
    
    const expectedLength = addresses.length;

    const size = constants.ADDRESSES_BATCH_SIZE;

    const batches = [];

    while(addresses.length) {
      
      batches.push(addresses.splice(0, size));
    
    }

    const balances = [];
    
    // TODO: Make sure balances are pushed in correct order
    await Promise.all(batches.forEach(async (batch) => {
    
      await new Promise((resolve) => {
      
        this[iota].api.getBalances(batch, (err, balances) => {
        
          if (err) {
            console.log(err);
          }
          else {
            balances.push(balance);
          }

          resolve();
        
        });

      });

    }));

    if (balances.length !== expectedLength) {
      return false;
    }

    return balances;

  }

  async [getNewHotWalletInput]() {

    const index = await this[store].incr('', constants.HOT_WALLET_INDEX_KEY);
 
    if (!index) {
      console.log('Failed to generate new hot wallet address.');
      return false;
    }

    const address = this[iota].api._newAddress(this[hotWalletSeed], index, this[hotWalletSecurity]);
  
    const input = {
      'address': address,
      'keyIndex': index,
      'value': 0
    };

    return input;

  }

  async [getHotWalletInput](right = false) {
  
    let command = 'lpop';

    if (right) {

      command = 'rpop';
    
    }

    const input = await this[store][command](constants.HOT_WALLET_INPUTS_PREFIX, '');

    if (!input) {
      console.log('Failed to fetch hot wallet input');   
    }

    return input;

  }

  async [sweep](id, sweeps) {
      
    const hub = this[attachedHubs][id];

    const seed = hub.seed;
    const security = hub.security;
 
    const hotWalletInput = this[getHotWalletInput](true);
    
    if (!hotWalletInput) {
      console.log(`Failed to fetch hot wallet address while sweeping for hub #${id}`);
      return false;
    }

    const destinationAddress = hotWalletInput.address;

    const length = sweeps.length;

    const res = true;

    while(sweeps.length) {
    
      let value = 0;

      const options = {
        inputs: []
      };

      const batch = sweeps.splice(0, constants.SWEEP_BATCH_SIZE);
      
      batch.forEach((sweep) => {

        options.inputs.push({
          'address': sweep.address,
          'keyIndex': sweep.keyIndex
        });

        value += sweep.value;

      });

      const transfers = [{
        'address': destinationAddress,
        'value': value, 
        'message': '',
        'tag': ''
      }];

      const transfer = await this[sendTransfer](seed, transfers, options);

      let sweepPrefix = '';

      if (transfer) {
      
        sweepPrefix = 'PENDING_SWEEPS_PREFIX';
      
      }

      else {
        
        console.log(`${batch.length} sweeps for hub #${id} to address ${to} of value ${value} failed`);
        
        sweepPrefix = 'FAILING_SWEEPS_PREFIX';
      
        res = false;

      }

      await Promise.all(batch.forEach(async (sweep) => {
        
        let hash = null;

        if (transfer ) {
        
          hash = transfer[0].hash;
        
          this.emit('sweep', {
            'hub': id,
            'account': sweep.account,
            'address': sweep.address,
            'keyIndex': sweep.keyIndex,
            'destinationAddress': destinationAddress,
            'value': sweep.value,
            'tx': hash
          });

        }

        const sweepObj = {
          'address': sweep.address,
          'value': sweep.value,
          'tx': hash,
          'account': sweep.account
        }

        const saveSweep = await this[store].rpush(constants[sweep_prefix], id, sweepObj);
        
        if (!saveSweep) {
          console.log(`Could not save sweep from address ${sweep.address} of account #${sweep.account} in hub #${id}`);
        }

      }));

    }
    
    if (transfer) {
      
      hotWalletInput.value += value;

    }

    const restoreInput = this[store].lpush(constants.HOT_WALLET_INPUTS_PREFIX, '', hotWalletInput);

    if (!restoreInput) {
      console.log(`Failed to restore address #${hotWalletInput.address} with key index ${hotWalletInput.index}`);  
    }

    return res;

  }

  async [credit](hubId, accountId, value) {
    
    const key = `${hubId}_${accountId}`;

    const account = await this[store].get(constants.ACCOUNT_PREFIX, key);
    
    if (!account) {
      console.log(`Failed to fetch account #${accountId} of hub #${hubId} while crediting value ${value}`);
      return false;
    }

    account.balanceOnTangle -= value;

    account.credit += value;

    this.emit('credit', {
      'hub': hubId,
      'account': accountId,
      'value': value
    });

    const save = await this[store].set(constants.ACCOUNT_PREFIX, key, account);

    if (!save) {
      console.log(`Failed to update balance and credit of account #${accountId} of hub #${hubId} while crediting value ${value}`);
      return false;
    }

    return true;

  }

  [getLatestInclusion](hashes) {
  
    return new Promise((resolve) => {
    
      this[iota].api.getLatestInclusion(hashes, (err, states) => {
      
        if (err) {
          console.log(err);
          resolve(false);
        }
        else if (hashes.length === states.length) {
          resolve(states);
        }
        else {
          resolve(false);
        }

      });

    });

  }

  [sendTransfer](seed, transfers, options) {
    
    return new Promise((resolve) => {
      
      this[iota].api.sendTransfer(seed, constants.DEPTH, constants.MWM, transfers, options, (err, res) => {
      
        if (err) {
          console.log(err);
          resolve(false);
        }
        else {
          resolve(res);
        }
      
      });
    
    });

  }

  async registerAccount(hubId, accountId, name = '') {
  
    if (!Number.isInteger(hubId)) {
      throw new Error('Provide a valid hub id');
    }
    
    if (!Number.isInteger(accountId)) {
      throw new Error('Provide a valid account id');
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
      'balanceOnTangle': 0,
      'credit': 0
    };

    const stored = await this[store].set(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`, account);
    
    if (stored) {

      const setIndex = await this[store].set(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`, 0);
      
      if (setIndex) {
     
        account.index = 0;
        
        return account; // Or this.getDepositAddress(hubId, accountId); ?
      
      }
    
    }
    
    return false;
  
  }

  async getDepositAddress(hubId, accountId, checksum = true) {
    
    if (!Number.isInteger(hubId)) {
      throw new Error('Provide a valid hub id');
    }
    
    if (!Number.isInteger(accountId)) {
      throw new Error('Provide a valid account id');
    }
    
    const account = await store.get(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`);
    
    if (!account) {
      throw new Error(`Account #${accountId} not found`);
    }

    const hub = await store.get(constants.HUB_PREFIX, hubId);

    if (!hub) {
      throw new Error(`Failed to find hub #${id}`);
    }

    const seed = hub.seed;
    const security = hub.security;
    const accountIndex = await this[store].get(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);

    if (accountIndex === false || accountIndex === null) {
      throw new Error(`Account index not found for account #${id}`);
    }

    if (accountIndex === constants.MAX_ADDRESSES) {
      console.log(`Your customer with account id #${accountId} is a dumbass!`);
      return false;
    }

    const incred = this[incrementAccountIndex](hubId, accountId);

    if (!incred) {
      throw new Error(`Could not increment account index for account #${accountId} in hub #${hubId}, while getting new address.`);
    }

    const index = accountId * constants.MAX_ADDRESSES + accountIndex;

    const address = this[iota].api._newAddress(seed, index, security, checksum);
    
    const stored = this[store].hset(constants.ADDRESSES_PREFIX, hubId, `${accountId}_${accountIndex}`, address); // Maybe store it with no checksum to save space

    if (stored) {
      return address;
    }

    return false;

  }

  async [incrementAccountIndex](hubId, accountId) {

    const incred = await this[store].incr(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);
 
    if (incred) {
      return incred;
    }

    return false;

  }

  async withdraw(hubId, accountId, address, value, remainderAddress = null, checkAddress = true, tag = '') {

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

    if (remainderAddress  && !this[iota].valid.isAddress(remainderAddress)) {
      throw new Error('Invalid remainder address');
    }

    if (!(value > 0) || !Number.isInteger(value)) {
      return false;
    }

    if (checkAddress) {
    
      const isUsed = this.isUsed(address);

      if (isUsed === null ) {
        console.log(`Could not determine if address ${address} of account #${accountId} is used while withdrawing, in hub #${hubId}`);
        return false;
      }

      if (isUsed) {
        return false;
      }

    }

    const hasCredit = await this.hasCredit(hubId, accountId, value);

    if (!hasCredit) {
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

    const inputs = collectedInputs.inputs;
    
    const remainder = collectedInputs.value - value; 

    const seed = this[hotWalletSeed];

    if (!remainderAddress && remainder > 0) {
    
      const remainderInput = await this[getNewHotWalletInput]();
    
      if (!remainderInput) {
      
        console.log(`Failed to fetch remainder address while withdrawing value ${value} of account #${accountId} in hub #${hubId}`);

        return false;
      
      }

      remainderAddress = remainderInput.address;
    
    }

    const options = {
      'inputs': inputs,
      'address': remainderAddress
    }

    const sent = await this[sendTransfer](seed, transfers, options);

    if (!sent) {
      return false;
    }

    remainderInput.value += remainder;

    const saveRemainder = this[store].rpush(constants.HOT_WALLET_INPUTS_PREFIX, '', remainderInput);

    if (!saveRemainder) {
      console.log(`Failed to save remainder address ${remainderAddress} after withdrawal`);
    }

    const key = `${hubId}_${accountId}`;

    const account = await this[store].get(constants.ACCOUNT_PREFIX, key);

    account.credit -= value;

    const updateAccount = await this[store].set(constants.ACCOUNT_PREFIX, key, account);

    if (!updateAccount) {
      console.log(`Failed to update credit after withdrawal for account #${accountId} in hub #${hubId}`);
    }

    return true;

  }

  [sendTransfer](seed, transfers, options) {
    
    return new Promise((resolve) => {
      
      this[iota].api.sendTransfer(seed, constants.DEPTH, constants.MWM, transfers, options, (err, res) => {
      
        if (err) {
          console.log(err);
          resolve(false);
        }
        else {
          resolve(true);
        }

      });

    });

  }

  isUsed(address) {
    
    if (!this[iota].valid.isAddress(address)) {
      throw new Error('Provide a valid address');   
    }

    return new Promise((resolve) => {
      
      this[iota].api.findTransactions({addresses: [address]}, (err, res) => {
        
        if (err) {
         
          console.log(err);
          
          resolve(null);
        
        }
        
        else if (res === null) {
        
          resolve(true);
        
        }

        else {
        
          resolve(false);
          
        }
      
      });
    
    });

  }

  async [collectInputs](value) {
  
    const inputs = [];

    let collectedValue = 0; 

    while (collectedValue < value) {
   
      const input = await this[store].lpop(constants.HOT_WALLET_INPUTS, '');

      if (!input) {
        console.log(`Failed to collect inputs. Collected ${collectedValue} out of ${value}`);
        break;
      }

      inputs.push({
        'address': input.address,
        'keyIndex': input.keyIndex
      });

      collectedValue += input.value;

    }

    if (collectedValue >= value) {
    
      return {
        'inputs': inputs,
        'value': collectedValue
      };

    }
    
    return false;
  
  }

  async hasCredit(hubId, accountId, value) {
   
    if (!Number.isInteger(hubId)) {
      throw new Error('Provide a valid hub id');
    }

    if (!Number.isInteger(accountId)) {
      throw new Error('Provide a valid account id');
    }

    if (!Number.isInteger(value)) {
      throw new Error('Provide a valid value');
    }

    const credit = await this.getCredit(hubId, accountId);

    if (!credit) {
      return false;
    }

    if (value > credit) {
      return false;
    }

    return true;

  }

  async getCredit(hubId, accountId) {

    if (!Number.isInteger(hubId)) {
      throw new Error('Provide a valid hub id');
    }

    if (!Number.isInteger(accountId)) {
      throw new Error('Provide a valid account id');
    }

    if (!Number.isInteger(value)) {
      throw new Error('Value must be an integer');
    }

    const account = await this[store].get(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`);

    if (!account) {
      console.log(`Account #${accountId} not found`);
      return false;
    }

    return account.credit;
  
  }

  list() {
    console.dir(this[attahedHubs]);
  }

}

module.exports = (options) => {
  
  return new Hub(options);

}
