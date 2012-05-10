var util = require('util');
var net = require('net');
var colors = require('colors');
var readline = require('readline');

// lazy way to get an uppercase array of all the unix signals.
var SIGNALS = ('sigabrt sigalrm sigbus sigchld sigcont sigfpe sighup '
              + 'sigill sigint sigkill sigpipe sigquit sigsegv sigstop '
              + 'sigtstp sigttin sigttou sigusr1 sigusr2 sigpoll sigprof '
              + 'sigsys sigtrap sigurg sigvtalrm sigxcpu sigxfsz')
  .toUpperCase()
  .split(' ');

// not exactly the same, but close enough for our purposes.
var sprintf = util.format;

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

function SimpleServer() {
  if (!(this instanceof SimpleServer)) return new SimpleServer();
  net.Server.call(this);
  this.routes = [];

  // initialize handlers
  this.on('listening', this.beginListening);
  this.on('connection', this.handleConnection);

  debug('pid', process.pid.toString().blue);
}
util.inherits(SimpleServer, net.Server);

/**
 * Add a new responder. Also tries to add a signal handler.
 *
 * @param {String} route
 * @param {Function} callback action to take.
 * @return this
 * @see `SimpleServer#signal`
 */

SimpleServer.prototype.command = function (route, callback) {
  function prepareRoute(route) {
    // convert to capturing regex
    return RegExp('^' + route.replace(/\{\w+\}/g, '(.+?)') + '$', 'i');
  }
  function extractParams(route, params) {
    params = params || [];
    var newRoute = route.replace(/\{(\w+)\}/, function (_, param) {
      params.push(param);
      return '';
    });
    if (newRoute === route) return params;
    return extractParams(newRoute, params);
  }

  var routeData = {
    route: prepareRoute(route),
    params: extractParams(route),
    callback: callback
  };

  debug('adding route', route.magenta);
  this.lastAddedRoute = callback;
  this.routes.push(routeData);
  this.signal(route, callback);
  return this;
};

/**
 * Add an alias for a command. Delegates to `SimpleServer#command`.
 *
 * @param {String|Array} alias
 * @return this
 * @see `SimpleServer#command`
 * @see `SimpleServer#signal`
 */

SimpleServer.prototype.alias = function (alias) {
  var createAlias, routeData, endpoint;

  if (util.isArray(alias)) {
    createAlias = this.alias.bind(this);
    alias.map(function (a) { createAlias(a, endpoint); });
    return this;
  }

  endpoint = this.lastAddedRoute;
  this.command(alias, endpoint);
  this.signal(alias, endpoint);
  return this;
};

/**
 * Add a signal handler. Does nothing if the signal isn't found in the
 * `SIGNALS` array.
 *
 * @param {String} signal name of the signal
 * @param {Function} callback action to take.
 */

SimpleServer.prototype.signal = function (signal, callback) {
  signal = signal.toUpperCase();
  if (!~SIGNALS.indexOf(signal)) return;
  debug('adding signal handler', signal.cyan);
  process.on(signal, function () {
    var res = { send: console.log, write: console.log };
    callback(res);
  });
};

/**
 * Deroute an input. Pulls out arguments, gets matching handler.
 *
 * @param {String} input
 * @return {Null|Object}
 */

SimpleServer.prototype.deroute = function (input) {
  var route, match, current, idx, args, params;
  idx = this.routes.length;

  while (!match && idx--) {
    current = this.routes[idx];
    match = current.route.exec(input);
  }

  if (!match) return null;

  args = [].slice.call(match, 1);
  for (idx = 0, params = {}; args[idx]; idx++) {
    params[current.params[idx]] = args[idx];
  }

  return {
    method: current.callback,
    match: match,
    args: args,
    params: params
  };
};

/**
 * Start up that repl, kid!
 */

SimpleServer.prototype.startRepl = function () {
  var rl, prefix, client, router;

  rl = readline.createInterface(process.stdin, process.stdout, null);
  prefix = ('server'.grey + '> '.green);
  client = {
    send: console.log,
    write: console.log
  }
  router = this._router.bind(this);

  rl.setPrompt(prefix, 'server'.length + 2);
  rl.prompt();
  rl.on('line', function (line) {
    if (line) router(client, line);
    else rl.prompt();
  });

  rl.on('close', function () {
    debug('stopping repl');
    process.stdin.pause();
  });
};


/**
 * Command dispatcher. Routes command from client to the appropriate action.
 *
 * @private
 * @param {Object} client
 * @param {String} message from the client
 */

SimpleServer.prototype._router = function (client, message) {
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
SimpleServer.prototype.createRouter = function (client) {
  return this._router.bind(this, client);
};

/** @private */
SimpleServer.prototype.handleConnection = function (client) {
  debug('client connected:', inspect(client));
  client.send = function (o) { client.write(o.toString()) };

  // handle client events
  client.on('end', this.clientDisconnect);
  client.on('data', this.createRouter(client));
};

/** @private */
SimpleServer.prototype.beginListening = function () {
  debug('listening:', inspect(this.address()));

  process.on('SIGTERM', function () {
    debug('received', 'SIGTERM'.cyan, 'shutting down.');
    this.close();
  }.bind(this));
};
/** @private */
SimpleServer.prototype.clientDisconnect = function () {
  debug('client disconnecting');
};

module.exports = {
  createServer: function createServer() {
    return new SimpleServer();
  }
};
