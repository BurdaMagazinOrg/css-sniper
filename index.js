#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob')
const mkdirp = require('mkdirp');
const path = require('path');
const sass = require('node-sass');
const { execSync } = require('child_process');
const { sniperImporter, sniperConfigure } = require('./importer');
const program = require('commander');

program
  .version(require('./package.json').version)
  .usage('[options] <files ...>')
  .option('--include-path <value>', 'Paths to look for imported files ', val => val.split(','), [])
  .option('--origin [value]', 'Path to origin theme css files', execSync('drush eval "echo DRUPAL_ROOT . \'/\'. drupal_get_path(\'theme\', \'seven\');"'))
  .option('-o, --output [value]', 'Output directory')
  .option('--output-style [value]', 'Available output formats: nested, expanded, compact, compressed', 'compressed' )
  .parse(process.argv)

if (!program.args.length) program.help();

program.includePath = program.includePath.length ? program.includePath : ['sass-includes'];
let includePaths = program.includePath.map(include => path.resolve(process.cwd()+'/'+include));
let files = program.args[0];

/**
 * Render File
 *
 * @param {String} file
 */
function renderFile(file) {
  'use strict';

  sass.render({
    file: file,
    // data: '@import "./sass/global-styling.scss";',
    includePaths: includePaths,
    outputStyle: program.outputStyle,
    importer: sniperImporter(),
  }, function (err, result) {
    if (err) {
      console.log(err.status); // used to be "code" in v2x and below
      console.log(err.column);
      console.log(err.message);
      console.log(err.line);
    } else {
      // Build path to destination file.
      let dest = path.resolve(
        path.join(program.output,
          path.relative(
            path.resolve(files), file)
          )
        ).replace(path.extname(file), '.css');
      // Create destination dir.
      mkdirp(path.dirname(dest), function (err) {
        if (err) {
          return console.log(err);
        }
        fs.writeFile(dest, result.css.toString(), function (err) {
          if (err) {
            return console.log(err);
          }
          console.log(dest+' written.');
        });
      });
    }
  });

}

/**
 * Is a Directory
 *
 * @param {String} filePath
 * @returns {Boolean}
 * @api private
 */
function isDirectory(filePath) {
  var isDir = false;
  try {
    var absolutePath = path.resolve(filePath);
    isDir = fs.statSync(absolutePath).isDirectory();
  } catch (e) {
    isDir = e.code === 'ENOENT';
  }
  return isDir;
}

/**
 * Glob sass/scss files and render.
 *
 * @param {String} files
 */
function run(files) {
  'use strict';
  if (isDirectory(files)) {
    let globPath = path.resolve(files, '**/*.{sass,scss}');
    glob(globPath, { ignore: '**/_*', follow: true }, function (err, files) {
      for (let file of files) {
        renderFile(file);
      }
    });
  } else {
    renderFile(path.resolve(files));
  }
}

// Configure importer.
sniperConfigure(program.origin);

// Render files.
run(files);