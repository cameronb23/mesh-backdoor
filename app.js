const API = require('./api');

function start() {
  // add mars yard 2.0 sz 8.5 UK to cart :)
  API.addToCart(sites.jdsports, 283271, 715251)
  .then((id) => {
    console.log(`Got a successful cart with ID: ${id}`);
  })
  .catch((err) => {
    console.log("Error adding to cart: ", err);
  });
}

start();
