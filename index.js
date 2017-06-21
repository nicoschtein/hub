const Hub = require('./lib/hub');
const RedisAdapter = require('./lib/adapter/redis');

const hub = Hub({
  'store': new RedisAdapter()
});
