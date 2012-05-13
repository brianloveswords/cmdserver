var assert = require('assert');
var cmdserver = require('../lib/cmdserver.js');
var should = require('should');

describe('commanding', function () {
  var cmd = cmdserver.createServer();

  cmd.command('launch <filename> [name]')
    .describe('launches the server like a champ. Optionally give it a short name.')
    .option('port [n]', 'Port to launch on', '0')
    .option('watch [true|false]', 'Watch directory for changes', false)
    .option('restart [true|false]', 'Restart server if it crashes', true)


  it('should route with short names', function (done) {
    cmd.once('launch', function (client, filename, name, options) {
      should.exist(options.port);
      options.port.should.equal(80);
      options.restart.should.equal(false);
      filename.should.equal('testfile.js');
      name.should.equal('test lol');
      done();
    });
    cmd.execute('launch "testfile.js" \'test lol\' port="80" restart="false"')
  });


  it('should should not pass in args if they do not exist', function (done) {
    cmd.once('launch', function (client, filename, name, options) {
      should.exist(options.port);
      options.port.should.equal(999999999);
      options.watch.should.equal(false);
      options.restart.should.equal(true);
      should.not.exist(filename);
      done();
    });
    cmd.execute('launch port = "999999999" watch = "false"')
  });

  it('should be able to spit out help', function () {
    console.log(cmd.help());

    cmd.help().should.match(/launches the server like a champ/)
    cmd.help('launch').should.match(/launches the server like a champ/);
    cmd.help('missing').should.match(/not a recognized command/)
  });


});