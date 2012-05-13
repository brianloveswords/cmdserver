var path = require('path');
var util = require('util');
var utils = require('./utils.js');
var net = require('net');
var optimist = require('optimist');
var colors = require('colors');
var readline = require('readline');
var EventEmitter = require('events').EventEmitter;
var Command = require('./command.js');
var client = require('./client.js');


// lazy way to get an uppercase array of all the unix signals.
var SIGNALS = ('sigabrt sigalrm sigbus sigchld sigcont sigfpe sighup '
              + 'sigill sigint sigkill sigpipe sigquit sigsegv sigstop '
              + 'sigtstp sigttin sigttou sigusr1 sigusr2 sigpoll sigprof '
              + 'sigsys sigtrap sigurg sigvtalrm sigxcpu sigxfsz')
  .toUpperCase()
  .split(' ');

// not exactly the same, but close enough for our purposes.
var sprintf = util.format;
function getClass(o) { return Object.prototype.toString.call(o) }

/**
 * Print a debug statement to the console. n-arity.
 *
 * @param {String} args... a bunch of strings to print out.
 */

function debug() {
  if (process.env['NODE_ENV'] === 'test') return;
  var args = [].slice.call(arguments);
  args.unshift('debug'.grey);
  console.log.apply(console, args);
}

/**
 * Alias for colored inspector.
 *
 * Regular signature is `util.inspect(object, [showHidden], [depth], [colors])`
 * but we just want to pass `colors` so we throw some undefineds at the others.
 *
 * @param {Any} thing to inspect
 */

function inspect(thing) {
  return util.inspect(thing, undefined, undefined, true);
}

/**
 * @constructor
 * @extends {net.Server}
 */

function CmdServer(argv) {
  if (!(this instanceof CmdServer)) return new CmdServer(argv);
  argv = argv || [];
  net.Server.call(this);
  this.commands = {};
  if (argv) this.argv = optimist(argv).argv

  // initialize handlers
  this.on('listening', this.beginListening);
  this.on('connection', this.handleConnection);
}
util.inherits(CmdServer, net.Server);

/**
 * Add a new responder. Also tries to add a signal handler.
 *
 * @param {String} route
 * @return this
 * @see `CmdServer#signal`
 */

CmdServer.prototype.command = function (route) {
  // route might have an <nonFlagOption>
  var cmd, name, match;

  if ((match = route.match(/ [\]<]/)))
    name = route.slice(0, match.index);
  else name = route;

  cmd = new Command(route);
  this.commands[name] = cmd;
  this.emit('added', cmd);
  cmd.command = this.command.bind(this);
  cmd.parent = this;
  return cmd;
};


/**
 * Method to run when a command is missing. This is a placeholder so the user
 * can override this method with their own.
 *
 * @param {Object} client (see below)
 * @param {String} command the command that the user tried to run
 * @see CmdServer#execute
 */

CmdServer.prototype.missing = function (client, command) {
  client.send(util.format('Could not find command %s. Type %s if you don\'t know what to do.', command.red.bold, 'help'.bold));
};

/**
 * Match against a route and emit an event.
 *
 * @param {String} route the input from the user
 * @param {Object} client some sort of client (could be stdout or a net client)
 */

CmdServer.prototype.execute = function (route, client) {
  var routes, cmd, argv, opts, passed, args, name;
  client = client || { send: console.log, write: console.log };
  if (route.indexOf('help') === 0) {
    return client.send(this.help(route.replace(/help */, '')));
  }

  // See if it matches anything first of all.
  routes = Object.keys(this.commands).filter(function (name) {
    return route === name || route.match(RegExp(name + ' '));
  });

  name = routes[0];
  if (!routes.length)
    return this.missing(client, route);

  // Get the command from the command table and set the name.
  cmd = this.commands[name];

  argv = utils.parseOpts(route.replace(name, '').trim());
  opts = cmd.options.reduce(function (aggr, opt) {
    var longname = opt.long.replace(/\-/g, '');
    aggr[longname] =
      argv[longname] !== undefined ?  argv[longname] :
      opt.default;
    return aggr;
  }, {});

  passed = argv['_'];
  args = cmd.args.map(function (_, idx) {
    return passed[idx];
  });

  // Set up an arguments array to `apply` to `this.emit`. Make sure to shove
  // the event type to the front of the array.
  args.push(opts, route);
  args.unshift(client);
  args.unshift(cmd.name);

  this.emit.apply(this, args);
};


/**
 * Give help for either a command or the whole app.
 *
 * @param {String} command (optional) name of a command
 * @return {String} help string.
 */

CmdServer.prototype.help = function (command) {
  var cmd, actions, helps;
  helps = Object.keys(this.commands).reduce(function (helpfor, name) {
    var cmd, desc, width, str = '';

    cmd = this.commands[name];
    desc = cmd.description();

    // Add the command name and, if it exists, the description.
    str += cmd.route.cyan.bold;
    if (desc) str += ': ' + desc;
    str += '\n';

    // Figure out the maximum length of the flag strings
    width = cmd.options.reduce(function (max, opt) {
      var len = opt.flags.length;
      if (len > max) return len
      return max;
    }, 0)

    // Concatenate the flags and the descriptions to the string.
    str = cmd.options.reduce(function (str, opt) {
      str += [' ', utils.pad(opt.flags, width), opt.description, '\n'].join(' ');
      return str;
    }, str);

    helpfor[name] = str;
    return helpfor
  }.bind(this), {});

  // Return helpstring for the entire set if no specific command is passed
  if (!command)
    return Object.keys(helps).map(function (k) { return helps[k] }).join('');

  cmd = helps[command];
  if (!cmd) return util.format('`%s` not a recognized command\n\n%s', command.bold, this.help());

  return cmd;
}

/**
 * Begin the app. This could mean one of a few things:
 *
 *   - argv contains socket:
 *     - socket is closed -> start listening on that socket.
 *     - socket is open -> start a client on that socket.
 *
 *   - called without any arguments
 *     - start a repl
 *
 *   - argv contains a command
 *     - socket -> connect to socket, execute, immediately close connection
 *     - no socket -> execute command, fall into repl.
 *
 * @param {Array} argv an array like that returned by process.argv
 */

CmdServer.prototype.begin = function (argv) {
  var socket, route;

  if (argv) this.argv = optimist(argv).argv;
  argv = this.argv;

  socket = argv['S'] || argv['socket'];
  route = argv['_'].slice(2).join('');

  if (!socket)
    return this.startRepl(route);

  // Fail if there's a route involved, that implies the user wants to
  // connect to a socket and perform a command.
  client.error = function (err) {
    if (route)
      return console.error(util.format('Can\'t connect to socket `%s`', socket.green));
    this.listen(socket);
  }.bind(this);

  if (route) {
    client.silent = true;
    client.once('connect', function () {
      client.write(route + '\n');
      client.end();
    });
  };

  client.attach(socket);
}

/**
 * Start a repl interface
 *
 * @param {String} command if passed, will execute `command` immediately
 */

CmdServer.prototype.startRepl = function (command) {
  var rl, prefix, client, router, name, execute;
  if (this.repl) return;
  rl = readline.createInterface(process.stdin, process.stdout, null);
  name = (path.basename(process.argv[1]))
  prefix = (name.grey + '> '.green);
  client = { send: debug, write: debug };

  execute = function (line) {
    if (line) this.execute(line, client);
    rl.prompt();
  }.bind(this);

  if (command) execute(command);

  rl.setPrompt(prefix, name.length + 2);
  rl.prompt();
  rl.on('line', execute);
  rl.on('close', function () {
    console.log('\n');
    debug('stopping repl');
    process.stdin.destroy();
    this.repl = null;
  }.bind(this));
  this.repl = rl;
};

/**
 * Command dispatcher. Routes command from client to the appropriate action.
 *
 * @private
 * @param {Object} client
 * @param {String} message from the client
 */

CmdServer.prototype._router = function (client, message) {
  var route, command, outgoing, context;
  command = message.toString().trim();
  this.execute(command, client);
};

/** @private */
CmdServer.prototype.createRouter = function (client) {
  return this._router.bind(this, client);
};

/** @private */
function clientSend() {
  var output = [];
  [].slice.call(arguments).forEach(function (arg) {
    if (getClass(arg) == '[object String]') output.push(arg);
    else if ((arg + '') == arg) output.push(arg.toString());
    else output.push(inspect(arg));
  });
  this.write(output.join(' '));
}

CmdServer.prototype.handleConnection = function (client) {
  debug('client connected');
  client.send = clientSend;
  client.on('end', this.clientDisconnect);
  client.on('data', this.createRouter(client));
};

/** @private */
CmdServer.prototype.beginListening = function () {

  debug('listening:', inspect(this.address()));

  process.on('SIGTERM', function () {
    debug('received', 'SIGTERM'.cyan, 'shutting down.');
    this.close();
  }.bind(this));
};
/** @private */
CmdServer.prototype.clientDisconnect = function () {
  debug('client disconnecting');
};

function createServer(argv) {
  return new CmdServer(argv);
}

createServer.createServer = createServer;
module.exports = createServer;
