var util = require('util');
var cmd = require('./lib/cmdserver.js');
var app = cmd.createServer(process.argv);

var stacks = {
  vegetables: [],
  meats: []
};

app.command('pi')
  .describe('get dem numbas of pi')

  .command('add <thing> <stack>')
  .describe('add a thing to a specific stack')
  .option('method [push|unshift]', 'method for adding. Defaults to `push`', 'push')

  .command('items <stack>')
  .describe('show the contents of a specific stack')

  .command('list-stacks')
  .describe('show all of the stacks')

  .command('new <stack>')
  .describe('make a brand new stack, hhyyeaaaaa')

app.on('pi', function (client) {
  client.send(Math.PI);
});

app.on('add', function (client, thing, stack, opts) {
  if (!stacks[stack])
    return client.send(util.format('don\'t know about `%s`', stack));
  stacks[stack].push(thing);
  client.send(util.format('added `%s` to `%s`', thing, stack));
});

app.on('items', function (client, stack) {
  var display = util.inspect(stacks[stack], undefined, undefined, true);
  client.send(display);
});

app.on('list-stacks', function (client, stack) {
  var display = util.inspect(Object.keys(stacks), undefined, undefined, true);
  client.send(display);
});

app.on('new', function (client, name) {
  stacks[name] = [];
  client.send(util.format('adding new stack `%s`', name));
});


app.begin();


//app.listen(process.argv[2] || 0);
