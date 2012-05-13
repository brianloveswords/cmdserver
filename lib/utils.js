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
  return str + Array(len + 2).join(' ');
}


function parseOpts(route) {
  var opts = {}, remainder = [];
  route = route.replace(/ += +/g, '=');

  route = route.replace(/([0-9a-z_\-]+)=([^"'\s]+|".*?"|'.*?')/g, function (_, name, value) {
    value = value.replace(/'|"/g, '').trim();

    if (value.match(/^(true|false)$/))
      value = value === 'true' ? true : false

    else if (value.match(/^(\d+(\.\d+)?)$/))
      value = parseInt(value, 10)

    opts[name] = value;
    return '';
  });

  route.replace(/([^"'\s]+|".*?"|'.*?')/g, function (_, value) {
    value = value.replace(/'|"/g, '').trim();
    remainder.push(value);
  });

  opts['_'] = remainder;
  return opts;
}

module.exports = { pad: pad, parseOpts: parseOpts };