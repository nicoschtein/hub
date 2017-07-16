const Hub = require('./lib/hub.js');
Hub.store = require('./lib/adapter/redis.js');

module.exports = Hub;
