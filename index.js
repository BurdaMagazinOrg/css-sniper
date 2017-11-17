#!/usr/bin/env node

const path = require('path');
const sass = require('node-sass');
// const glob = require('glob');
const { execSync } = require('child_process');
const { sniperImporter, sniperConfigure } = require('./importer');

const program = require('commander');

program
  .version(require('./package.json').version)
  .usage('[options] <file ...>')
  .option('--origin [value]', 'Path for origin files')
  .option('--include-path <value>', 'Paths to look for imported files ', val => val.split(','), [])
  .parse(process.argv)

program.origin = program.origin || execSync('drush eval "echo DRUPAL_ROOT . \'/\'. drupal_get_path(\'theme\', \'seven\');"');

program.includePath = program.includePath || ['sass-includes'];
let includePaths = program.includePath.map(include => path.resolve(process.cwd()+'/'+include));
let file = program.args[0] || 'sass/base/elements.scss';

function fileRenderer(file) {
  'use strict';

  sass.render({
    file: file,
    // data: '@import "./sass/global-styling.scss";',
    includePaths: includePaths,
    importer: sniperImporter()
  }, function (err, result) {
    if (err) {
      console.log(err.status); // used to be "code" in v2x and below
      console.log(err.column);
      console.log(err.message);
      console.log(err.line);
    } else {
      // console.log(result.css.toString());
      // console.log(result.stats);
      // console.log(result.map.toString());
    }
  });
}

sniperConfigure(program.origin);
//resolveSevenDirectory();
//fileRenderer(path.resolve(process.cwd(), '../../sass/base/elements.scss'));
fileRenderer(path.resolve(process.cwd()+'/'+file));
