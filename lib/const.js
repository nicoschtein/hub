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

  'SWEEP_CHECK_DECAY': 1,

  'ADDRESSES_BATCH_SIZE': 50,

  /** @const {Number} REPLAY_AFTER - Replay timeout */
  'REPLAY_AFTER': 30 * 60 * 1000,

  /** @const {Boolean} REPLAY_INCOMING - Replay or not incoming transfers */
  'REPLAY_INCOMING': true,

  'HUB_PREFIX': 'hub_',

  'ACCOUNT_PREFIX': 'account_',

  'ACCOUNT_INDEX_KEY': 'account_index_',

  'ADDRESSES_PREFIX': 'address_',

  'HOT_WALLET_INDEX_KEY': 'hotwallet_index_',

  'PENDING_SWEEPS_PREFIX': 'pending_sweeps_',

  'FAILING_SWEEPS_PREFIX': 'failing_sweeps_'

};
