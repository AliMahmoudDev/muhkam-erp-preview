'use strict';

exports.quote = function quote(xs) {
  return xs.map(function (s) {
    if (s && typeof s === 'object') {
      return s.op.replace(/(.)/g, '\\$1');
    }
    if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
      s = "'" + s.replace(/'/g, "'\\''") + "'";
      s = s.replace(/^(?:'')+/g, '').replace(/\\'''/g, "\\'");
    }
    return s;
  }).join(' ');
};

exports.parse = function parse(s, env, opts) {
  var chunky = /(['"])((\\.|[^\\])*?)\1|(\\ |\S)+/g;
  var match;
  var tokens = [];
  while ((match = chunky.exec(s)) !== null) {
    var token = match[0];
    if (match[1]) {
      token = match[2];
      if (match[1] === '"') token = token.replace(/\\(.)/g, '$1');
    } else {
      token = token.replace(/\\ /g, ' ');
    }
    tokens.push(token);
  }
  return tokens;
};
