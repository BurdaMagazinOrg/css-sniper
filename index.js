#!/usr/bin/env node

const path = require('path');
const sass = require('node-sass');
// const glob = require('glob');
const sevenImporter = require('./importer').sevenImporter;

function fileRenderer(file) {
  'use strict';

  sass.render({
    file: file,
    // data: '@import "./sass/global-styling.scss";',
    includePaths: ['./sass', './sass-includes'],
    importer: sevenImporter()
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

//console.log(__dirname);
//console.log(process.env.PWD);

//resolveSevenDirectory();
fileRenderer(path.resolve(process.cwd(), 'sass/base/elements.scss'));
