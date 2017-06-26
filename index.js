const Hub = require('./lib/hub');
const RedisAdapter = require('./lib/adapter/redis');

const hub = Hub({
  'store': new RedisAdapter(),
  'seed': 'QWERTY9',
  'security': 2
});

const init = async () => {
  
  const testHub = await hub.create(0, 'ABCDEF9', 2, 'test');

  console.log(testHub);

  await hub.attach(testHub);

  const account = await hub.registerAccount(0, 0, 'chris');

  console.log(account);

}

init();
