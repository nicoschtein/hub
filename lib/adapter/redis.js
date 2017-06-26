const redis = require('redis');

class redisAdapter {
  
  constructor(options) {

    this.client = redis.createClient();

  }
  
  get(prefix, key) {
    
    return new Promise((resolve) => {
      this.client.get(prefix + key.toString(), (err, reply) => {

        if (err) {
          console.log(err);
          resolve(null);
        }
        else {
          const obj = JSON.parse(reply);
          resolve(obj);
        }

      });

    });

  }

  set(prefix, key, obj) {
   
    const value = JSON.stringify(obj);
    
    return new Promise((resolve) => {

      this.client.set(prefix + key.toString(), value, (err) => {
      
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
    
      this.client.incr(prefix + key.toString(), (err, value) => {
      
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
    
      this.client.rpush(prefix + key.toString(), value, (err) => {
        
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

  lpush(prefix, key, obj) {
  
    const value = JSON.stringify(obj);

    return new Promise((resolve) => {
    
      this.client.lpush(prefix + key.toString(), value, (err) => {
        
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

  rpop(prefix, key) {
  
    return new Promise((resolve) => {
    
      this.client.rpop(prefix + key.toString(), (err, res) => {
        
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

  lpop(prefix, key) {
  
    return new Promise((resolve) => {
    
      this.client.lpop(prefix + key.toString(), (err, res) => {
        
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
  
  lrange(prefix, key, start, stop) {

    return new Promise((resolve) => {
    
      this.client.rpush(prefix + key.toString(), start, stop, (err, res) => {
        
        if (err) {
          console.log(err);
          resolve(false);
        }
        else {
          resolve(res.map((item) => {
            return JSON.parse(item);
          }));
        }

      });

    }); 
  
  }

  ltrim(prefix, key, start, stop) {
    
    return new Promise((resolve) => {
    
      this.client.ltrim(prefix + key.toString(), start, stop, (err) => {
        
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
    
      this.client.hset(prefix + hash.toString(), field.toString(), value, (err) => {
        
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
  
      this.client.hgetall(prefix + hash.toString(), (err, res) => {
      
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
    
      this.client.hvals(prefix + hash.toString(), (err, vals) => {
        
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
    
      this.client.hdel(prefix + hash.toString(), field.toString(), (err, vals) => {
        
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
