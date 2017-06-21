const redis = require('redis');
class redisAdapter {
  
  constructor(client) {
    
    if (!client) {
      this.client = redis.createClient();
    }

  }
  
  get(prefix, key) {
    
    return new Promise((resolve) => {
    
      this.client.get(prefix + key, (err, reply) => {
      
        if (err) {
          console.log(err);
          resolve(null);
        }
        else {
          let obj = JSON.parse(reply);
          resolve(obj);
        }

      });

    });

  }

  set(prefix, key, value) {
   
    const value = JSON.stringify(obj);
    
    return new Promise((resolve) => {
    
      this.client.set(prefix + key, value, (err) => {
      
        if (err) {
          console.log(err);
          resolve(false);
        }
	      else {
          resolve(true);
        }

      });
    
    });

  }

  incr(key, value) {
    
    return new Promise((resolve) => {
    
      this.client.incr(key, (err, value) => {
      
        if (err) {
          console.log(err);
          resolve(false);
        }
	      else {
          resolve(value);
        }
      
      });
   
    });
  
  }

  del(prefix, key) {
  
  }

  hset(prefix, hash, field, value) {
  
    return new Promise((resolve) => {
    
      this.client.hset(prefix + hash, field, value, (err) => {
        
        if (err) {
          console.log(err);
          console.log(false);
        }
        else {
          resolve(true)
        }

      });

    });

  }

  hgetall(prefix, hash) {
  
    return new Promise((resolve) => {
  
      this.client.hgetall(prefix + hash, (err, res) => {
      
        if (err) {
          console.log(err);
          return false;
        }
        else {
          return res;
        }

      });

    });

  }


  hvals(prefix, hash) {
    
    return new Promise((resolve) => {
    
      this.client.hvals(prefix + hash, (err, vals) => {
        
        if (err) {
          console.log(err);
          return false;
        }
        else {
          return vals;
        }

      });

    });

  }

}

module.exports = redisAdapter;
