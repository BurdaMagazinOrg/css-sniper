#!/usr/bin/env node

const fs = require('fs');
const glob = require('glob');
const mkdirp = require('mkdirp');
const path = require('path');
const sass = require('node-sass');
const { sniperImporter } = require('./importer');
const program = require('./cli');

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
      console.log(err.formatted);
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
          return console.log(err.formatted);
        }
        fs.writeFile(dest, result.css.toString(), function (err) {
          if (err) {
            return console.log(err.formatted);
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
  let isDir = false;
  try {
    const absolutePath = path.resolve(filePath);
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

// Render files.
run(files);