var util = require('util');
var net = require('net');
var colors = require('colors');

// lazy way to get an uppercase array of all the unix signals.
var SIGNALS = ( 'sigabrt sigalrm sigbus sigchld sigcont sigfpe sighup '
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
  this.routes = { };

  // initialize handlers
  this.on('listening', this.beginListening);
  this.on('connection', this.handleConnection);

  debug('pid', process.pid.toString().blue);
};
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
  debug('adding route', name.magenta);
  this.lastAddedRoute = route;
  this.routes[route] = callback;
  this.signal(route, callback);
  return this;
};

/**
 * Deroute an input. Pulls out arguments, gets matching handler.
 *
 * @param {String} input
 * @return {Null|Function}
 */

SimpleServer.prototype.deroute = function (input) {

};

/**
 * Add an alias for a command.
 *
 * @param {String|Array} alias
 * @param {String} endpoint (optional) defaults to the last defined command
 * @return this
 * @see `SimpleServer#signal`
 */

SimpleServer.prototype.alias = function (alias, endpoint) {
  if (util.isArray(alias)) {
    var createAlias = this.alias.bind(this);
    alias.map(function (a) { createAlias(a, endpoint); });
    return this;
  }
  if (!endpoint) endpoint = this.lastAddedRoute;
  debug('adding alias', alias.yellow, '->', endpoint.magenta);
  this.routes[alias] = this.routes[endpoint];
  this.signal(alias, this.routes[endpoint]);
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

/** @private */
SimpleServer.prototype.createRouter = function (client) {
  /**
   * Command dispatcher. Routes command from client to the appropriate action.
   *
   * @param {String} command from the client
   */
  return function router (command) {
    // normalize
    command = command.toString().toLowerCase().trim();
    var route = this.routes[command];
    debug('recieved command:', command.bold);

    if (!route)
      return client.write(sprintf('command `%s` not recognized', command));

    route.call(this, client);
  }.bind(this);
};
/** @private */
SimpleServer.prototype.handleConnection = function (client) {
  debug('client connected:', inspect(client));
  client.send = function (o) { client.write(o.toString()) }

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
}
