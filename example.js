var util = require('util');
var app = require('cmdserver')(process.argv);

var stacks = {
  vegetables: [],
  meats: []
};

app.command('add <thing> <stack>')
  .describe('add a thing to a specific stack')
  .option('method [push|unshift]', 'method for adding. Defaults to `push`', 'push')
  .execute(function (client, thing, stack, opts) {
    if (!stacks[stack])
      return client.send(util.format('don\'t know about `%s`', stack));
    stacks[stack][opts.method](thing);
    client.send(util.format('%sed `%s` to `%s`', opts.method, thing, stack));
  })

app.command('show <stack>')
  .describe('show the contents of a specific stack')
  .execute(function (client, stack) {
    var display = util.inspect(stacks[stack], undefined, undefined, true);
    client.send(display);
  });

app.command('list stacks')
  .describe('show all of the stacks')
  .execute(function (client, stack) {
    var display = util.inspect(Object.keys(stacks), undefined, undefined, true);
    client.send(display);
  });

app.command('new <stack>')
  .describe('make a brand new stack, hhyyeaaaaa')
  .execute(function (client, name) {
    stacks[name] = [];
    client.send(util.format('adding new stack `%s`', name));
  });

app.begin();
