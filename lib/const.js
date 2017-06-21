module.exports = {
  
  /** @const {String} PROVIDER - Iota provider url */
  'PROVIDER': 'http://localhost:14265',
  
  /** @const {Number} MAX_ADDRESSES - Max number of addresses per account */
  'MAX_ADDRESSES': 1000000,
  
  /** @const {Number} DEPTH - Depth for the tip selection */
  'DEPTH': 3,
  
  /** @const {Number} MWM - Min Weight Magnitude */
  'MWM': 15,

  /** @const {Number} INCLUSION_INTERVAL - Interval to check for inclusion states */
  'INCLUSION_INTERVAL': 2 * 60 * 1000,

  /** @const {Number} REPLAY_AFTER - Replay timeout */
  'REPLAY_AFTER': 30 * 60 * 1000,

  /** @const {Boolean} REPLAY_INCOMING - Replay or not incoming transfers */
  'REPLAY_INCOMING': true,

  'HUB_PREFIX': 'hub_',

  'ACCOUNT_PREFIX': 'account_',

  'ACCOUNT_INDEX_KEY': 'account_index_',

  'ADDRESSES_PREFIX': 'address_'
};
