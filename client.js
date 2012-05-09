var net = require('net');
var readline = require('readline');
var client = new net.Socket();
var util = require('util');
var colors = require('colors');

var log = console.log;

function connectToServer(arg) {  
  if (!arg) {
    log('error'.red, 'you must supply a path, port or host:port');
    process.exit();
  }
  if (arg.match(/:/)) {
    var parts = arg.split(':');
    var host = parts[0];
    var port = parts[1];
    log('host'.yellow, host);
    log('port'.yellow, port);
    client.socketName = arg;
    return client.connect(port, host);
  }
  if (/^\d+$/.test(arg)) {
    var port = arg;
    log('port'.yellow, port);
    client.socketName = 'localhost:' + port;
    return client.connect(port);
  }
  var file = arg;
  log('file'.yellow, file);
  client.socketName = file;
  return client.connect(arg);
}

client.on('connect', function () {
  var socket = client.socketName;
  var rl = readline.createInterface(process.stdin, process.stdout, null);
  var prefix = (socket.grey + ' < '.green);
  
  rl.setPrompt(prefix, socket.length + 3);
  rl.prompt();
  
  rl.on('line', function (line) {
    if (line) client.write(line); 
    else rl.prompt();
  });
  
  client.on('data', function (response) {
    var prompt = socket.grey + ' >'.magenta;
    console.log(prompt, response.toString());
    rl.prompt()
  });
  
  var SOCKET_CLOSING = false;
  function closeSocket() {
    if (SOCKET_CLOSING) return;
    SOCKET_CLOSING = true;
    console.log('disconnected');
    client.end();
    process.stdin.destroy();
  }
  
  rl.on('close', closeSocket);
  client.on('close', closeSocket);
});

client.on('error', function (err) {
  if (err.code === 'ECONNREFUSED')
    console.log('error'.red.bold, 'could not connect to', socket.bold, '[recieved ECONNREFUSED]'.grey);
});

var socket = process.argv[2];
connectToServer(socket);
