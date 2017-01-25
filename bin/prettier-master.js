#!/usr/bin/env node

/**
 * Copyright (c) 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var execFileSync = require('child_process').execFileSync;

var prompt = 'prettier-master';
var masterBranch = process.env.MASTER_BRANCH || 'master';

var isCI = !!process.env.CI;
var isTravis = !!process.env.TRAVIS;
var isCircle = !!process.env.CIRCLE;

var cwd = null;
function exec(command, args) {
  console.error('>', [command].concat(args).join(' '));
  var options = {};
  if (cwd) {
    options.cwd = cwd;
  }
  return execFileSync(command, args, options).toString();
}

function ensureGitUserExists(repoSlug) {
  repoSlug = repoSlug || '[repoSlug]';
  if (!process.env.GITHUB_USER) {
    console.error(
      'In order to use ' + prompt + ', you need to configure a ' +
      'few environment variables to be able to commit to the ' +
      'repository. Follow those steps to get you setup:\n' +
      '\n' +
      'Go to https://github.com/settings/tokens/new\n' +
      ' - Fill "Token description" with "' + prompt + ' for ' +
        repoSlug + '"\n' +
      ' - Check "public_repo"\n' +
      ' - Press "Generate Token"\n' +
      '\n' +
      'In a different tab, go to https://travis-ci.org/' +
        repoSlug + '/settings\n' +
      ' - Make sure "Build only if .travis.yml is present" is ON\n' +
      ' - Fill "Name" with "GITHUB_USER" and "Value" with the name of the ' +
        'account you generated the token with. Press "Add"\n' +
      '\n' +
      'Once this is done, commit anything to the repository to restart ' +
        'Travis and it should work :)'
    );
    process.exit(1);
  }

  exec(
    'git',
    [
      'config',
      '--global',
      'user.name',
      process.env.GITHUB_USER_NAME || 'facts-tracker',
    ]
  );
  exec(
    'git',
    [
      'config',
      '--global',
      'user.email',
      process.env.GITHUB_USER_EMAIL || 'facts-tracker@no-reply.github.com',
    ]
  );
}

function ensureGitIsClean() {
  if (exec('git', ['status', '--porcelain'])) {
    console.error(prompt + ': `git status` is not clean, aborting.');
    process.exit(1);
  }
}

function getBranch() {
  if (isTravis) {
    return process.env.TRAVIS_BRANCH;
  } else if (isCircle) {
    return process.env.CIRCLE_BRANCH;
  } else {
    return exec('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  }
}

function ensureBranchIsMaster(branch) {
  if (branch !== masterBranch) {
    console.log(prompt + ': Branch is not master, exiting...');
    process.exit(0);
  }
}

function ensureNotPullRequest() {
  if (
    !!process.env.TRAVIS_PULL_REQUEST ||
    !!process.env.CI_PULL_REQUEST ||
    !!process.env.CI_PULL_REQUESTS
  ) {
    console.error(prompt + ': This is a PR, exiting...');
    process.exit(0);
  }
}

function getCommitHash() {
  return exec('git', ['rev-parse', 'HEAD']).trim();
}

function getJSFilesChanged(commitHash) {
  return exec('git', ['diff', '--name-only', commitHash])
    .trim()
    .split(/\s+/g)
    .filter(function(file) {
      return file.substring(file.length - 3) === '.js'
    });
}

function runPrettier(jsFiles) {
  exec('./node_modules/.bin/prettier', ['--write'].concat(jsFiles));
}

function updateGitIfChanged(commitHash) {
  var noFilesChanged = exec('git', ['status', '--porcelain'])
    .trim()
    .split(/\s+/g)
    .length;
  if (noFilesChanged > 0) {
    exec('git', ['add', '--all']);
    exec('git', ['commit', '-m', 'Prettifying of JS for ' + commitHash]);
    //exec('git', ['push', 'origin', masterBranch]);
    var outcome = noFilesChanged === 1
      ? '1 file prettified!'
      : noFilesChanged + 'files prettified!';
    console.error(prompt + ':' + outcome);
  } else {
    console.error(prompt + ': nothing to update');
  }
}

ensureGitIsClean();
var branch = getBranch();
if (isCI) {
  ensureGitUserExists();
  ensureBranchIsMaster(branch);
  ensureNotPullRequest();
}
var commitHash = getCommitHash();
var jsFilesChanged = getJSFilesChanged(commitHash);

if (jsFilesChanged.length === 0) {
  console.error(prompt + ': nothing to update');
  process.exit(0);
}

runPrettier(jsFilesChanged);
updateGitIfChanged(commitHash);
