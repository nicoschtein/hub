'use strict';

const crypto    = require('crypto.iota.js'); 
const Converter = crypto.converter;
const Bundle    = crypto.bundle;
const Singing   = crypto.signing;
const HMAC      = require('./hmac');
const constants = require('./const');

/**
 * Here is a modified version of sendTransfer() of iota.lib.js
 * It is only inteded to work properly in the context of Hub.
 * 
 * DO NOT use this method elsewhere, unless you clearly understand its purpose.
 *
 */

// Extracted from iota.lib.js and modified for the specific case of sweep transfers. 
function prepareTransfers(iota, seed, transfers, options) {

  const api = iota.api;
  const valid = iota.valid;
  const utils = iota.utils;

  let addHMAC = false;
  let addedHMAC = false;

  if (!inputValidator.isTrytes(seed)) {
    throw new Error('Invalid seed.');
  }

  if (options.hasOwnProperty('hmacKey') && options.hmacKey) {
    if(valid.isTrytes(options.hmacKey)) {
      throw new Error('Invalid HMAC trytes');
    }
    addHMAC = true;
  }

  if (!options.hasOwnProperty('inputs')) {
    throw new Error('Provide valid inputs');
  }

  // If inputs provided, validate the format
  if (options.inputs && !inputValidator.isInputs(options.inputs)) {
    throw new Error('Invalid inputs');
  }

  // If message or tag is not supplied, provide it
  // Also remove the checksum of the address if it's there after validating it
  transfers.forEach(function(thisTransfer) {
    
    thisTransfer.message = thisTransfer.message ? thisTransfer.message : '';
    thisTransfer.tag = thisTransfer.tag ? thisTransfer.tag : '';
    
    if (addHMAC && thisTransfer.value > 0) {
      thisTransfer.message = nullHashTrytes + thisTransfer.message;
      addedHMAC = true;
    }
    
    // If address with checksum, validate it
    if (thisTransfer.address.length === 90) {
      if (!utils.isValidChecksum(thisTransfer.address)) {
        return callback(`Invalid checksum of address: ${thisTransfer.address}`);
      }
    }
    
    thisTransfer.address = utils.noChecksum(thisTransfer.address);
  
  });

  // Input validation of transfers object
  if (valid.isTransfersArray(transfers)) {
    throw new Error('Invalid Transfers');
  }
  
  const remainderAddress = options.address || null;
  const inputs = options.inputs || [];
  const security = options.security || 2;

  // Create a new bundle
  const bundle = new Bundle();

  let totalValue = 0;
  const signatureFragments = [];
  let tag;

  // Iterate over all transfers, get totalValue
  // and prepare the signatureFragments, message and tag
  for (let i = 0; i < transfers.length; i++) {
    
    let signatureMessageLength = 1;
    
    // If message longer than 2187 trytes, increase signatureMessageLength (add 2nd transaction)
    if (transfers[i].message.length > 2187) {

      // Get total length, message / maxLength (2187 trytes)
      signatureMessageLength += Math.floor(transfers[i].message.length / 2187);
      
      let msgCopy = transfers[i].message;
      
      // While there is still a message, copy it
      while (msgCopy) {
      
        let fragment = msgCopy.slice(0, 2187);
        
        msgCopy = msgCopy.slice(2187, msgCopy.length);
        
        // Pad remainder of fragment
        for (let j = 0; fragment.length < 2187; j++) {
          fragment += '9';
        }
      
        signatureFragments.push(fragment);
      
      }
    
    }
    
    else {
      
      // Else, get single fragment with 2187 of 9's trytes
      let fragment = '';
      
      if (transfers[i].message) {
        fragment = transfers[i].message.slice(0, 2187);
      }

      for (let j = 0; fragment.length < 2187; j++) {
        fragment += '9';
      }
      
      signatureFragments.push(fragment);
    
    }
    
    // get current timestamp in seconds
    const timestamp = Math.floor(Date.now() / 1000);
    
    // If no tag defined, get 27 tryte tag.
    tag = transfers[i].tag ? transfers[i].tag : '999999999999999999999999999';

    // Pad for required 27 tryte length
    for (let j = 0; tag.length < 27; j++) {
      tag += '9';
    }
    
    // Add first entries to the bundle
    // Slice the address in case the user provided a checksummed one
    bundle.addEntry(signatureMessageLength, transfers[i].address, transfers[i].value, tag, timestamp)

    // Sum up total value
    totalValue += parseInt(transfers[i].value);
  
  }

  if (!totalValue) {
    callback('Invalid total value');
  }

  for (let i = 0; i < inputs.length; i++) {
    
    let thisBalance = inputs[i].balance;
    let timestamp = Math.floor(Date.now() / 1000);
    
    // Add input as bundle entry
    bundle.addEntry(inputs[i].security, inputs[i].address, 0 - inputs[i].balance, tag, timestamp);

  }

  bundle.finalize();
  bundle.addTrytes(signatureFragments);

  // SIGNING OF INPUTS
  //
  // Here we do the actual signing of the inputs
  // Iterate over all bundle transactions, find the inputs
  // Get the corresponding private key and calculate the signatureFragment
  for (let i = 0; i < bundle.bundle.length; i++) {
    
    if (bundle.bundle[i].value < 0) {
      
      let thisAddress = bundle.bundle[i].address;
      
      // Get the corresponding keyIndex and security of the address
      let keyIndex;
      let keySecurity;
      
      for (let k = 0; k < inputs.length; k++) {
      
        if (inputs[k].address === thisAddress) {
        
          keyIndex = inputs[k].keyIndex;
          keySecurity = inputs[k].security ? inputs[k].security : security;
      
          break;
        
        }
      
      }
      
      const bundleHash = bundle.bundle[i].bundle;
      
      // Get corresponding private key of address
      const key = Signing.key(Converter.trits(seed), keyIndex, keySecurity);

      // Get the normalized bundle hash
      const normalizedBundleHash = bundle.normalizedBundle(bundleHash);
      const normalizedBundleFragments = [];
      
      
      // Split hash into 3 fragments
      for (let l = 0; l < 3; l++) {
        normalizedBundleFragments[l] = normalizedBundleHash.slice(l * 27, (l + 1) * 27);
      }

      // First 6561 trits for the firstFragment
      const firstFragment = key.slice(0, 6561);
      
      // First bundle fragment uses the first 27 trytes
      const firstBundleFragment = normalizedBundleFragments[0];

      // Calculate the new signatureFragment with the first bundle fragment
      const firstSignedFragment = Signing.signatureFragment(firstBundleFragment, firstFragment);

      // Convert signature to trytes and assign the new signatureFragment
      bundle.bundle[i].signatureMessageFragment = Converter.trytes(firstSignedFragment);
      
      // if user chooses higher than 27-tryte security
      // for each security level, add an additional signature
      for (let j = 1; j < keySecurity; j++) {

        // Because the signature is > 2187 trytes, we need to
        // find the subsequent transaction to add the remainder of the signature
        // Same address as well as value = 0 (as we already spent the input)
        if (bundle.bundle[i + j].address === thisAddress && bundle.bundle[i + j].value === 0) {

          // Use the next 6561 trits
          const nextFragment = key.slice(6561 * j,  (j + 1) * 6561);
          const nextBundleFragment = normalizedBundleFragments[j];
          
          // Calculate the new signature
          const nextSignedFragment = Signing.signatureFragment(nextBundleFragment, nextFragment);
          
          // Convert signature to trytes and assign it again to this bundle entry
          bundle.bundle[i + j].signatureMessageFragment = Converter.trytes(nextSignedFragment);
        
        }
      
      }
    
    }
  
  }

  if(addedHMAC) {
    const hmac = new HMAC(options.hmacKey);
    hmac.addHMAC(bundle);
  }

  const bundleTrytes = [];
  
  // Convert all bundle entries into trytes
  bundle.bundle.forEach(function(tx) {
    bundleTrytes.push(Utils.transactionTrytes(tx));
  });
  
  return callback(null, bundleTrytes.reverse());

}

// Prepare transfers and send trytes
module.exports = (iota) => {

  async function sendSweepTransfer(seed, transfers, options) {

    if (!(this instanceof sendSweepTransfer)) {
      return new sendSweepTransfer(seed, transfers, options);
    }

    const iota = this.iota;

    const trytes = await new Promise((resolve) => {
      prepareTransfers(iota, seed, transfers, options, (err, trytes) => {
        if (err) {
          cosnole.log(err);
          resolve(false);
        }
        else {
          resolve(trytes);
        }
      });
    });

    if (!trytes) {
      return false; 
    }

    return new Promise((resolve) => {
      iota.api.sendTrytes(trytes, constants.DEPTH, constants.MWM, (err, tx) => {
        if (err) {
          console.log(err);
          resolve(false);
        }
        else {
          resolve(tx);
        }
      });
    });
  
  }

  sendSweepTransfer.prototype.iota = iota;

  return sendSweepTransfer;

};
