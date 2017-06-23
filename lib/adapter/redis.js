const redis = require('redis');

class redisAdapter {
  
  constructor(options) {

    this.client = redis.createClient(options);

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

  set(prefix, key, obj) {
   
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

  incr(prefix, key, value) {
    
    return new Promise((resolve) => {
    
      this.client.incr(prefix + key, (err, value) => {
      
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

  rpush(prefix, key, obj) {
  
    const value = JSON.stringify(obj);

    return new Promise((resolve) => {
    
      this.client.rpush(prefix + key, value, (err) => {
        
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

  lrange(prefix, key, start, stop) {

    return new Promise((resolve) => {
    
      this.client.rpush(prefix + key, start, stop, (err, res) => {
        
        if (err) {
          console.log(err);
          resolve(false);
        }
        else {
          resolve(JSON.parse(res));
        }

      });

    }); 
  
  }

  ltrim(prefix, key, start, stop) {
    
    return new Promise((resolve) => {
    
      this.client.ltrim(prefix + key, start, stop, (err) => {
        
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

  hset(prefix, hash, field, value) {
  
    return new Promise((resolve) => {
    
      this.client.hset(prefix + hash, field, value, (err) => {
        
        if (err) {
          console.log(err);
          resolve(false);
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
          resolve(false);
        }
        else {
          resolve(res);
        }

      });

    });

  }

  hvals(prefix, hash) {
    
     return new Promise((resolve) => {
    
      this.client.hvals(prefix + hash, (err, vals) => {
        
        if (err) {
          console.log(err);
          resolve(false);
        }
        else {
          resolve(vals);
        }

      });

    });

 }

  hdel(prefix, hash, field) {
  
    return new Promise((resolve) => {
    
      this.client.hdel(prefix + hash, field, (err, vals) => {
        
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

}

module.exports = redisAdapter;
