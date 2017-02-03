#!/usr/bin/env node

"use strict";
var fs = require("fs");
var path = require("path");
var execFileSync = require("child_process").execFileSync;

var prompt = "prettier-master";
var masterBranch = process.env.MASTER_BRANCH || "master";
var prettierCommand = process.env.PRETTIER_CMD || "prettier";
var commitMessagePrefix = process.PRETTIER_COMMIT_PREFIX || prompt;
var committerName = process.env.GITHUB_USER_NAME || "prettier-master";
var pullRequestOnChange = process.env.PR_ON_CHANGE === "true";

var isCI = !!process.env.CI;
var isTravis = !!process.env.TRAVIS;
var isCircle =
  !!process.env.CIRCLE;

var cwd =  null;
function exec(command, args, hideFunction) {
  if (!hideFunction) {
    console.log(">", [command].concat(args).join(" "));
  }
  var options = {};
  if (cwd) {
    options.cwd = cwd;
  }
  return execFileSync(command, args, options).toString();
}

function ensureLastCommitWasNotPrettier() {
  var lastCommitterName = exec("git", ["log", "-1", '--format="%cn"']).trim();
  var lastCommitMessage = exec("git", ["log", "-1", '--format="%s"']).trim();

  if (
    lastCommitterName === committerName &&
      lastCommitMessage.indexOf(commitMessagePrefix) === 0
  ) {
    console.error(
      "The last commit was made by prettier-master. We do not need to run " +
        "against this commit, exiting..."
    );
    process.exit(0);
  }
}

function ensureGitUserExists(repoSlug) {
  repoSlug = repoSlug || "[repoSlug]";
  if (!process.env.GITHUB_USER || !process.env.GITHUB_TOKEN) {
    console.error(
      "In order to use " +
        prompt +
        ", you need to configure a " +
        "few environment variables to be able to commit to the " +
        "repository. Follow those steps to get you setup:\n" +
        "\n" +
        "Go to https://github.com/settings/tokens/new\n" +
        ' - Fill "Token description" with "' +
        prompt +
        " for " +
        repoSlug +
        '"\n' +
        ' - Check "public_repo"\n' +
        ' - Press "Generate Token"\n' +
        "\n" +
        "In a different tab, go to https://travis-ci.org/" +
        repoSlug +
        "/settings\n" +
        ' - Make sure "Build only if .travis.yml is present" is ON\n' +
        ' - Fill "Name" with "GITHUB_USER" and "Value" with the account ' +
        'you are logged in with. Press "Add"\n' +
        ' - Fill "Name" with "GITHUB_TOKEN" and "Value" with the key ' +
        'that was generated. Press "Add"\n' +
        "\n" +
        "Once this is done, commit anything to the repository to restart " +
        "Travis and it should work :)"
    );
    process.exit(1);
  }

  exec("git", ["config", "--global", "user.name", committerName]);
  exec("git", [
    "config",
    "--global",
    "user.email",
    process.env.GITHUB_USER_EMAIL || "prettier-master@no-reply.github.com"
  ]);
  exec("git", ["remote", "rm", "origin"]);
  exec(
    "git",
    [
      "remote",
      "add",
      "origin",
      "https://" +
        process.env.GITHUB_USER +
        ":" +
        process.env.GITHUB_TOKEN +
        "@github.com/" +
        repoSlug
    ],
    true
  );
}

function ensureGitIsClean() {
  if (exec("git", ["status", "--porcelain"])) {
    console.error(prompt + ": `git status` is not clean, aborting.");
    process.exit(1);
  }
}

function getRepoSlug() {
  if (isTravis) {
    return process.env.TRAVIS_REPO_SLUG;
  }

  var remotes = exec("git", ["remote", "-v"]).split("\n");
  for (var i = 0; i < remotes.length; ++i) {
    var match = remotes[i].match(/^origin\t[^:]+:([^\.]+).+\(fetch\)/);
    if (match) {
      return match[1];
    }
  }

  console.error("Cannot find repository slug, sorry.");
  process.exit(1);
}

function getBranch() {
  if (isTravis) {
    return process.env.TRAVIS_BRANCH;
  } else if (isCircle) {
    return process.env.CIRCLE_BRANCH;
  } else {
    return exec("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  }
}

function ensureBranchIsMaster(branch) {
  if (branch !== masterBranch) {
    console.log(prompt + ": Branch is not master, exiting...");
    process.exit(0);
  }
}

function ensureNotPullRequest() {
  if (
    !!process.env.TRAVIS_PULL_REQUEST &&
      process.env.TRAVIS_PULL_REQUEST !== "false" ||
      !!process.env.CI_PULL_REQUEST ||
      !!process.env.CI_PULL_REQUESTS
  ) {
    console.error(prompt + ": This is a PR, exiting...");
    process.exit(0);
  }
}

function getCommitHash() {
  return exec("git", ["rev-parse", "HEAD"]).trim();
}

function getJSFilesChanged(commitHash) {
  var diff = exec("git", [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "-r",
    commitHash
  ]);
  return diff.trim().split(/\s+/g).filter(function(file) {
    return file.substring(file.length - 3) === ".js";
  });
}

function runPrettier(jsFiles) {
  try {
    exec(prettierCommand, ["--write"].concat(jsFiles));
  } catch (e) {
    if (prettierCommand === "prettier") {
      console.error(
        "It looks like Prettier is not installed globally. You'll need to " +
          "run `npm install -g prettier` and make sure it installs successfully"
      );
    } else {
      console.error(
        "It looks like Prettier is not installed at the path you specified: " +
          prettierCommand +
          ". Please double check this or alternatively " +
          "install globally with `npm install -g prettier`."
      );
    }
    process.exit(1);
  }
}

function getLastCommitAuthor() {
  return exec("git", ["log", "-1", '--format="%an <%ae>"']).trim();
}

function updateGitIfChanged(commitHash) {
  var status = exec("git", ["status", "--porcelain"]).trim();
  if (status.length > 0) {
    if (isCI) {
      exec("git", ["checkout", masterBranch]);
    }
    var branch = pullRequestOnChange
      ? prompt + "-" + getCommitHash()
      : masterBranch;
    if (pullRequestOnChange) {
      exec("git", ["branch", branch]);
    }
    exec("git", ["add", "--all"]);
    exec("git", [
      "commit",
      "-m",
      "'" + prompt + ": prettifying of JS for " + commitHash + "'",
      "--author=" + getLastCommitAuthor()
    ]);
    var filesUpdated = getJSFilesChanged(getCommitHash()).join("\n");
    console.error(prompt + ": files updated:\n" + filesUpdated);
    try {
      exec("git", ["push", "origin", branch]);
      if (pullRequestOnChange) {
        exec("curl", [
          "--user",
          process.env.GITHUB_USER + ":" + process.env.GITHUB_TOKEN,
          "--request",
          "POST",
          "--data",
          JSON.stringify({
            title: prompt + " - " + commitHash,
            body: (
              "Your friendly Travis CI caught this slip in JS formatting" +
                "and opened this PR with the required changes for you."
            ),
            head: branch,
            base: masterBranch
          }),
          "https://api.github.com/" + repoSlug
        ]);
        console.log(prompt + ": PR opened");
      }
      var outcome = noFilesChanged === 1
        ? "1 file prettified!"
        : noFilesChanged + "files prettified!";
      console.error(prompt + ": " + outcome);
    } catch (e) {
      console.error(e.message);
      console.error(prompt + ": unable to push changes to master");
    }
  } else {
    console.error(prompt + ": nothing to update");
  }
}

ensureLastCommitWasNotPrettier();
ensureGitIsClean();
var branch = getBranch();
if (isCI) {
  var repoSlug = getRepoSlug();
  ensureGitUserExists(repoSlug);
  ensureBranchIsMaster(branch);
  ensureNotPullRequest();
}
var commitHash = getCommitHash();
if (isTravis && !!process.env.TRAVIS_COMMIT_RANGE) {
  // Travis commit ranges are triple dots when they should be doubles
  // this protects from this
  // see: https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection#double_dot
  commitHash = process.env.TRAVIS_COMMIT_RANGE.replace("...", "..");
}

var jsFilesChanged = getJSFilesChanged(commitHash);

if (jsFilesChanged.length === 0) {
  console.error(prompt + ": no JavaScript files changed in push");
  process.exit(0);
}

runPrettier(jsFilesChanged);
updateGitIfChanged(commitHash);
