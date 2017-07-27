const API = require('./api');

function start() {
  API.addToCart(API.Sites.footpatrol, 274768, 396198)
  .then((id) => {
    console.log(`Got a successful cart with ID: ${id}`);

    let r = new API.Runner(API.Sites.footpatrol, id);

    r.checkout()
    .then((response) => {
      console.log("Checkout response:");
      console.log(response);
    })
    .catch((err) => {
      console.log(err);
    })
  })
  .catch((err) => {
    console.log(err);
  });
}

start();
