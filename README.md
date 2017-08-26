# Hub
Hub provides **input management** and **withdrawal** services, for exchanges seeking to integrate IOTA.

## Hubs and accounts
A `hub` groups together a collection of user accounts. Both hubs and accounts are being identified by a unique `id`. 
Each `account` may obtain different addresses that are derived from the same hub seed. Each hub must have its own unique _**seed**_.
Accounts hold their own **balance on Tangle**, which reflects the total value of unconfirmed deposits, 
their own **credit** (confirmed value) and their **index** which is relative to their id.

An exchange may keep several hubs according to their needs.

## Hot wallet
An exchange maintains a hot wallet, which is constantly being refueled by user deposits,
or by exchange managers. The hot wallet is comprised of inputs that are being stored as objects, represented by their `address`, its `keyIndex` and `balance`. Along with accepting funds, it is used to provide the inputs for withdrawals. Upon withdrawal, hot wallet inputs are being replaced by new ones, to prevent key reuse. These new inputs receive the remainder value of each withdrawal.

>It is advised to maintain a sufficient number of hot wallet inputs to handle the anticipated amount of withdrawals without downtime.

## Internal sweeps
When a user deposits to associated addresses, this balance will be automatically swept to a hot wallet address, once the sweep is confirmed, 
the user will be credited. This is done by calling `hub.process()` and `hub.sync()` periodically. 
All pending sweeps are stored in database and await for syncing.

---

### Notice:
Note that Hub is an **early beta release**, as such ensure that proper testing is done before production use. In case you find an issue please contact the authors.

---

## Getting started
### Prerequisites
Hub is built to be database agnostic. The latest release utilizes a **[`Redis`](https://redis.io/)** store.
If you prefer another database engine, please implement the current interface as it is in [`lib/adapter/redis.js`](https://github.com/chrisdukakis/hub/blob/master/lib/adapter/redis.js), or contact the author for support.

Hub uses ES6 syntax and ES2017 async functions, hence it requires **`node v7.6.0`** or higher.

#### Running with Babel
If you are not using `node v7.6+` or favor an LTS version, we recommend to set up with [`babel`](https://babeljs.io/) and [`babel-preset-env`](https://github.com/babel/babel-preset-env).

Install `babel` with:
```
npm install babel-register babel-preset-env --save
```
Require `babel-register` in your entry point:
```Javascript
require('babel-register');
```
And set up a `.babelrc` file:
```JSON
{
  "presets": [
    ["env", {
      "targets": {
        "node": true
      }
    }]
  ]
}
```

### Installation
Clone the repository:
```
git clone https://github.com/chrisdukakis/hub.git
```
Install dependencies:
```
cd hub
npm install
```

---

## API

### `Hub`
Hub class constructor
```Javascript
const HUB = require('./hub/index.js');
const Store = new HUB.store(); // Default redis client constructor

const Hub = HUB({
  'storageAdapter': Store, // Storage adapter
  'provider': 'http://localhost:14700', // IOTA provider
  'seed': 'HOTWALLETSEED', // Seed of the hot wallet
  'security': 2 // Security lever
});
```
#### Input
1. **`options`**: `Object`
 - **`storageAdapter`**: `Object` Compatible storage adapter
 - **`provider`**: `String` IRI host, default is `http://localhost:17400`
 - **`seed`**: `String` 81-trytes seed of the **hot wallet**
 - **`security`**: `Int` Security level of the **hot wallet**, can be 1, 2 or 3. The default recommended value is 2

#### Return
`Object` - Returns a Hub class instance

---

### `Hub.create`
Creates a new hub
```Javascript
Hub.create(id, options)
```
#### Input
1. **`id`**: `Int` Unique identifier for each hub
2. **`options`**: `Object`
 - **`seed`**: `String` _**Unique**_ seed of the hub
 - **`security`**: `Int` Security level of the hub
 - **`name`**: `String` Optional name

#### Return
`Mixed` - Newly created hub instance. False if creation failed.

---

### `Hub.attach`
Attaches a hub by its instance.
Attachment is required to perform `process()` and `sync()` operations on a hub.
It will throw an error if hub has been already attached.
```Javascript
Hub.attach(hub)
```
#### Input
1. **`hub`**: `Object` Hub instance

#### Return
`Object` - `Hub` class instance

---

### `Hub.attachById`
Similar to `attach(hub)`. It calls `find(id)` to fetch a hub instance by id and attach it. It will throw an error if hub has been already attached.
```Javascript
await Hub.attachById(id)
```
#### Input
1. **`id`**: `Int` Hub id

#### Return
`Object` - `Hub` class instance

---

### `Hub.detach`
Detaches a hub by its `id`. Once detached `process` and `sync` will not be able to access it.
```Javascript
Hub.detach(id)
```
#### Input
1. **`id`** `Int` Hub id

#### Return
`Boolean` - `true` if hub has been detached, `false` if hub was not attached before.

---

### `Hub.isAttached`
Helper method to determine if a hub is currently attached.
```Javascript
Hub.isAttached(id)
```
#### Input
1. **`id`**: `Int` Hub id

#### Return
`Mixed` - Returns `true` if attached, `false` otherwise.

---

### `Hub.find`
Fetches a hub instance by `id`.
```Javascript
await Hub.find(id)
```
#### Input
1. **`id`**: `Int` Hub id

#### Return
`Mixed` - Returns a `hub` instance if found, `false` otherwise.

---

### `Hub.registerAccount`
Registers a new account on the given hub by instantiating a record in the store. An optional name can be attributed to the account.
```Javascript
await Hub.registerAccount(hubId, name)
```
#### Input
1. **`hubId`**: `Int` Id of the hub the account belongs to
2. **`name`**: `String` Optional name

### Return
`Mixed` - Account `Object` if registration was successful, `false` otherwise

---

### `Hub.getNewDepositAddress`
Creates a new address at the next account index and saves it in the store.
```Javascript
await Hub.getNewDepositAddress(hubId, accountId, checksum)
```
#### Input
1. **`hubId`**: `Int` Id of the hub that account belongs to
2. **`accountId`**: `Int` Account id
3. **`checksum`**: `Boolean` Wether or not address is stored and return with checksum. Optional, defaults to `true`

#### return
`Mixed` - Address `String` as 90-trytes (81 without checksum), `false` on failure

---

### `Hub.getDepositAddress`
Fetches the latest address from store given a hub and an account Id. An optional `keyIndex` argument can be passed to fetch address at a specific key index.
Note that if address at specified keyIndex is not in store, `false` will be returned.
```Javascript
await Hub.getNewDepositAddress(hubId, accountId, keyIndex)
```
#### Input
1. **`hubId`**: `Int` Id of the hub that account belongs to
2. **`accountId`**: `Int` Account id
3. **`keyIndex`**: `Int` Key index of address. Optional.

#### return
`Mixed` - Address `String` as 90-trytes (81 without checksum), `false` on failure

---

### `Hub.withdraw`
Executes withdrawals to destination addresses based on provided `transfers`.
If `checkAddresses` is set to true, all destination addresses will be examined for spendings, and if so, related transfers will be rejected.
It also checks if account has sufficient credit. A `withdrawal` event will be emitted for each executed transaction providing related details.
Node that you may extract the tail transaction hash from the event data or the returned array, and use it for replays.

> Hint: Preferably do not pass more than `10` transfers at once.

```Javascript
async withdraw(transfers, checkAddresses);
```
#### Input
1. **`transfers`**: `Array` Array of transfer objects
 - **`hubId`**: `Int` Id of the hub the account belongs to
 - **`accountId`**: `Int` Account id
 - **`value`**: `Int` Value to be withdrawn in _IOTAs_
 - **`destinationAddress`**: `String` Destination address with or without checksum
 - **`message`**: `String` Tryte-encoded message to be included in the transaction, optional
 - **`tag`**: `String` 27-Trytes tag, optional

#### Return
`Array` - Array of transaction objects

---

### `Hub.credit`
Updates account credit by adding the given `value`. It accepts negative value too and its purpose is to execute off-chain transfers between users.
Note that it will emit a `credit` event.
```Javascript
await Hub.credit(hubId, accountId, value)
```
#### Input
1. **`hubId`**: `Int` Id of the hub that account belongs to
2. **`accountId`**: `Int` Account id to add credit to
3. **`value`**: `Int` Amount of credit in _IOTAs_, can be negative too

#### Return
`Boolean` - `true` if credit was successful, false otherwise.

---

### `Hub.process`
Process a hub by `id`. It will scan all unused(unspent) hub addresses and perform sweeps on all detected deposits. If `scanUsed` is set to true only used(spent) hub addresses will be scanned. Emits a `deposit` event upon each detected deposit and a `sweep` event for each successful sweep. Note that `process()`
```Javascript
await Hub.process(id, options)
```
#### Input
1. **`id`**: `Int` Hub id
2. **`options`**: `Object` Optional options
 - **`scanUsed`**: `Boolean` Optional direction to scan used addresses. Defaults to `false`
 - **`maxSweeps`**: `Int` Optional limit for max sweeps to process. Defaults to `1000`

#### Return
`Boolean` - `true` if successful, false otherwise.

---

### `Hub.sync`
Synchronizes the state of the given hub by automatically updating `balanceOnTangle` and `credit` of all accounts related to the sweeps that have been confirmed so far.
It will emit a `credit` event upon each successful sweep.
```Javascript
await Hub.sync(id)
```
#### Input
1. **`id`**: `Int` Hub id
2. **`maxPendingSweeps`**: `Int` Optinal limit for pending sweeps to check. Defaults to `1000000`

#### Return
`Boolean` - `true` if successful, `false` otherwise.

---

### `Hub.createHotWalletInput`
Creates and stores a new hot wallet input, including address with checksum by default.
A hot wallet input is represented as an object with `address`, `keyIndex` and `value` being its properties.
```Javascript
await Hub.createHotWalletInput(checksum)
```
#### Input
1. **`checksum`**: `Boolean` Include checksum for the address or not. Optional, defaults to `true`.

#### Return
`Mixed` - `input` object or `false` in case of failure.

---

### `Hub.getBalances`
Utility function that fetches balances of all provided addresses in batches and ensures the order of output matches that of the input.
```Javascript
await Hub.getBalances(addresses)
```
#### Input
1. **`addresses`**: `Array` Array of addresses

#### Return
`Array` - Array of balances, each being an integer or `null` if not determined.

---

### `Hub.isUsed`
Utility function that determines if an address has been previously spent.
```Javascript
await Hub.isUsed(address)
```
#### Input
1. **`address`**: `String` Address to be checked

#### Return
`Object` - Returns a `Promise` which resolves to `true`, `false` or `null` if not determined.

---

### `Hub.hasCredit`
Determines if an account has at least the given value of credit.
```Javascript
await Hub.hasCredit(hubId, accountId, value)
```
#### Input
1. **`hubId`**: `Int` Hub id
2. **`accountId`** `Int` Account id
3. **`value`** `Int` Value of credit in IOTAs

#### Return
`Boolean`

---

### `Hub.getAccount`
Get information about the given account.
```Javascript
await Hub.getAccount(hubId, accountId)
```
#### Input
1. **`hubId`**: `Int` Hub id
2. **`accountId`** `Int` Account id

#### Return
`Mixed`

`Object`
 - `id`: `Int` Account id
 - `hubId`: `Int` Hub id
 - `name`: `String` Account name
 - `balanceOnTangle`: `Int` _Unconfirmed_ balance on Tangle in IOTAs (before sweep confirmation)
 - `credit`: `Int` _Confirmed_ credit in IOTAs

Return `false` on failure.

---

### `Hub.getBalanceOnTangle`
Get the _unconfirmed_ balance on Tangle of the given account. This is the balance of deposit addresses before sweeps confirm.
```Javascript
await Hub.getBalanceOnTangle(hubId, accountId)
```
#### Input
1. **`hubId`**: `Int` Hub id
2. **`accountId`** `Int` Account id

#### Return
`Int` - Balance on Tangle in IOTAs

---

### `Hub.getCredit`
Get the _confirmed_ credit of the given account.
```Javascript
await Hub.getCredit(hubId, accountId)
```
#### Input
1. **`hubId`**: `Int` Hub id
2. **`accountId`** `Int` Account id

#### Return
`Int` - Credit in IOTAs

---

### Events
Hub emits events with relevant data for important occurrences, such as **deposits**,  **sweeps**, **credits** and **withdrawals**.
```Javascript
Hub.on('even name', (data) => {
  // Do something with data...
})
```

---

#### Event `deposit`
Emitted by `process()` once balance is discovered on a hub address.
- **`data`**: `Object`
 - **`hub`**: `Int` Hub id where account belongs to
 - **`account`**: `Int` Related account id
 - **`address`**: `String` Related hub address
 - **`keyIndex`**: `Int` Key index of address
 - **`value`**: `Int` Deposited value in _IOTAs_

---

#### Event `sweep`
Emitted by `process()` after `deposit` event, after execution of a sweep transfer to a hot wallet address.
- **`data`**: `Object`
 - **`hub`**: `Int` Hub id where account belongs to
 - **`account`**: `Int` Related account id
 - **`address`**: `String` Hub address, used as input in sweep transfer
 - **`keyIndex`**: `Int` Key index of hub address
 - **`destinationAddress`**: `String` Hot wallet address that received the funds
 - **`value`**: `Int` Value in _IOTAs_
 - **`tx`**: `String` Tail transaction hash of the sweep transfer

---

#### Event `credit`
Emitted by `sync()` once a pending sweeps confirmed and the user has been successfully credited.
- **`data`**: `Object`
 - **`hub`**: `Int` Hub id where account belongs to
 - **`account`**: `Int` Related account id
 - **`value`**: `Int` Credited value in _IOTAs_, could be negative
 - **`credit`**: `Int` Updated credit in _IOTAs_
 - **`balanceOnTangle`**: `Int` Updated balance On Tangle in _IOTAs_
 - **`offChain`**: `Boolean` Wether the credit was done off-chain or not.

---

#### Event `withdraw`
Emitted by `withdraw()` for each successful transfer.
- **`data`**: `Object`
 - **`hub`**: `Int` Hub id where account belongs to
 - **`account`**: `Int` Related account id
 - **`value`**: `Int` Withdrawn value in _IOTAs_
 - **`credit`**: `Int` New credit in _IOTAs_
 - **`address`**: `String` Address value was sent to
 - **`inputs`**: `Array` Array of inputs used for the transfer
 - **`remainderAddress`**: `Int` Remainder address
 - **`remainder`**: `Int` Remainder value in _IOTAs_
 - **`hash`**: `String` Tail transaction hash
 - **`updatedAccount`**: `Boolean` Indicates if account has been successful updated, or not
