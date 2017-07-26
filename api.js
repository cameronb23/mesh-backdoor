//var request = require('request');
var request = require('request-promise');

const sites = {
  jdsports: {
    path: "jdsports",
    useragent: "JDSports",
    key: "FD50C8B912E245288022DC26F2AE2BD1",
    url: "https://www.jdsports.co.uk"
  },
  jdsportsalt: {
    path: "jdsports",
    useragent: "JDSports",
    key: "1A17CC86AC974C8D9047262E77A825A4",
    url: "https://www.jdsports.co.uk"
  },
  size: {
    path: "size",
    useragent: "Size?",
    key: "EA0E72B099914EB3BA6BE90A21EA43A9",
    url: "https://www.size.co.uk"
  },
  footpatrol: {
    path: "footpatrol",
    useragent: "FootPatrol",
    key: "5F9D749B65CD44479C1BA2AA21991925",
    url: "https://www.footpatrol.co.uk"
  }
}

// returns headers needed
module.exports.h = (settings) => {
  return {
    'cache-control': 'no-cache',
    'X-API-Key': settings.key,
    'X-DEBUG': 1,
    'User-Agent': `${settings.useragent}-APPLEPAY/4.0 CFNetwork/808.2.16 Darwin/16.3.0`,
    'MESH-Commerce-Channel': 'iphone-app'
  }
}

// get full url
module.exports.u = (settings) => {
  return `https://www.${settings.path}.co.uk`;
}

// TODO: finish this
module.exports.requestStock = (site, pid) => {
  let settings = sites[site];

  // returns 404 if product not loaded
  let url = `https://commerce.mesh.mx/stores/${settings.path}/products/${pid}
              ?expand=variations,informationBlocks,customisations&channel=iphone-app`;
}

// returns promise with resolution of
// [ { size: 8.5, variantId: 848211 } ]
module.exports.getVariants = (site, pid) => {
  let settings = sites[site];

  let url = `https://commerce.mesh.mx/stores/${settings.path}/products/${pid}
              ?expand=variations&channel=iphone-app`;

  let opts = {
    url: url,
    method: 'GET',
    headers: h(settings)
  };

  return new Promise((resolve, reject) => {
    request(opts, (err, response, body) => {
      if(err) {
        return reject(err);
      }

      let data = JSON.parse(body);

      var array = [];

      console.log(data);

      let variants = data.sortedOptions;

      console.log(variants);

      variants.forEach((v) => {
        if(v.product.optionsTypes[0] == "Size") {
          array.push({
            size: v.product.size,
            variantId: v.product.SKU.split(".")[1]
          });
        }
      });

      return resolve(array);
    });
  })
}

// returns array of products(raw) in cart id supplied
module.exports.getCartItems = (site, cartId) => {
  let settings = sites[site];

  let url = `https://commerce.mesh.mx/stores/${settings.path}/carts/${cartId}`;

  var opts = {
    url: url,
    method: 'GET',
    headers: h(settings),
    transform: (body) => { JSON.parse(body) }
  };

  return new Promise((resolve, reject) => {
    request(opts)
    .then((json) => {
      let cartItems = json.products;

      return resolve(cartItems);
    })
    .catch((err) => {
      return reject(err);
    })
  })
}

// returns Promise with new cart ID
module.exports.getNewCart = (settings) => {
  return new Promise((resolve, reject) => {
    let opts = {
      url: `https://commerce.mesh.mx/stores/${settings.path}/carts`,
      method: 'POST',
      headers: h(settings),
      body: {
	       products: []
      },
      json: true
    };

    request(opts)
    .then((body) => {
      return resolve(body.ID);
    })
    .catch((err) => {
      return reject(err);
    })
  })
}

// returns with cart ID
module.exports.addToCart = (site, pid, variantId) => {
  let settings = sites[site];

  return new Promise((resolve, reject) => {
    getNewCart(settings)
    .then((cartId) => {
      let url = `https://commerce.mesh.mx/stores/${settings.path}/carts/${cartId}/${pid}.${variantId}`;

      let opts = {
        url: url,
        method: 'PUT',
        headers: h(settings),
        resolveWithFullResponse: true,
        simple: false
      };

      // 283271.715251

      request(opts)
      .then((res) => {
        let json = null;

        try {
          json = JSON.parse(res.body);
        } catch(e) {}

        if(res.statusCode !== 200 && json !== null) {
          return reject("Could not add to cart: " + json.error.message);
        }

        if(json !== null) {
          if(json.ID !== null) {
            return resolve(json.ID);
          }
        }

        return reject("Invalid/no body JSON returned.");
      }).catch((err) => {
        return reject("ATC failed due to tech error: " + err);
      })


    })
    .catch((err) => {
      return reject("Error while getting cart: " + err);
    });
  })
}
