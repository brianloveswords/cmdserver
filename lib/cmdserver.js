var util = require('util');
var net = require('net');
var optimist = require('optimist');
var colors = require('colors');
var readline = require('readline');
var EventEmitter = require('events').EventEmitter;
var Command = require('./command.js');

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

function CmdServer() {
  if (!(this instanceof CmdServer)) return new CmdServer();
  net.Server.call(this);
  this.commands = {};

  // initialize handlers
  this.on('listening', this.beginListening);
  this.on('connection', this.handleConnection);

  debug('pid', process.pid.toString().blue);
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
  var cmd, name;
  name = route.split(/ +/)[0]
  cmd = new Command(route);
  this.commands[name] = cmd;
  this.emit('added', cmd);
  return cmd;
};

/**
 * Match against a route and emit an event.
 */

CmdServer.prototype.execute = function (route) {
  var routes, cmd, argv, opts, passed, args;

  // See if it matches anything first of all.
  routes = Object.keys(this.commands).filter(function (name) {
    return route.indexOf(name) === 0;
  });

  // #TODO: these need to be higher fidelity. it shouldn't just throw an
  // error, it should give some help as to what's happening.
  if (!routes.length)
    return this.emit('error', new Error('no matches'));
  if (routes.length > 1)
    return this.emit('error', new Error('more than one match'));

  // Get the command from the command table and set the name.
  cmd = this.commands[routes[0]];

  // Reduce over `cmd.options` to create an options object that contains
  // the values deduced by `optimist` or the default option values.
  argv = optimist(route.split(/ +/)).argv;
  opts = cmd.options.reduce(function (aggr, opt) {
    var longname = opt.long.replace(/\-/g, '');
    var shortname = opt.short.replace(/\-/g, '');
    aggr[longname] =
      argv[longname] !== undefined ?  argv[longname] :
      argv[shortname] !== undefined ? argv[shortname] :
      opt.default;
    return aggr;
  }, {});

  // Slice the name of the command off the remaining arguments to get the
  // passed in args then map the expected arguments to values in order.
  passed = argv['_'].slice(1);
  args = cmd.args.map(function (arg, idx) {
    return passed[idx];
  });

  // Set up an arguments array to `apply` to `this.emit`. Make sure to shove
  // the event type to the front of the array.
  args.push(opts, route);
  args.unshift(cmd.name);
  this.emit.apply(this, args);
};


function pad(str, width) {
  var len = Math.max(0, width - str.length);
  return str + Array(len + 2).join(' ');
}

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
    str += cmd.route.bold;
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
      str += [' ', pad(opt.flags, width), opt.description, '\n'].join(' ');
      return str;
    }, str);

    helpfor[name] = str;
    return helpfor
  }.bind(this), {});

  if (!command)
    return Object.keys(helps).map(function (k) { return helps[k] }).join('\n\n');

  cmd = helps[command];
  if (!cmd) return util.format('`%s` not a recognized command\n\n%s', command.bold, this.help());

  return cmd;
}

/**
 * Start up that repl, kid!
 */

CmdServer.prototype.startRepl = function () {
  if (this.repl) return;

  var rl, prefix, client, router;
  var startRepl = this.startRepl.bind(this);

  this.repl = rl;

  rl = readline.createInterface(process.stdin, process.stdout, null);
  prefix = ('server'.grey + '> '.green);
  client = {
    send: debug,
    write: debug
  };
  router = this._router.bind(this);

  rl.setPrompt(prefix, 'server'.length + 2);
  rl.prompt();
  rl.on('line', function (line) {
    if (line) router(client, line);
    rl.prompt();
  });

  rl.on('close', function () {
    debug('stopping repl');
    process.stdin.destroy();
    this.repl = null;
  }.bind(this));
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
  // normalize
  command = message.toString().trim();
  route = this.deroute(command);
  debug('recieved command:', command.bold);

  if (!route) {
    if (!client) return;
    outgoing = sprintf('command `%s` not recognized', command);
    return client.write(outgoing);
  }

  route.message = command;
  route.args.unshift(client);
  route.method.apply(route, route.args);
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
    else output.push(inspect(arg));
  });
  this.write(output.join(' '));
}

CmdServer.prototype.handleConnection = function (client) {
  debug('client connected');

  client.send = clientSend;

  // handle client events
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

module.exports = {
  createServer: function createServer() {
    return new CmdServer();
  }
};
