var vows = require('vows');
var assert = require('assert');
var simple = require('../lib/simpleserver.js');

var suite = vows.describe('SimpleServer testing');


function serverCreator() { return simple.createServer() }
function noop() {}

suite.addBatch({
  '#command' : {
    'a simple route': {
      topic : function () {
        var app = serverCreator();
        app.command('very simple', function () {});
        return app;
      },
      'can be added to the routing table' : function (app) {
        assert.equal(app.routes[0].route.source, '^very simple$');
      },
    },
    'a complicated route': {
      topic : function () {
        var app = serverCreator();
        app.command('ship the {thing} to the {place}', function () {});
        return app;
      },
      'gets converted to regex before going into routing table' : function (app) {
        assert.ok(app.routes[0].route.source, '^ship the (.+?) to the (.+?)$');
      },
    },
  },
});

suite.addBatch({
  '#alias' : {
    'a simple alias': {
      topic : function () {
        var app = serverCreator();
        app.command('very simple', noop);
        app.alias('radical')
        return app;
      },
      'can be added to the routing table' : function (app) {
        assert.equal(app.routes[1].route.source, '^radical$');
        assert.equal(app.routes[1].callback, noop);
      },
    },
    'a complicated alias': {
      topic : function () {
        var app = serverCreator();
        app.command('ship the {thing} to the {place}', noop);
        app.command('totally {thing} the {place}', noop)
        return app;
      },
      'gets converted to regex before going into routing table' : function (app) {
        assert.equal(app.routes[1].route.source, '^totally (.+?) the (.+?)$');
        assert.equal(app.routes[1].callback, noop);
      },
    },
  },
});

suite.addBatch({
  '#deroute': {
    topic : serverCreator,
    'derouting a simple route': {
      topic : function (app) {
        app.command('very simple', noop);
        return {app: app, callback: noop};
      },
      'deroutes to the correct method' : function (t) {
        var route = t.app.deroute('very simple');
        assert.isNotNull(route);
        assert.equal(route.method, t.callback);
      },
    },
    'a complicated route': {
      topic : function (app) {
        app.command('ship the {thing} to the {place}', noop);
        return {app: app, callback: noop};
      },
      'deroutes to the correct method' : function (t) {
        assert.equal(t.app.deroute('ship the forks to the plate').method, t.callback);
        assert.isNull(t.app.deroute('ship the forks'));
      },
    },
    'a regex route': {
      topic : function (app) {
        app.command('go (east|west|north|south)', noop);
        return {app: app, callback: noop};
      },
      'deroutes to the correct method' : function (t) {
        assert.equal(t.app.deroute('go east').method, t.callback);
        assert.equal(t.app.deroute('go west').method, t.callback);
        assert.equal(t.app.deroute('go north').method, t.callback);
        assert.equal(t.app.deroute('go south').method, t.callback);
        assert.isNull(t.app.deroute('go blurg'));
      },
    },
  },
});

suite.addBatch({
  '#_router': {
    topic : serverCreator,
    'a simple route': {
      topic : function (app) {
        var done = this.callback;
        app.command('go', function (client) {
          done.call(this, null, client);
        });
        app._router('i am a client', 'go');
      },
      'gets routed correctly' : function (client) {
        assert.equal(client, 'i am a client');
      },
    },
    'a complicated route': {
      topic : function (app) {
        var done = this.callback;
        app.command('sup {name}', function () {
          var args = [].slice.call(arguments);
          args.unshift(null);
          done.apply(this, args);
        });
        app._router('i am a client', 'SUP TIM');
      },
      'gets routed correctly' : function (err, client, name) {
        assert.equal(client, 'i am a client');
        assert.equal(name, 'TIM');
      },
    }
  }
});

suite.export(module);