var util = require('util');
var simple = require('./lib/simpleserver.js');
var app = simple.createServer();

var stacks = {
  vegetables: [],
  meats: []
};

app.command('pi', function (client) {
  client.send(Math.PI);
});

app.command('add {thing} to {stack}( first)?', function (client, thing, stack) {
  if (!stacks[stack])
    return client.send(util.format('don\'t know about `%s`', stack));

  stacks[stack].push(thing);
  client.send(util.format('added `%s` to `%s`', thing, stack));
});

app.command('show {stack}', function (client, stack) {
  var display = util.inspect(stacks[stack], undefined, undefined, true);
  client.send(display);
});

app.command('show stacks', function (client) {
  var display = util.inspect(Object.keys(stacks), undefined, undefined, true);
  client.send(display);
});

app.command('new stack {name}', function (client, name) {
  stacks[name] = [];
  client.send(util.format('adding new stack `%s`', name));
});

app.command('bye', function (client) {
  client.send('later');
  client.destroy();
}).alias(['later', 'see-ya', 'peace']);



app.listen(process.argv[2] || 0);
app.startRepl();