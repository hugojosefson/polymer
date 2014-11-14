/*
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

// jshint node: true

'use strict';

var
  audit = require('gulp-audit'),
  concat = require('gulp-concat'),
  exec = require('child_process').exec,
  fs = require('fs'),
  gulp = require('gulp'),
  header = require('gulp-header'),
  path = require('path'),
  replace = require('gulp-replace'),
  rename = require('gulp-rename'),
  runseq = require('run-sequence'),
  uglify = require('gulp-uglify')
;

// init tests with gulp
require('web-component-tester').gulp.init(gulp);

var isRelease = process.env.RELEASE !== undefined;

var banner = fs.readFileSync('banner.txt', 'utf8');

var pkg;

gulp.task('audit', function() {
  return gulp.src('dist/*.{js,html}')
  .pipe(audit('build.log', {
    repos:[
      '.',
      '../polymer-expressions',
      '../polymer-gestures',
      '../TemplateBinding',
      '../NodeBind',
      '../URL',
      '../observe-js']
  }))
  .pipe(gulp.dest('dist/'));
});

gulp.task('replace', ['version'], function() {
  return gulp.src('src/polymer.js')
  .pipe(replace('master', pkg.version))
  .pipe(rename('polymer-versioned.js'))
  .pipe(gulp.dest('dist/'));
});

gulp.task('version', function(cb) {
  pkg = require('./package.json');
  var cmd = ['git', 'rev-parse', '--short', 'HEAD'].join(' ');
  if (!isRelease) {
    exec(cmd, function(err, stdout, stderr) {
      if (err) {
        return cb(err);
      }
      if (stdout) {
        stdout = stdout.trim();
      }
      pkg.version = pkg.version + '-' + stdout;
      cb();
    });
  } else {
    cb();
  }
});

gulp.task('copy', function() {
  return gulp.src(['layout.html', 'bower.json', 'README.md']).pipe(gulp.dest('dist/'));
});

gulp.task('clean-bower', function(cb) {
  var config = require('./dist/bower.json');
  delete config.dependencies['polymer-expressions'];
  delete config.dependencies['polymer-gestures'];
  delete config.dependencies.URL;
  fs.writeFileSync('./dist/bower.json', JSON.stringify(config, null, 2));
  cb();
});

function defineBuildTask(name, manifest) {
  (function() {

    manifest = manifest || './src/' + name + '/build.json';
    var output = name;
    var list = readManifest(manifest);
    gulp.task(name + '-debug', ['replace'], function() {
      return gulp.src(list)
      .pipe(concat(output + '.js'))
      .pipe(uglify({
        mangle: false,
        compress: false,
        output: {
          beautify: true,
          indent_level: 2
        }
      }))
      .pipe(header(banner, {pkg: pkg}))
      .pipe(gulp.dest('dist/'))
      ;
    });

    gulp.task(name, [name + '-debug'], function() {
      return gulp.src(list)
      .pipe(concat(output + '.min.js'))
      .pipe(uglify())
      .pipe(header(banner, {pkg: pkg}))
      .pipe(gulp.dest('dist/'))
      ;
    });

  })();
}


function readManifest(filename, modules) {
  modules = modules || [];
  var lines = require(path.resolve(filename));
  var dir = path.dirname(filename);
  lines.forEach(function(line) {
    var fullpath = path.resolve(dir, line);
    if (line.slice(-5) == '.json') {
      // recurse
      modules = modules.concat(readManifest(fullpath, modules));
    } else {
      modules.push(fullpath);
    }
  });
  var tmp = Object.create(null);
  for (var i = 0; i < modules.length; i++) {
    tmp[modules[i]] = 1;
  }
  modules = Object.keys(tmp);
  return modules;
}

defineBuildTask('polymer', 'build.json');

gulp.task('default', function(cb) {
  runseq('polymer', 'copy', ['clean-bower', 'audit'], cb);
});

gulp.task('release', function(cb) {
  isRelease = true;
  runseq('default', cb);
});
