var assert = require('assert');
var cmdserver = require('../lib/cmdserver.js');
var should = require('should');

describe('commanding', function () {
  var cmd = cmdserver.createServer();

  cmd.command('launch <filename>')
    .describe('launches the server like a champ')
    .option('-p, --port [n]', 'Port to launch on', '0')
    .option('-w, --watch', 'Watch directory for changes', false)
    .option('-r, --restart', 'Restart server if it crashes', true)


  it('should route with short names', function (done) {
    cmd.once('launch', function (filename, options) {
      should.exist(options.port);
      options.port.should.equal(80);
      options.restart.should.equal(false);
      filename.should.equal('testfile.js');
      done();
    });
    cmd.execute('launch testfile.js -p 80 --no-restart')
  });


  it('should route with short names', function (done) {
    cmd.once('launch', function (filename, options) {
      should.exist(options.port);
      options.watch.should.equal(true);
      options.restart.should.equal(true);
      should.not.exist(filename);
      done();
    });
    cmd.execute('launch -p 999999999 --watch')
  });

  it('should be able to spit out help', function () {
    cmd.help().should.match(/launches the server like a champ/)
    cmd.help('launch').should.match(/launches the server like a champ/);
    cmd.help('missing').should.match(/not a recognized command/)
  });

});