//var request = require('request');
var request = require('request-promise');

module.exports.Sites = {
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
function h(settings) {
  return {
    'cache-control': 'no-cache',
    'X-API-Key': settings.key,
    'X-DEBUG': 1,
    'User-Agent': `${settings.useragent}-APPLEPAY/4.0 CFNetwork/808.2.16 Darwin/16.3.0`,
    'MESH-Commerce-Channel': 'iphone-app'
  }
}

// get full url
function u(settings) {
  return `https://www.${settings.path}.co.uk`;
}

// TODO: finish this
module.exports.requestStock = (site, pid) => {

  // returns 404 if product not loaded
  let url = `https://commerce.mesh.mx/stores/${site.path}/products/${pid}
              ?expand=variations,informationBlocks,customisations&channel=iphone-app`;
}

// returns promise with resolution of
// [ { size: 8.5, variantId: 848211 } ]
module.exports.getVariants = (site, pid) => {
  let url = `https://commerce.mesh.mx/stores/${site.path}/products/${pid}
              ?expand=variations&channel=iphone-app`;

  let opts = {
    url: url,
    method: 'GET',
    headers: h(site),
    json: true
  };

  return new Promise((resolve, reject) => {
    request(opts)
    .then((body) => {
      let data = body;

      var array = [];

      let variants = data.sortedOptions;

      variants.forEach((v) => {
        if(v.product.optionsTypes[0] == "Size") {
          array.push({
            size: v.product.size,
            variantId: v.product.SKU.split(".")[1]
          });
        }
      });

      return resolve(array);
    })
    .catch((err) => {
      return reject("Error getting variations: " + err);
    });
  })
}

// returns array of products(raw) in cart id supplied
module.exports.getCartItems = (site, cartId) => {

  let url = `https://commerce.mesh.mx/stores/${site.path}/carts/${cartId}`;

  var opts = {
    url: url,
    method: 'GET',
    headers: h(site),
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
function getNewCart(settings) {
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

module.exports.addToCart = (site, pid, variantId) => {
  return new Promise((resolve, reject) => {
    let url = `https://commerce.mesh.mx/stores/${site.path}/carts`;

    let b = {
      channel: 'iphone-app',
      products: [{
        SKU: `${pid}.${variantId}`,
        quantity: 1,
        type: 'cartProduct'
      }]
    }

    let opts = {
      url: url,
      method: 'POST',
      headers: h(site),
      resolveWithFullResponse: true,
      simple: false,
      body: b,
      json: true
    };

    request(opts)
    .then((res) => {

      let json = res.body;

      if(res.statusCode !== 200 && res.statusCode !== 201) {
        if(json !== null) {
          console.log("Got status code: " + res.statusCode);
          return reject("Could not add to cart: " + json.error.message);
        }
      }

      if(json !== null) {
        if(json.error != null) {
          return reject(json.error.message);
        }

        if(json.ID !== null) {
          return resolve(json.ID);
        }
      }
    }).catch((err) => {
      return reject("ATC failed due to tech error: " + err);
    })
  })
}

class Runner {

  constructor(site, cartId) {
    this.profile = require('./profiles.json')[0];
    this.site = site;
    this.cookies = request.jar();
    this.cartId = cartId;
  }

  checkout() {
    // start checkout
    return new Promise((resolve, reject) => {
      this.setCustomerDetails()
      .then((response) => {
        return resolve(response);
      })
      .catch((err) => {
        return reject(err);
      })
    })
  }

  setCustomerDetails() {
    let url = `https://commerce.mesh.mx/stores/${this.site.path}/customers`;

    let opts = {
      url: url,
      method: 'POST',
      headers: h(this.site),
      json: true,
      body: this.profile.customer,
      jar: this.cookies
    }

    return new Promise((resolve, reject) => {
      // need customer ID and address ID
      request(opts)
      .then((json) => {
        let customerId = json.ID,
            addressId = json.addresses[0].ID;

        let opts = {
          url: `https://commerce.mesh.mx/stores/${this.site.path}/carts/${this.cartId}`,
          method: 'PUT',
          headers: h(this.site),
          json: true,
          body: {
            customerID: customerId,
            billingAddressID: addressId,
            deliveryAddressID: addressId
          },
          jar: this.cookies
        }

        request(opts)
        .then((json) => {
          return resolve(this.makePayment());
        })
        .catch((err) => {
          return reject("Error setting customer to cart: " + err);
        })
      }).catch((err) => {
        return reject("Error making customer profile: " + err);
      });
    })
  }

  makePayment() {
    let opts = {
      url: `https://commerce.mesh.mx/stores/${this.site.path}/carts/${this.cartId}/hostedPayment`,
      method: 'POST',
      headers: h(this.site),
      body: {
        type: "CARD",
        terminals: {
          successURL: `${this.site.url}/checkout`,
          failureURL: "https://fail",
          timeoutURL: "https://timeout"
        }
      },
      json: true,
      jar: this.cookies
    }

    return new Promise((resolve, reject) => {
      request(opts)
      .then((json) => {
        // check status and grab our payment id
        console.log("Checkout status: " + json.status);

        let checkoutUrl = json.terminalEndPoints.hostedPageURL;
        let sessionID = checkoutUrl.split("?HPS_SessionID=")[1];

        console.log("Got payment session id " + sessionID);
        console.log("Submitting payment info now.");

        // just load page so we get a JSessionID
        let newCookies = request.jar();
        request({
          url: checkoutUrl,
          jar: this.cookies,
          method: 'GET',
          resolveWithFullResponse: true
        })
        .then((res) => {

          // get cookie

          let key;

          Object.keys(res.headers).forEach((k) => {
            if(k.toLowerCase().includes('cookie')) {
              key = k;
            }
          })

          let fullCookies;
          let cookie = "";

          if(key != null) {
            fullCookies = res.headers[key];

            fullCookies.forEach((c) => {
              cookie += c.split(';')[0];
              cookie += ';';
            });

            console.log(cookie);
          }

          cookie = cookie.substring(0, cookie.length - 1);


          // concat cookies;
          console.log("Set cookies: " + fullCookies);
          console.log("Submitting with cookie string: " + cookie);

          // now submit the form
          let opts = {
            url: "https://hps.datacash.com/hps/?",
            method: 'POST',
            jar: newCookies,
            headers: {
              Referer: checkoutUrl,
              Cookie: cookie
            },
            form: {
              card_number: this.profile.card.number,
              exp_month: this.profile.card.expM,
              exp_year: this.profile.card.expY,
              cv2_number: this.profile.card.cvv,
              issue_number: "",
              action: "confirm",
              continue: "Place Order & Pay",
              HPS_SessionID: sessionID
            },
            resolveWithFullResponse: true,
            simple: false
          }

          request(opts)
          .then((res) => {
            if(res.statusCode === 302) {
              let cKey = Object.keys(res.headers).filter(h => h.toLowerCase().includes("location"))[0];
              let confirmation = res.headers[cKey];

              if(confirmation) {
                if(confirmation.includes("fail")) {
                  return reject("Payment processing failed.");
                } else if(confirmation.includes("timeout")) {
                  console.log("Request timed out for payment!");
                  // TODO: retry
                }

                return resolve("Checked out product! Confirmation url: " + confirmation);
              }
            }

            console.log("Headers:");
            console.log(res.headers);
            return resolve("POSSIBLE error. Code: " + res.statusCode);
          })
          .catch((err) => {
            return reject("Error submitting payment info: " + err);
          })
        })
        .catch((err) => {
          return reject("Error loading checkout page: " + err);
        });
      })
      .catch((err) => {
        return reject("Error making checkout request: " + err);
      });
    })
  }
}


module.exports.Runner = Runner;
