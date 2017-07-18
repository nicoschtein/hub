'use strict';

const EventEmitter  = require('events').EventEmitter;
const IOTA          = require('iota.lib.js');
const constants     = require('./const');
const sweepTransfer = require('./sweep-transfer');

const iota              = Symbol('iota');
const store             = Symbol('store');
const attachedHubs      = Symbol('attachedHubs');
const hotWalletSeed     = Symbol('hotWalletSeed');
const hotWalletSecurity = Symbol('hotWalletSecurity');

const process                = Symbol('process');
const sync                   = Symbol('sync');
const incrementAccountIndex  = Symbol('incrementAccountIndex');
const getNewHotWalletInput   = Symbol('getNewHotWalletInput');
const getHotWalletInput      = Symbol('getHotWalletInput');
const collectHotWalletInputs = Symbol('collectHotWalletInputs');
const sendTransfer           = Symbol('sendTransfer');
const sendSweepTransfer      = Symbol('sendSweepTransfer');
const getLatestInclusion     = Symbol('getLatestInclusion');
const sweep                  = Symbol('sweep');
const credit                 = Symbol('credit');

class Hub extends EventEmitter {

  constructor({storageAdapter, seed, security = 2, provider = constants.PROVIDER}) {

    super();

    if (!seed) {
      throw new Error('Provide the seed of your hot wallet');
    } 

    if (!storageAdapter) {
      throw new Error('Please define a storage adapter in options.storageAdapter');
    }

    this[store] = storageAdapter;

    this[iota] = new IOTA({
      'provider': provider
    });

    if (!this[iota].valid.isTrytes(seed)) {
      throw new Error('Provide a valid seed for your hot wallet');
    }

    this[sendSweepTransfer] = sweepTransfer(this[iota]);

    this[hotWalletSeed] = seed;
    this[hotWalletSecurity] = security;

    this[attachedHubs] = {};

  }

  async create(id, {seed, security = 2, name = ''}) {

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
 
    const initUnusedProcessFlag = await this[store].set(constants.HUB_PREFIX, `${id}_processing_unused`, false);
      
    if (!initUnusedProcessFlag) {
      console.log(`Failed to initialize unused addresses process flag in store, while creating hub ${id}`);
      return false;
    }

    const initUsedProcessFlag = await this[store].set(constants.HUB_PREFIX, `${id}_processing_used`, false);

    if (!initUsedProcessFlag) {
      console.log(`Failed to initialize used addresses process flag in store, while creating hub ${id}`);
      return false;
    }

    const initSyncFlag = await this[store].set(constants.HUB_PREFIX, `${id}_syncing`, false);

    if (!initSyncFlag) {
      console.log(`Failed to initialize sync flag in store while creating hub ${id}`);
      return false;
    }

    const stored = await this[store].set(constants.HUB_PREFIX, id, hub);

    if (stored) {
      return hub;
    }

    return false;
 
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

  async resetProcessFlag(id, scanUsed = false) {
  
    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid Hub id');
    }

    let key = scanUsed ? `${id}_processing_used` : `${id}_processing_unsed`;

    const reset = await this[store].set(constants.HUB_PREFIX, key, false);

    if (!reset) {
      console.log(`Failed to reset process flag for hub #${id}`);
      return false;
    }

    return true;

  }

  async resetSyncFlag(id) {
  
    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid Hub id');
    }

    const reset = await this[store].set(constants.HUB_PREFIX, `${id}_syncing`, false);

    if (!reset) {
      console.log(`Failed to reset sync flag for hub #${id}`);
      return false;
    }

    return true;

  }

  async process(id, scanUsed = false) {

    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid Hub id');
    }

    if (!this.isAttached(id)) {
      throw new Error(`Hub #${id} is not attached. Attach before processing.`);
    }

    const usedText = scanUsed ? 'used' : 'unused';

    const key = scanUsed ? `${id}_processing_used` : `${id}_processing_unused`;  

    const processing = await this[store].getset(constants.HUB_PREFIX, key, true);

    if (processing) {
      console.log(`Hub #${id} is already being processed for ${usedText} addresses or previous process() was interrupted.`);  
      return true;
    }

    let res = false;
    let resetValue;

    if (processing === null) {
      console.log(`Could not determine processing status of hub #${id}. Process canceled.`);
      resetValue = null;
    }
    else {
      res = await this[process](id, scanUsed);
      resetValue = false;
    }

    const resetFlag = await this[store].set(constants.HUB_PREFIX, key, resetValue);

    if (!resetFlag) {
      console.log(`Failed to reset processing flag of Hub #${id} for ${usedText} addresses.`);
    }

    return res;

  }

  async [process](id, scanUsed) {

    let addresses_list_prefix;

    // Determine if we are scanning used addresses
    if (scanUsed) {
       addresses_list_prefix = constants.USED_ADDRESSES_PREFIX;
    }
    else {
      addresses_list_prefix = constants.ADDRESSES_PREFIX;
    }

    // Fetch addresses from store as object
    const addressesObj = await this[store].hgetall(addresses_list_prefix, id);

    if (addressesObj === null) {
      return true;
    }
    else if (addressesObj === false) {
      console.log(`Failed to fetch addresses while processing hub #${id}`);
      return false;
    }

    const addresses = [];

    // Convert addresses to array 
    for (const key of Object.keys(addressesObj)) {
      addresses.push(key); 
      addresses.push(addressesObj[key]);
    }

    const l = addresses.length;

    if (l === 0) {
      return true;
    }

    const accountsToCheck = [];
    const addressesToCheck = [];
    const lockedAddressesToCheck = [];
    const indexesToCheck = [];

    // Iterate the addresses list 
    // a[i] = {id}_{index} 
    // a[i + 1] = {locked?}_{address} 
    for (let i = 0; i < l; i += 2) {

      let accountId, accountIndex;

      [accountId, accountIndex] = addresses[i].split('_');
      
      accountId = parseInt(accountId);
      accountIndex = parseInt(accountIndex);

      let parsedAddress, lockedAddress;

      [lockedAddress, parsedAddress] = addresses[i+1].split('_');

      // Keep track of address metadata
      accountsToCheck.push(accountId);
      addressesToCheck.push(parsedAddress);
      lockedAddressesToCheck.push(parseInt(lockedAddress));
      indexesToCheck.push(accountIndex);

    }

    // Sweeps list
    const toSweep = [];
    
    // Get balances of addresses in respective order
    const balances = await this.getBalances(addressesToCheck);
     
    if (!balances) {
      console.log(`Failed to get balances for hub #${id}`);
      return false;
    }

    let balanceNotDetermined = false;

    let i = 0;

    for (const balance of balances) {
     
      if (balance === null) {

        balanceNotDetermined = true;

        console.log(`Failed to determine balance of address ${addressesToCheck[i]} of account #${accountsToCheck[i]} while processing hub #${id}`);
      
      }

      // Sweep only if address has balance and is not locked by previous procedure
      // Addresses are being locked when sweeping, until the sweep confirms
      if (balance && lockedAddressesToCheck[i] === 0) {

        const accountId = accountsToCheck[i];

        const key = `${id}_${accountId}`;

        // Update account with new balance on tangle        
        const save = await this[store].incrby(constants.ACCOUNT_PREFIX, `${key}_balance`, balance);   

        if (!save) {
          console.log(`Failed to update balance on tangle of value ${value} for account #${accountId} while processing hub #${id}`);
        }

        const address = addressesToCheck[i];
        const index = indexesToCheck[i];

        const field = `${accountId}_${index}`; 

        const sweep = {
          'address': address,
          'index': index,
          'keyIndex': accountId * constants.MAX_ADDRESSES + index,
          'value': balance,
          'account': accountId
        };

        // Push to sweeps list
        toSweep.push(sweep);

        this.emit('deposit', {
          'hub': id,
          'account': accountId,
          'address': sweep.address,
          'keyIndex': sweep.keyIndex,
          'value': sweep.value
        });
   
        // If we are scanning new addresses mark them as used
        if(!scanUsed) {
   
          const burn = await this[store].hdel(constants.ADDRESSES_PREFIX, id, field);
          let toHell = false;

          if (burn) {
            toHell = await this[store].hset(constants.USED_ADDRESSES_PREFIX, id, field, `1_${address}`);
          }

          if (!burn || !toHell) {
            console.log(`Marking address ${address} of account #${accountId} as used failed while processing hub #${id}`);
          }
        
	      }
 	      else {

          // Lock the address until sweep confimrs, by prefixing with `1`
          const lockUsedAddress = await this[store].hset(constants.USED_ADDRESSES_PREFIX, id, field, `1_${address}`);
	  
          if (!lockUsedAddress) {
            console.log(`Error while locking address ${address} of account #${account} while processing hub #{id}`);
          }
	      
        }
      
      }
    
      i++;

    }

    // In case getBalances() failed
    if (balanceNotDetermined) {      
      return false;
    }

    // Stop if there are no sweeps
    if (toSweep.length === 0) {
      return true;
    }

    // Execute all sweeps
    const executeSweep = await this[sweep](id, toSweep);

    if (!executeSweep) {
      console.log(`Sweeps failed while processing hub #${id}`);  
      return false;
    }

    return true;

  }

  async sync(id) {
 
    if (!Number.isInteger(id)) {
      throw new Error('Provide a valid id');
    }

    if (!this.isAttached(id)) {
      throw new Error(`Hub #${id} is not attached. Attach and proccess a hub before syncing.`);
    }

    // Stop here if db is inconsistent
    if (('notEvenWithDb' in this[attachedHubs][id]) && this[attachedHubs][id].notEvenWithDb) {
      console.log(`The pending sweeps list for hub #${id} contains sweeps that have been credited. Make sure that the list is even with account credits before syncing.`);
      return false;
    }

    const syncing = await this[store].getset(constants.HUB_PREFIX, `${id}_syncing`, true);
    
    if (syncing === true) {
      console.log(`Hub #${id} is already syncing, or previous sync() was interrupted.`);
      return true;
    }
    
    let res = false;
    let resetValue;

    if (syncing === null) { 
      console.log(`Could not determine syncing status of hub #${id}. Sync canceled.`);
      resetValue = null;
    }
    else {
      res = await this[sync](id);
      resetValue = false;
    }

    const resetFlag = await this[store].set(constants.HUB_PREFIX, `${id}_syncing`, resetValue);

    if (!resetFlag) {
      console.log(`Failed to reset syncing flag for hub #${id}`)
    }

    return res;
  
  }

  async [sync](id) {

    // Fetch array of pending sweeps (not confirmed yet)
    const sweeps = await this[store].lrange(constants.PENDING_SWEEPS_PREFIX, id, 0, -1);

    if (!sweeps) {
      console.log(`Failed to fetch pending sweeps for hub #${id}`);
      return false;
    }

    if (sweeps.length === 0) {
      console.log(`Hub #${id} has no pending sweeps. No need to sync.`);
      return true;
    }

    const length = sweeps.length;

    const hashes = [];
    const mapHashes = {};

    // Extract tail hashes from sweep objects
    // Map hashes with sweep indexes
    sweeps.forEach((sweep, i) => {
      hashes.push(sweep.tx);
      if (!mapHashes.hasOwnProperty(sweep.tx)) {
        mapHashes[sweep.tx] = [];
      }
      mapHashes[sweep.tx].push(i);
    });

    // Filter duplicates
    const uniqueHashes = [];
    const hashesToBatch = [];

    // Filter dublicates
    for (const hash in mapHashes) {
      uniqueHashes.push(hash);
      hashesToBatch.push(hash);
    }

    // Index of hash 
    let i = 0;

    // Keep track of db failures when removing pending sweeps
    let failedRemovals = 0;

    // Check for sweeps confirmation in batches 
    while (hashesToBatch.length) {

      const batch = hashesToBatch.splice(0, constants.INCLUSION_STATES_BATCH_SIZE);

      const states = await this[getLatestInclusion](batch);

      if (!states) {
        
        i += batch.length;
        
        console.log(`Failed to fetch inclusion states while syncing hub #${id}`);     
        
        continue;
     
      }

      for (const confirmed of states) {

        if (confirmed) {
          
          const hash = uniqueHashes[i];
          const l = mapHashes[hash].length;

          for (let j = 0; j < l; j++) {
            
            const k = mapHashes[hash][j]; 

            const account = sweeps[k].account;
            const value = sweeps[k].value;
            const index = sweeps[k].index;
            const address = sweeps[k].address;
          
            const field = `${account}_${index}`;

            // Credit account with the value of the confirmed sweep
            const creditAccount = await this[credit](id, account, value);

            // Unlock sweep's address, previously locked by process()
            // Prefix `0` indicates that the address is not locked
            const restoreLockedAddress = await this[store].hset(constants.USED_ADDRESSES_PREFIX, id, field, `0_${address}`);
          
            if (!restoreLockedAddress) {
              console.log(`Failed to restore locked address ${address} of account #${account} while syncing hub #${id}`);
            }
	        
            // Destination = hotwallet
            const destinationAddress = sweeps[k].destinationAddress;

            // Unlock hotwallet address, previously locked by [sweep]()
            const unlockHotWalletAddress = await this[store].set(constants.HOT_WALLET_LOCKED_INPUTS_PREFIX, destinationAddress, 0);

            if (!unlockHotWalletAddress) {
              console.log(`Failed to unlock hot wallet address ${destinationAddress} while syncing hub #{id}`);
            }

            // Remove pending sweeps if account was credited
            if (creditAccount) {
          
              const removedSweeps = await this[store].ltrim(constants.PENDING_SWEEPS_PREFIX, id, 1 + failedRemovals, -1);

              if (!removedSweeps) {
                failedRemovals++;
                console.log(`Failed to remove sweep from pending list after crediting ${value} to account #${account}, while syncing hub #${id}`);
              }
              else if (failedRemovals > 0) {
                failedRemovals = 0;
                console.log(`Succefully removed ${failedRemovals} pending sweeps that failed to remove before, while syncing hub #${id}`);
              }

            }

          }
        
        }
        
        ++i;

      }

    }

    // If sweeps failed to remove, prevent double credits
    if (failedRemovals > 0) {
      
      this[attachedHubs][id].notEvenWithDb = true;

      console.log(`The pending sweeps list for hub #${id} contains sweeps that have been credited. Make sure that the list is even with account credits before syncing again.`);

      // return false; (?)
    }

    return true;

  }

  async getBalances(addresses) {

    if (addresses.length === 0) {
      return [];
    }
    
    const checkList = [];

    // Add addresses to checklist
    addresses.forEach((address) => {
      checkList.push(address);
    });

    const expectedLength = addresses.length;

    const size = constants.ADDRESSES_BATCH_SIZE;

    const batches = [];

    // Splice in batches
    while(checkList.length) {
      batches.push(checkList.splice(0, size));
    }

    let balances = [];

    // Get balances in batches and maintain the order
    const balancesBatches = await Promise.all(batches.map(async (batch) => {

      const balancesBatch = await new Promise((resolve) => {
        
        this[iota].api.getBalances(batch, 100, (err, res) => {
          if (err) {
            console.log(err);
            resolve(null);
          }
          else {
            resolve(res.balances);
          }
        });

      });

      // Map batch with null if getBalances() failed
      if (!balancesBatch) {
        const nullBalances = batch.map((balance) => {
          return null;
        });
        return nullBalances;
      }

      return balancesBatch;

    }));

    // Concatenate all batched results
    balancesBatches.forEach((batch) => {
      balances = balances.concat(batch.map((balance) => {
        if (balance !== null) {
          return parseInt(balance);
        }
        return balance;
      }));
    });

    if (balances.length !== expectedLength) { 
      return false;
    }

    return balances;

  }

  async [getNewHotWalletInput](checksum = true) {

    // Increment hot wallet index
    const index = await this[store].incr('', constants.HOT_WALLET_INDEX_KEY);
 
    if (!index && index !== 0) {
      console.log('Failed to increment index while generating new hot wallet address.');
      return false;
    }

    // Create new address
    const address = this[iota].api._newAddress(this[hotWalletSeed], index, this[hotWalletSecurity], checksum);
 
    if (!address) {
      console.log(`Failed to generate new hot wallet address at key index ${index}`);
      return false;
    }

    const input = {
      'address': address,
      'keyIndex': index,
      'value': 0
    };

    return input;

  }

  async createHotWalletInput(checksum = true) {

    // Get a new input
    const input = await this[getNewHotWalletInput](checksum);

    if (!input) {
      return false;
    }

    // Push new input to the end of the list
    const save = await this[store].rpush(constants.HOT_WALLET_INPUTS_PREFIX, '', input);

    if (!save) {
      console.log(`Failed to save newly generated hot wallet input with address ${input.address} at key index ${input.keyIndex}`);
    }

    return input;

  }

  async [getHotWalletInput](right = false) {
  
    // Pick input from the start of the list
    let command = 'lpop';

    // Pick from the end
    if (right) {
      command = 'rpop';    
    }

    // Fetch input
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
 
    // Pick an input from the end of the list to send tokens to
    const hotWalletInput = await this[getHotWalletInput](true);
    
    if (!hotWalletInput) {
      console.log(`Failed to fetch hot wallet address while sweeping for hub #${id}`);
      return false;
    }

    const destinationAddress = hotWalletInput.address;

    // Lock the hot wallet input until sweep confirms
    const lockHotWalletAddress = await this[store].set(constants.HOT_WALLET_LOCKED_INPUTS_PREFIX, destinationAddress, 'locked');

    if (!lockHotWalletAddress) {
      console.log(`Sweeping for hub #${id} failed. Could not lock hotwallet destination address ${destinationAddress} until sweep confirmation. Hot wallet input: ${hotWalletInput}`);
      return false;
    }

    const length = sweeps.length;

    let res = true;
    let transfer = false;

    // Execute sweep transfers in batches
    while(sweeps.length) {
    
      let value = 0;

      const options = {
        inputs: []
      };

      // Get a batch of sweeps
      const batch = sweeps.splice(0, constants.SWEEP_BATCH_SIZE);
      
      // Construct inputs
      batch.forEach((sweep) => {

        // Custom inputs object including value 
        options.inputs.push({
          'address': this[iota].utils.noChecksum(sweep.address),
          'keyIndex': sweep.keyIndex,
          'security': hub.security,
          'value': sweep.value
        });
        
        value += sweep.value;
      
      });

      const transfers = [{
        'address': destinationAddress,
        'value': value,
        'message': '',
        'tag': ''
      }];

      // Send transfer
      transfer = await this[sendSweepTransfer](seed, transfers, options);

      let sweepPrefix = '';

      if (transfer) {
        
        // Update balance of hotwallet input
        hotWalletInput.value += value;
    
        // Mark sweep as pening
        sweepPrefix = 'PENDING_SWEEPS_PREFIX';

      }
      else {
        
        console.log(`${batch.length} sweeps for hub #${id} to address ${destinationAddress} of value ${value} failed`);
        
        // Mark sweep as failing
        sweepPrefix = 'FAILING_SWEEPS_PREFIX';
      
        res = false;
      
      }

      for (const sweep of batch) {
        
        // Placeholder in case transfer failed
        let hash = null;

        // Emit event if transfer succeeded
        if (transfer) {
      
          // Get the tail transaction hash
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
          'destinationAddress': destinationAddress,
          'index': sweep.index,
          'account': sweep.account
        };

        // Save sweep in the pending list
        const saveSweep = await this[store].rpush(constants[sweepPrefix], id, sweepObj);
        
        if (!saveSweep) {
          console.log(`Could not save sweep from address ${sweep.address} of account #${sweep.account} in hub #${id}`);
        }

      };

    }

    // Place input back in the start of the list
    const restoreInput = await this[store].lpush(constants.HOT_WALLET_INPUTS_PREFIX, '', hotWalletInput);

    if (!restoreInput) {
      console.log(`Failed to restore address #${hotWalletInput.address} with key index ${hotWalletInput.index}`);  
    }

    return res;

  }

  async [credit](hubId, accountId, value, offChain = false) {
    
    const key = `${hubId}_${accountId}`;

    let res = true;

    const updatedCredit = await this[store].incrby(constants.ACCOUNT_PREFIX, `${key}_credit`, value);
    
    if (!updatedCredit) {
      console.log(`Failed to update credit of account #${accountId} in hub #${hubId} while crediting value ${value}`);
      res = false;
    }

    let balance;

    if (!offChain) { 

      const updatedBalance = await this[store].decrby(constants.ACCOUNT_PREFIX, `${key}_balance`, value);
      
      if (!updatedBalance) {
        console.log(`Failed to update balance of account #${accountId} in hub #${hubId} while crediting value ${value}`);
        res = false;
      }
      else {
        balance = updatedBalance;
      }
    
    }
    else {
      balance = await this[store].get(constants.ACCOUNT_PREFIX, `${key}_balance`);
    }
    
    if (!res) {
      return false;
    }

    this.emit('credit', {
      'hub': hubId,
      'account': accountId,
      'value': value,
      'credit': updatedCredit,
      'balanceOnTangle': balance,
      'offChain': offChain
    });

    return true;

  }

  async credit(hubId, accountId, value) {
 
    if (!Number.isInteger(value)) {
      throw new Error('Invalid value');
    }

    const res = await this[credit](hubId, accountId, value, true);

    return res;

  }

  [getLatestInclusion](hashes) {
  
    return new Promise((resolve) => {

      this[iota].api.getLatestInclusion(hashes, (err, states) => {
        if (err) {
          console.log(err);
          resolve(false);
        }
        else if (!states) {
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

  async [sendTransfer](seed, transfers, options) {
    
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

  async registerAccount(hubId, name = '') {
  
    if (!Number.isInteger(hubId)) {
      throw new Error('Provide a valid hub id');
    }

    const hub = await this[store].get(constants.HUB_PREFIX, hubId);
    
    if (!hub) {
      throw new Error(`Hub #${hubId} does not exist`);
    }

    const accountId = await this[store].incr('', constants.ACCOUNTS_COUNTER_KEY);

    if (!accountId) {
      console.log(`Failed to fetch new id while creating new account in hub #${hubId}`);
      return false;
    }
    
    const account = {
      'id': accountId,
      'hubId': hubId,
      'name': name
    };

    const key = `${hubId}_${accountId}`;

    const stored = await this[store].set(constants.ACCOUNT_PREFIX, key, account);
 
    if (stored) {

      const initBalance = await this[store].set(constants.ACCOUNT_PREFIX, `${key}_balance`, 0);
      const initCredit = await this[store].set(constants.ACCOUNT_PREFIX, `${key}_credit`, 0);

      if (!initBalance || !initCredit) {
        return false;
      }

      account.balanceOnTangle = 0;
      account.credit = 0;

      // Initiate an index counter to get new addresses for each account
      const setIndex = await this[store].set(constants.ACCOUNT_INDEX_KEY, key, 0);
      
      if (setIndex) {

        account.index = 0;
        
        return account; // Or this.getDepositAddress(hubId, accountId); ?
      
      }
    
    }
    
    return false;
  
  }

  async getNewDepositAddress(hubId, accountId, checksum = true) {
    
    if (!Number.isInteger(hubId)) {
      throw new Error('Provide a valid hub id');
    }
    
    if (!Number.isInteger(accountId)) {
      throw new Error('Provide a valid account id');
    }
 
    const hub = await this[store].get(constants.HUB_PREFIX, hubId);

    if (!hub) {
      throw new Error(`Failed to find hub #${hubId}`);
    }
    
    const account = await this[store].get(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`);
    
    if (!account) {
      throw new Error(`Account #${accountId} not found`);
    }

    const seed = hub.seed;
    const security = hub.security;

    // Fetch key index of account
    const accountIndex = await this[store].get(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);

    if (accountIndex === false || accountIndex === null) {
      console.log(`Account index not found for account #${accountId} in hub #${hubId}`);
      return false;
    }

    if (accountIndex === constants.MAX_ADDRESSES) {
      console.log(`Account #${accountId} has reached the limit of ${constants.MAX_ADDRESSES} addresses.`);
      return false;
    }

    // Increment the index counter for the next address
    const incred = await this[incrementAccountIndex](hubId, accountId);

    if (!incred) {
      console.log(`Could not increment account index for account #${accountId} in hub #${hubId}, while getting new address.`);
      return false;
    }

    const index = accountId * constants.MAX_ADDRESSES + accountIndex;

    // Generate the new address
    const address = this[iota].api._newAddress(seed, index, security, checksum);
   
    if (!address) {
      console.log(`Failed to generate new address for account #${accountId} in hub #${hubId}`);
      return false;
    }

    // Store new adress relatively to account and key index 
    const stored = this[store].hset(constants.ADDRESSES_PREFIX, hubId, `${accountId}_${accountIndex}`, `0_${address}`); // Maybe store it with no checksum to save space

    if (!stored) {
      console.log(`Failed to store newly generated address ${address} for account #${accountId} at key index ${accountIndex} in hub #${hubId}`);
    }

    return address;

  }

  async getDepositAddress(hubId, accountId, keyIndex = false) {
  
    if (!Number.isInteger(hubId)) {
      throw new Error('Provide a valid hub id');
    }
    
    if (!Number.isInteger(accountId)) {
      throw new Error('Provide a valid account id');
    }

    const hub = await this[store].get(constants.HUB_PREFIX, hubId);

    if (!hub) {
      throw new Error(`Failed to find hub #${hubId}`);
    }
    
    const account = await this[store].get(constants.ACCOUNT_PREFIX, `${hubId}_${accountId}`);
    
    if (!account) {
      throw new Error(`Account #${accountId} not found`);
    }

    if (!keyIndex) {

      // Fetch latest key index
      keyIndex = await this[store].get(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);

      if (!keyIndex && keyIndex !== 0) {
        console.log(`Failed to fetch last key index for account #${accountId} in hub #${hubId} while getting last deposit address`);
        return false;
      }

      // Go to the previous index to match that of last address
      keyIndex--;

    }

    const address = await this[store].hget(constants.ADDRESSES_PREFIX, hubId, `${accountId}_${keyIndex}`);

    if (!address) {
      console.log(`Failed to fetch deposit address at key index ${keyIndex} for account #${accountId} in hub #${hubId}`);
      return false;
    }

    // Split address from its prefix
    const split = address.split('_');

    // Return the address
    return split[1];

  }

  async [incrementAccountIndex](hubId, accountId) {

    const incred = await this[store].incr(constants.ACCOUNT_INDEX_KEY, `${hubId}_${accountId}`);
 
    if (incred) {
      return incred;
    }

    return false;

  }

  async withdraw(hubId, accountId, {address, value, remainderAddress = null, checkAddress = true, tag = ''}) {

    // TODO: Probably ditch remainderAddress option, not really useful & causess address reuse issue

    if (!Number.isInteger(hubId)) {
      throw new Error('Hub id is invalid');
    }

    if (!Number.isInteger(accountId)) {
      throw new Error('Account id is invalid');
    }

    if (!this[iota].valid.isAddress(address)) {
      throw new Error('Invalid address');
    }

    if (!Number.isInteger(value)) {
      throw new Error('Invalid value');
    }

    if (remainderAddress  && !this[iota].valid.isAddress(remainderAddress)) {
      throw new Error('Invalid remainder address');
    }

    if (!this.isAttached(hubId)) {
      throw new Error(`Hub #${hubId} is not attached. Attach to execute withdrawals.`);
    }

    if (!(value > 0) || !Number.isInteger(value)) {
      return false;
    }

    if (checkAddress) {

      // Check if user's address has been previously spent
      const isUsed = await this.isUsed(address);

      if (isUsed === null ) {
        console.log(`Could not determine if address ${address} of account #${accountId} is used while withdrawing, in hub #${hubId}`);
        return false;
      }

      if (isUsed) {

        // TODO: maybe emit an error event
        
        return false;
      }

    }

    const hasCredit = await this.hasCredit(hubId, accountId, value);

    if (!hasCredit) {
      
      // TODO: emit an error event

      console.log(`Account #${accountId} in hub #${hubId} has insufficient credit to withdraw value of ${value}`);
      return false;
    }

    const transfers = [{
      'address': address,
      'value': value,
      'message': '',
      'tag': tag
    }];

    // Get inputs from hot wallet
    const collectedInputs = await this[collectHotWalletInputs](value);

    if (!collectedInputs) {
      return false;
    }

    const inputs = collectedInputs.inputs;

    const remainder = collectedInputs.value - value; 

    const seed = this[hotWalletSeed];

    let remainderInput;

    // If remainder address is missing, create a new hot wallet address
    // TODO: Probably ditch `remainderAddress` option and always create a new hot wallet input.
    if (!remainderAddress && remainder > 0) {

      remainderInput = await this[getNewHotWalletInput]();
 
      if (!remainderInput) {
        console.log(`Failed to generate remainder address while withdrawing value ${value} of account #${accountId} in hub #${hubId}`);
        return false;
      }

      remainderAddress = remainderInput.address;
    
    }

    // Construct inputs
    const options = {
      'inputs': inputs.map((input) => { 
        input.address = this[iota].utils.noChecksum(input.address);
        input.security = this[hotWalletSecurity];
        return input; 
      })
    }

    // Set remainder address
    if (remainderAddress) {
      options.address = this[iota].utils.noChecksum(remainderAddress);
    }

    const key = `${hubId}_${accountId}`;
    
    // Update account with new credit
    let updatedCredit = await this[store].decrby(constants.ACCOUNT_PREFIX, `${key}_credit`, value);

    if (!updatedCredit) {
      console.log(`Failed to update account credit while withdrawing for account #${accountId} in hub #${hubId}`);
      return false;
    }    

    const sent = await this[sendTransfer](seed, transfers, options);

    if (!sent) {
      
      // Restore credit if transfer fails 
      const restoreCredit = await this[store].incrby(constants.ACCOUNT_PREFIX, `${key}_credit`, value);
      
      if (!restoreCredit) {
        console.log(`Failed to restore value of ${value} of account #${accountId} in hub #${hubId}`);
      }

      // Restore hot wallet inputs if transfer failed
      for (const restoreInput of collectedInputs) {
      
        const restoreCollectedInput = await this[store].lpush(constants.HOT_WALLET_INPUTS_PREFIX, '', restoreInput);
        
        if (!restoreCollectedInput) {
          console.log(`Failed to restore hotwallet input ${restoreInput.address} @ keyIndex ${restoreInput.keyIndex} of value ${restoreInput.value}`)
        }
      
      }

      return false;
    
    }

    const withdrawalObj = {
      'hub': hubId,
      'account': accountId,
      'value': value,
      'credit': account.credit,
      'address': address,
      'remainder': remainder,
      'inputs': options.inputs,
      'remainderAddress': remainderAddress,
      'hash': sent[0].hash,
      'updatedAccount': updateAccount
    };

    this.emit('withdraw', withdrawalObj);

    // Count of addresses to replace collected inputs
    let numNewAddresses = inputs.length;

    if (remainder > 0) {
   
      // If there is remainder skip creation of 1 address, as remainder address takes it's place
      numNewAddresses--;

      remainderInput.value += remainder;

      // Push remainder input in the end of hot wallet inputs list
      const saveRemainder = await this[store].rpush(constants.HOT_WALLET_INPUTS_PREFIX, '', remainderInput);

      if (!saveRemainder) {
        console.log(`Failed to save remainder address ${remainderAddress} after withdrawal`);
      }
    
    }

    // Replace used hot wallet addresses with new inputs
    for (let i = 0; i < numNewAddresses; i++) {
        
      const newAddress = await this[getNewHotWalletInput]();

      if (!newAddress) {
        console.log(`Failed to generate new hot wallet address to replace consumed input while withdrawing`);
      }
      else {
          
        const saveNewAddress = await this[store].rpush(constants.HOT_WALLET_INPUTS_PREFIX, '', newAddress);

        if (!saveNewAddress) {
          console.log(`Failed to save newly generated hot wallet address to replace consumed input while withdrawing`);
        }

      }
    
    }

    return withdrawalObj;

  }

  isUsed(address) {
    
    if (!this[iota].valid.isAddress(address)) {
      throw new Error('Provide a valid address');   
    }

    return new Promise((resolve) => {
      
      // Search for transactions related to the address
      this[iota].api.findTransactionObjects({addresses: [address]}, (err, txs) => {
        
        if (err) { 
          console.log(err);
          resolve(null);
        }
        else if (txs.length === 0) {
          resolve(false);
        }
        else {

          let used = false;

          const l = txs.length;

          // Look for negative values
          for (let i = 0; i < l; i++) {
            if (txs[i].value < 0) {     
              used = true;
              break;
            }
          }

          resolve(used);
        
        }

      });
    
    });

  }

  async [collectHotWalletInputs](value) {
  
    const inputs = [];

    let collectedValue = 0; 

    const inputsToRestore = [];

    while (collectedValue < value) {
   
      // Pick first input from the start of the list
      const input = await this[store].lpop(constants.HOT_WALLET_INPUTS_PREFIX, '');

      if (!input) {
        console.log(`Failed to collect inputs. Collected ${collectedValue} out of ${value}`);
        break;
      } 

      // Get input status
      const lockedInput = await this[store].get(constants.HOT_WALLET_LOCKED_INPUTS_PREFIX, input.address);

      // If input is lock push it to restore list
      if (lockedInput === 'locked') {
        inputsToRestore.push(input);
        continue;
      }

      // Check confirmed balance
      let balance = await getBalances([input.address]);
      
      if (balance) {
        balance = balance[0];
      }
      else {
        // Restore input if balance was not dermined
        inputsToRestore.push(input);
        continue;
      }

      // Push input of 0 balance in the end of the list
      if (balance == 0) {
        
        const restoreInput = this[store].rpush(constants.HOT_WALLET_INPUTS_PREFIX, '', input);
        
        if (!restoreInput) {
          console.log(`Failed to restore collected input with 0 value. Input: ${input}`);
        }
        
        continue;
      
      }

      // Otherwise add it to inputs list
      inputs.push({
        'address': input.address,
        'keyIndex': input.keyIndex,
        'value': balance
      });

      collectedValue += balance;

    }

    // Restore locked inputs to the start of the list
    for (const input of inputsToRestore) {
    
      const restore = await this[store].lpush(constants.HOT_WALLET_INPUTS_PREFIX, '', input);
     
      if (!restore) {
        console.log(`Failed to restore locked hot wallet input while collecting inputs. Input: ${input}`);
      }

    }

    if (collectedValue >= value) {
    
      return {
        'inputs': inputs,
        'value': collectedValue
      };

    }
   
    // Restore all inputs
    for (const input of inputs) {

      const restore = await this[store].lpush(constants.HOT_WALLET_INPUTS_PREFIX, '', input);

      if (!restore) {
        console.log(`Failed to restore hot wallet input: ${input}`);
      }
    
    }

    return false;
  
  }

  isValidAddress(address) {
    
    return this[iota].valid.isAddress(address);
  
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

    const account = await this.getAccount(hubId, accountId);

    if (!account) {
      return false;
    }

    return account.credit;
  
  }

  async getBalanceOnTangle(hubId, accountId) {
  
    const account = await this.getAccount(hubId, accountId);

    if (!account) {
      return false;
    }

    return account.balanceOnTangle;

  }

  async getAccount(hubId, accountId) {
 
    if (!Number.isInteger(hubId)) {
      throw new Error('Provide a valid hub id');
    }

    if (!Number.isInteger(accountId)) {
      throw new Error('Provide a valid account id');
    }

    const key = `${hubId}_${accountId}`;

    const account = await this[store].get(constants.ACCOUNT_PREFIX, key);

    if (!account) {
      console.log(`Account #${accountId} not found`);
      return false;
    }

    const balanceOnTangle = await this[store].get(constants.ACCOUNT_PREFIX, `${key}_credit`);
    const credit = await this[store].get(constants.ACCOUNT_PREFIX, `${key}_credit`);
    
    if (!balanceOnTangle || !credit) {
      return false;
    }

    account.balanceOnTangle = balanceOnTangle;
    account.credit = credit;

    return account;
  
  }

}

module.exports = function (options) {
  
  return new Hub(options);

}
