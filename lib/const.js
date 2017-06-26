module.exports = {
  
  /** @const {String} PROVIDER - Iota provider url */
  'PROVIDER': 'http://localhost:14265',
  
  /** @const {Number} MAX_ADDRESSES - Max number of addresses per account */
  'MAX_ADDRESSES': 1000000,
  
  /** @const {Number} DEPTH - Depth for the tip selection */
  'DEPTH': 3,
  
  /** @const {Number} MWM - Min Weight Magnitude */
  'MWM': 15,

  /** @const {Number} SWEEP_INTERVAL - Sweep intrval */
  'SWEEP_INTERVAL': 2 * 60 * 1000,

  /** @const {Number} SWEEP_CHECK_DECAY - Decay constant for checking used address less often */ 
  'SWEEP_CHECK_DECAY': 0.7,

  /** @const {Number} ADDRESSES_BATCH_SIZEX - Max batch size of addresses passed to getBalance */ 
  'ADDRESSES_BATCH_SIZE': 1000,

  /** @const {Number} SWEEP_BATCH_SIZE - Max batch size for each sweep */ 
  'SWEEP_BATCH_SIZE': 10,

  /** @const {Number} INCLUSION_STATES_BATCH_SIZE - Max batch size for requesting inclusion states */
  'INCLUSION_STATES_BATCH_SIZE': 1000,

  /** @const {Number} REPLAY_AFTER - Replay timeout */
  'REPLAY_AFTER': 30 * 60 * 1000,

  /** @const {Boolean} REPLAY_INCOMING - Replay or not incoming transfers */
  'REPLAY_INCOMING': true,

  /** @const {String} HUB_PREFIX - Redis prefix for hubs */
  'HUB_PREFIX': 'hub_',

  /** @const {String} ACCOUNTS_COUNTER_KEY - Redis key for accounts counter */
  'ACCOUNTS_COUNTER_KEY': 'accounts_counter',

  /** @const {String} ACCOUNT_PREFIX - Redis prefix for accounts */
  'ACCOUNT_PREFIX': 'account_',

  /** @const {String} ACCOUNT_INDEX_KEY - Redis key for the account index counters */
  'ACCOUNT_INDEX_KEY': 'account_index',

  /** @const {String} ADDRESSES_PREFIX - Redis prefix for new addresses */
  'ADDRESSES_PREFIX': 'address_',

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
