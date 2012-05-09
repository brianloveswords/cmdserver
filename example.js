var simple = require('./simpleserver.js');
var app = simple.createServer();

var stacks = {
  vegetables: [],
  meats: []
};

app.command('pi', function (client) {
  client.send(Math.PI);
});

app.command('add {thing} to {stack}', function (client, thing, stack, matches) {
  console.dir(thing);
  console.dir(stack);
  client.send('added thing to stack');
});

app.command('ham', function (client) {
  client.send('is gross');
}).alias('pig')
  .alias('pork');

app.command('bye', function (client) {
  client.send('later gator');
  client.destroy();
}).alias(['later', 'see-ya', 'peace']);



app.listen(process.argv[2] || 0);