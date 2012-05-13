# cmdserver (v0.0.1)
**client/server command line apps made easy**

## Install
```
npm install cmdserver
```

## API example

```js
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
```
## client/server model

You can start a server by doing this:

```
± node example.js -S /tmp/food.socket    
file /tmp/food.socket
debug listening: '/tmp/food.socket'
```

Then, in another terminal session, you can connect to the server by running
the same command:

```
± node example.js -S /tmp/food.socket
file /tmp/food.socket
/tmp/food.socket < help
/tmp/food.socket > 
add <thing> <stack>: add a thing to a specific stack
  method [push|unshift]  method for adding. Defaults to `push` 
show <stack>: show the contents of a specific stack
list stacks: show all of the stacks
new <stack>: make a brand new stack, hhyyeaaaaa

/tmp/food.socket < add beef meats
/tmp/food.socket > pushed `beef` to `meats`
/tmp/food.socket < add 'cold cuts' meats
/tmp/food.socket > pushed `cold cuts` to `meats`
/tmp/food.socket < add 'pork shoulder' meats method=unshift
/tmp/food.socket > unshifted `pork shoulder` to `meats`
/tmp/food.socket < new 'seafood'
/tmp/food.socket > adding new stack `seafood`
```

You can have as many clients open as you want, go nuts:

```
# in yet another terminal session

± node example.js -S /tmp/food.socket
file /tmp/food.socket
/tmp/food.socket < list stacks
/tmp/food.socket > [ 'vegetables',
  'meats',
  'seafood' ]
/tmp/food.socket < show meats
/tmp/food.socket > [ 'pork shoulder',
  'beef',
  'cold cuts' ]

# you can also perform one-off commands
± node example.js -S /tmp/food.socket "list stacks"
[ 'vegetables',
  'meats',
  'seafood' ]
```

## Using as a REPL

If you don't pass any arguments, it will drop you into a REPL

```
± node example.js                                  
example.js> help
debug 
add <thing> <stack>: add a thing to a specific stack
  method [push|unshift]  method for adding. Defaults to `push` 
show <stack>: show the contents of a specific stack
list stacks: show all of the stacks
new <stack>: make a brand new stack, hhyyeaaaaa

example.js> help list stacks
debug 
list stacks: show all of the stacks
example.js> 
```

## TODO
* add port, host:port connection options
* add more tests, geez!
