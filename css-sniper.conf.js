const path = require('path')
const fs = require('fs')
const program = require('./cli')

let overwrites = {}

if (program.config) {
  overwrites = require(path.join(process.cwd(), program.config));
}
else if (process.cwd() !== __dirname && fs.existsSync(path.join(process.cwd(), 'css-sniper.conf.js'))) {
  overwrites = require(path.join(process.cwd(), 'css-sniper.conf.js'));
}

module.exports = {
  resolver: function(path) {
    return path;
  }
};

Object.assign(module.exports, overwrites);