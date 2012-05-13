var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Initialize a new `Option` with the given `flags` and `description`.
 *
 * @param {String} flags
 * @param {String} description
 * @api public
 */

function Option(flags, description) {
  this.flags = flags;
  this.required = ~flags.indexOf('<');
  this.optional = ~flags.indexOf('[');
  this.bool = !~flags.indexOf('-no-');
  flags = flags.split(/[ ,|]+/);
  if (flags.length > 1 && !/^[[<]/.test(flags[1])) this.short = flags.shift();
  this.long = flags.shift();
  this.description = description;
}

/**
 * Return option name.
 *
 * @return {String}
 * @api private
 */

Option.prototype.name = function () {
  return this.long
    .replace('--', '')
    .replace('no-', '');
};

/**
 * Check if `arg` matches the short or long flag.
 *
 * @param {String} arg
 * @return {Boolean}
 * @api private
 */

Option.prototype.is = function (arg) {
  return arg == this.short
    || arg == this.long;
};

function Command(name) {
  var args = name.split(/ +/);
  this.args = [];
  this.options = [];
  this.parseExpectedArgs(args);
  this.route = name;
  this.name = args[0];
}
util.inherits(Command, EventEmitter);



/**
 * Parse expected `args`.
 *
 * For example `["[type]"]` becomes `[{ required: false, name: 'type' }]`.
 *
 * @param {Array} args
 * @return {Command} for chaining
 * @api public
 */

Command.prototype.parseExpectedArgs = function (args) {
  if (!args.length) return;
  args.forEach(function (arg) {
    switch (arg[0]) {
    case '<':
      this.args.push({ required: true, name: arg.slice(1, -1) });
      break;
    case '[':
      this.args.push({ required: false, name: arg.slice(1, -1) });
      break;
    }
  }.bind(this));
  return this;
};

Command.prototype.option = function (flags, description, fn, defaultValue) {
  var self = this;
  var option = new Option(flags, description);
  var oname = option.name();
  var name = camelcase(oname);

  // default as 3rd arg
  if ('function' != typeof fn) {
    defaultValue = fn;
    fn = null;
  }

  // preassign default value only for --no-*, [optional], or <required>
  if (defaultValue !== undefined || false == option.bool || option.optional || option.required) {
    // when --no-* we make sure default is true
    if (false == option.bool) defaultValue = true;
    // preassign only if we have a default
    if (undefined !== defaultValue) option.default = defaultValue;
  }

  // register the option
  this.options.push(option);

  // when it's passed assign the value
  // and conditionally invoke the callback
  this.on(oname, function (val) {
    // coercion
    if (null != val && fn) val = fn(val);

    // unassigned or bool
    if ('boolean' == typeof self[name] || 'undefined' == typeof self[name]) {
      // if no value, bool true, and we have a default, then use it!
      if (null == val) {
        self[name] = option.bool
          ? defaultValue || true
          : false;
      } else {
        self[name] = val;
      }
    } else if (null !== val) {
      // reassign
      self[name] = val;
    }
  });

  return this;
};

/**
 * Set the description `str`.
 *
 * @param {String} str
 * @return {String|Command}
 * @api public
 */

Command.prototype.description = function (str) {
  if (0 == arguments.length) return this._description;
  this._description = str;
  return this;
};

Command.prototype.describe = Command.prototype.description;


/**
 * Camel-case the given `flag`
 *
 * @param {String} flag
 * @return {String}
 * @api private
 */

function camelcase(flag) {
  return flag.split('-').reduce(function (str, word) {
    return str + word[0].toUpperCase() + word.slice(1);
  });
}

/**
 * Parse a boolean `str`.
 *
 * @param {String} str
 * @return {Boolean}
 * @api private
 */

function parseBool(str) {
  return /^y|yes|ok|true$/i.test(str);
}

/**
 * Pad `str` to `width`.
 *
 * @param {String} str
 * @param {Number} width
 * @return {String}
 * @api private
 */

function pad(str, width) {
  var len = Math.max(0, width - str.length);
  return str + Array(len + 1).join(' ');
}

module.exports = Command;