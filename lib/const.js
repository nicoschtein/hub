module.exports = {
  
  /** @const {String} PROVIDER - Iota provider url */
  'PROVIDER': 'http://localhost:14265',
  
  /** @const {Number} MAX_ADDRESSES - Max number of addresses per account */
  'MAX_ADDRESSES': 1000000,
  
  /** @const {Number} DEPTH - Depth for the tip selection */
  'DEPTH': 3,
  
  /** @const {Number} MWM - Min Weight Magnitude */
  'MWM': 15,

  /** @const {Number} MAX_SWEEPS_PER_PROCESS - Max sweeps per process, will be batched according to SWEEP_BATCH_SIZE **/
  'MAX_SWEEPS_PER_PROCESS': 10000,

  /** @const {Number} MAX_SWEEPS_PER_SYNC - Max number of pending sweeps to process per sync */
  'MAX_SWEEPS_PER_SYNC': 1000000,

  /** @const {Number} ADDRESSES_BATCH_SIZE - Max batch size of addresses passed to getBalance */ 
  'ADDRESSES_BATCH_SIZE': 1000,

  /** @const {Number} SWEEP_BATCH_SIZE - Max batch size for each sweep */ 
  'SWEEP_BATCH_SIZE': 10,

  /** @const {Number} INCLUSION_STATES_BATCH_SIZE - Max batch size for requesting inclusion states */
  'INCLUSION_STATES_BATCH_SIZE': 1000,

  /** @const {String} HUB_PREFIX - Redis prefix for hubs */
  'HUB_PREFIX': 'hub_',

  /** @const {String} ACCOUNTS_COUNTER_KEY - Redis key for accounts counter */
  'ACCOUNTS_COUNTER_KEY': 'accounts_counter',

  /** @const {String} ACCOUNT_PREFIX - Redis prefix for accounts */
  'ACCOUNT_PREFIX': 'account_',

  /** @const {String} ACCOUNT_INDEX_KEY - Redis key for the account index counters */
  'ACCOUNT_INDEX_KEY': 'account_index',

  /** @const {String} ADDRESSES_PREFIX - Redis prefix for new addresses */
  'ADDRESSES_PREFIX': 'addresses_',

  /** @const {String} USED_ADDRESSES__PREFIX - Redis prefix for used addresses */ 
  'USED_ADDRESSES_PREFIX': 'used_addresses_',

  /** @const {String} PENDING_SWEEPS_PREFIX - Redis prefix for pending for confirmation sweeps */
  'PENDING_SWEEPS_PREFIX': 'pending_sweeps_',

  /** @const {String} FAILING_SWEEPS_PREFIXX - Redis prefix for sweeps that failed */
  'FAILING_SWEEPS_PREFIX': 'failing_sweeps_',

  /** @const {String} HOT_WALLET_INDEX_KEY - Redis key for the hot wallet index counter */
  'HOT_WALLET_INDEX_KEY': 'hotwallet_index',

  /** @const {String} HOT_WALLET_INPUTS_PREFIX - Redis prefix for hot wallet inputs */
  'HOT_WALLET_INPUTS_PREFIX': 'hotwallet_inputs_',

  /** @const {String} HOT_WALLET_LOCKED_INPUTS_PREFIX - Redis prefix for locked hot wallet inputs */
  'HOT_WALLET_LOCKED_INPUTS_PREFIX': 'hotwallet_locked_inputs_'

};
