const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ch = require('cheerio');
const url = require('url');
const helpers = require('./helpers');
const readline = require('readline');
const rootCas = require('ssl-root-cas/latest');

//Adds additional certificates not bundeled with Node
rootCas.addFile(__dirname + '/certs/letsencrypt.crt');
https.globalAgent.options.ca = rootCas;

//Indexes used for the different architectures in the json files
const x86 = 'x86';
const x64 = 'x86_64';

//Progress trackers
var updated = new Array();
var skipped = new Array();
var broken = new Array();
var notFound = new Array();
var pages = new Array();
exports.pages = pages;
var progress = 0;
var progressTarget = 0;
var progTimer = '';

//Arguments received from the command line
var appList = new Array();
exports.appList = appList;
var args = new Array();
exports.args = args;
args['-c'] = false;
args['-f'] = false;
args['-ns'] = false;
args['-p'] = false;
args['-v'] = false;
args['-todo'] = false;

//JSON data files and their paths
var registry = '';
var rules = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'update-rules.json')));
var auth = new Array();
exports.auth = auth;
console.log('');
try {
  auth.github = fs.readFileSync(path.resolve(__dirname, 'githubAuth')).toString('utf8');
} catch (err) {
  auth.github = process.env.githubAuth;
  if (auth.github == undefined) {
    console.log('Github API token not found. API requests will be unauthenticated and may hit rate limit');
  }
}
var regPath = '';
var regFile = 'just-install.json';

//This function is called by jiup.js to start the update process
exports.init = function (regPath) {
  if (args['-c']) {
    pull();
  }
  registry = JSON.parse(fs.readFileSync(path.join(regPath, regFile)));
  if (args['-todo']) {
    showTodo();
  } else {
    setArchSettings();
    cleanAppList();
    if (args['-v']) {
      console.log('Fetching data...');
      console.log('Progress bar not shown in verbose mode, please be patient...');
    } else {
      process.stdout.write(`\nFetching data`);
      progTimer = setInterval(function () {
        process.stdout.write(`.`);
      }, 250);
    }
    if (appList.length) {
      for (var app in appList) {
        loadPages(appList[app]);
      }
    } else if (notFound.length) {
      clearInterval(progTimer);
      conclude();
    } else {
      for (var app in rules) {
        loadPages(app);
      };
    }
  }
}

//Copies the general settings to each architecture for easier access
function setArchSettings() {
  for (var app in rules) {
    if (rules[app].url != undefined) {
      for (var arch in rules[app].updater) {
        rules[app].updater[arch].url = rules[app].url;
      }
    }
  }
}

// showTodo shows apps not covered by just-install-updater.
function showTodo() {
  let packages = Object.entries(registry.packages);
  let uncovered = packages.filter(package => !package[1].version.includes("latest")).map(package => package[0]).filter(package => rules[package] == null);
  let coverage = Math.round((1 - uncovered.length / packages.length) * 100);
  console.log(uncovered.join("\n"));
  console.log('=======================');
  console.log(`${coverage}% coverage`);
}

//Removes packages that do not exist from the package list received in argument
function cleanAppList() {
  if (cleanAppList.done == undefined || cleanAppList.done == false) {
    var tmpList = new Array();
    for (var app in appList) {
      if (rules[appList[app]] != undefined) {
        tmpList.push(appList[app]);
      } else {
        notFound.push(appList[app]);
      }
    }
    appList = tmpList;
    cleanAppList.done = true;
  }
}

//Adds the API authentication tokens to the requested URL if needed
function addAuth(appUrl) {
  if (appUrl.indexOf('?') > 0) {
    var separator = '&';
  } else {
    var separator = '?';
  }
  if (auth.github != undefined && appUrl.startsWith('https://api.github.com')) {
    appUrl += separator + 'access_token=' + auth.github;
  }
  return appUrl;
}

//Loads the page in the update-rules for the app, and calls parse() and update() when done
function load(app, appUrl, storageIndex) {
  if (storageIndex == undefined) {
    var storageIndex = appUrl;
  }
  var page = '';
  var params = getLoadParams(appUrl)

  var loadres = function (res) {
    if (res.statusCode <= 308 && res.statusCode >= 300 && typeof (res.headers.location != 'undefined') && res.headers.location != '') {
      verbose("redirecting to " + res.headers.location, app);
      load(app, res.headers.location, storageIndex);
    } else if (res.statusCode != 200) {
      verbose('Status code was: ' + res.statusCode);
      broken.push(app + ': Status code was: ' + res.statusCode);
      oneDone();
    } else {
      res.on('data', (d) => {
        page += d;
      });
      res.on('end', (e) => {
        pages[storageIndex] = page;
        oneDone();
      });
    }
  };
  if (appUrl.match(/^https:/)) {
    https.get(params, loadres).on('error', (e) => {
      verbose(e, app);
      oneDone();
    });
  } else {
    http.get(params, loadres).on('error', (e) => {
      verbose(e, app);
      oneDone();
    });
  }
}

//Loads all pages described in the rules
function loadPages(app) {
  for (var arch in rules[app].updater) {
    if (pages[rules[app].updater[arch].url] == undefined) {
      progressTarget++;
      pages[rules[app].updater[arch].url] = '';
      load(app, rules[app].updater[arch].url);
    }
  }
}

exports.getLoadParams = getLoadParams;

function getLoadParams(appUrl) {
  var params = url.parse(addAuth(appUrl));
  /*params.headers = {
    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0"
  };*/
  //User agent is mandatory for github API calls
  params.headers = {
    'User-Agent': "just-install updater"
  };
  return params;
}

//Calls parseApp() for each packages that needs it
function parseAll() {
  if (appList.length) {
    for (var app in appList) {
      update(parseApp(appList[app]), appList[app]);
    }
  } else {
    for (var app in rules) {
      update(parseApp(app), app);
    }
  }
}

/**
 * Calls parse() for each architecture of a package and groups the results
 * Returns an array containing the download links for each package and the version number for the app
 */
function parseApp(app) {
  var result = false;
  for (var arch in rules[app].updater) {
    verbose('Processing ' + rules[app].updater[arch].rule_type + ' rule on data from ' + rules[app].updater[arch].url, app, arch);
    var temp = parse(pages[rules[app].updater[arch].url], app, arch);
    verbose('Found link ' + temp[arch], app, arch);
    verbose('Found version: ' + temp.version, app, arch);
    if (!result) {
      result = temp;
    } else if (result.version == temp.version) {
      result[arch] = temp[arch];
    } else {
      verbose('Versions found are not the same for all architectures, results rejected', app);
    }
  }
  return result;
}

/**
 * Parses a webpage using the update-rules for the specified package/architecture
 * Returns an array containing the download link and version
 */
exports.parse = parse;

function parse(page, app, arch) {
  var web = new Array();
  var updater = rules[app].updater[arch];
  var highVersion = '0';
  switch (updater.rule_type) {
    case "css-link":
      $ = ch.load(page);
      verbose('Found ' + $(updater.selector).get().length + ' CSS selector matches', app, arch);
      $(updater.selector).each(function (i, elem) {
        var filter_pass = true;
        if (updater.link_attribute == undefined) {
          var link = decodeURI($(this).attr('href'));
        } else {
          var link = decodeURI($(this).attr(updater.link_attribute));
        }
        if (updater.filter != undefined) {
          var re = new RegExp(updater.filter);
          filter_pass = re.test(link);
        }
        if (filter_pass) {
          var thisVersion = getVersion(link, app);
          if (thisVersion != undefined && helpers.isVersionNewer(highVersion, thisVersion)) {
            highVersion = thisVersion;
            web[arch] = link;
          }
        }
      });
      web['version'] = highVersion;
      break;
    case "regexp-link":
      var re = new RegExp(updater.filter, 'g');
      results = page.match(re);
      if (results == null) {
        verbose('No regexp matches found', app, arch);
      } else {
        verbose('Found ' + results.length + ' regexp matches', app, arch);
        results.forEach(function (link) {
          var link = decodeURI(link);
          var thisVersion = getVersion(link, app);
          if (thisVersion != undefined && helpers.isVersionNewer(highVersion, thisVersion)) {
            highVersion = thisVersion;
            web[arch] = link;
          }
        });
        web['version'] = highVersion;
      }
      break;
    case "json-link":
      var matches = traverseJSON(JSON.parse(page), updater.selector);
      verbose('Found ' + matches.length + ' matches in JSON object', app, arch);
      matches.forEach(function (val) {
        var filter_pass = true;
        var link = decodeURI(val);
        if (updater.filter != undefined) {
          var re = new RegExp(updater.filter);
          filter_pass = re.test(link);
        }
        if (filter_pass) {
          var thisVersion = getVersion(link, app);
          if (thisVersion != undefined && helpers.isVersionNewer(highVersion, thisVersion)) {
            highVersion = thisVersion;
            web[arch] = link;
          }
        }
      });
      web['version'] = highVersion;
      break;
    case "css-html-version":
      $ = ch.load(page);
      verbose('Found ' + $(updater.selector).get().length + ' CSS selector matches', app, arch);
      $(updater.selector).each(function (i, elem) {
        var thisVersion = getVersion($(this).html(), app);
        if (thisVersion != undefined && helpers.isVersionNewer(highVersion, thisVersion)) {
          highVersion = thisVersion;
        }
        web['version'] = highVersion;
        web[arch] = removePlaceholders(updater.baselink, web['version'])
      });
      break;
    case "regexp-version":
      var re = new RegExp(updater.filter, 'g');
      results = page.match(re);
      if (results == null) {
        verbose('No regexp matches found', app, arch);
      } else {
        verbose('Found ' + results.length + ' regexp matches', app, arch);
        results.forEach(function (match) {
          var thisVersion = getVersion(match, app);
          if (thisVersion != undefined && helpers.isVersionNewer(highVersion, thisVersion)) {
            highVersion = thisVersion;
          }
        });
        web['version'] = highVersion;
        web[arch] = removePlaceholders(updater.baselink, web['version'])
      }
      break;
    case "advanced":
      var advanced = require("./advanced_rules/" + app + ".js");
      web[arch] = decodeURI(advanced.get_link(page, arch));
      web['version'] = getVersion(web[arch], app);
  }

  web[arch] = applyMods(web[arch], app, updater);

  return web;
}

//Applies modifiers to the download link
function applyMods(link, app, updater) {
  if (link) {
    if (rules[app].forceHTTPS != undefined && rules[app].forceHTTPS) {
      link = link.replace('http:', 'https:');
    }

    if (updater.forceHTTPS != undefined && updater.forceHTTPS) {
      link = link.replace('http:', 'https:');
    }

    if (rules[app].append != undefined) {
      link += rules[app].append;
    }

    if (updater.append != undefined) {
      link += updater.append;
    }

    if (rules[app].replace != undefined) {
      for (key in rules[app].replace) {
        link = link.replace(rules[app].replace[key][0], rules[app].replace[key][1]);
      }
    }

    if (updater.replace != undefined) {
      for (key in updater.replace) {
        link = link.replace(updater.replace[key][0], updater.replace[key][1]);
      }
    }
  }
  return link;
}

//Replaces the placeholders in the baselink and returns the resulting link
function removePlaceholders(baselink, version) {

  var final = baselink.replace(/{{\.version}}/g, version);
  final = final.replace(/{{\.version_}}/g, version.replace(/\./g, "_"));
  final = final.replace(/{{\.version-}}/g, version.replace(/\./g, "-"));
  final = final.replace(/{{\.version#}}/g, version.replace(/\./g, ""));

  var splitVersion = version.split(".");
  final = final.replace(/{{\.version\[0\]}}/g, splitVersion[0]);
  final = final.replace(/{{\.version\[1\]}}/g, splitVersion[1]);
  final = final.replace(/{{\.version\[2\]}}/g, splitVersion[2]);

  return final;
}

//Parses the version number from the provided data using the package rule
getVersion.savedVersions = new Array();

function getVersion(data, app) {
  var version = '';
  switch (rules[app].version_source) {
    case "page":
      if (getVersion.savedVersions[app] != undefined) {
        return getVersion.savedVersions[app];
      } else {
        data = pages[rules[app].url];
      }
    default:
      var re = new RegExp(rules[app].version_extractor);
      var matches = re.exec(data);
      if (matches != null) {
        if (matches.length == 1) {
          version = matches[0];
        } else {
          for (var i = 1; i < matches.length; i++) {
            if (i != 1) {
              version += '.';
            }
            version += matches[i];
          }
        }
      }
      break;
  }
  if (version == '') {
    verbose("getVersion() could not parse version number from data: " + data, app);
  }

  version = version.replace(/_/g, '.');

  if (rules[app].version_source == "page") {
    getVersion.savedVersions[app] = version;
  }

  return version;
}

//Analyses the results from parse() and updates the registry if necessary
function update(web, k) {
  var app = registry.packages[k];
  var updateCount = 0;
  var archCount = 0;
  var categorized = false;
  var versionNotNew = false;
  if (web['version'] == undefined || web['version'] == '') {
    broken.push(k + ": No version number. Run with verbose (-v) to see what went wrong.");
    categorized = true;
  } else {
    for (var arch in rules[k].updater) {
      var msg = '\n' + 'Updating ' + k + ' ' + arch + '\n';
      archCount++;
      var updater = rules[k].updater[arch];
      if (app == undefined) {
        var m = "App is not present in registry file";
        msg += m;
        broken.push(k + ' ' + arch + ': ' + m);
        categorized = true;
      } else if (app.installer[arch] == undefined && args["-f"] == false) {
        var m = "Registry doesn't have entry for architecture " + arch;
        msg += m;
        skipped.push(k + ": " + m);
      } else {
        if (app.installer[arch] == undefined) {
          var reg = '';
        } else {
          var reg = app.installer[arch].replace(/{{.version}}/g, app.version);
        }
        if (web[arch] == undefined) {
          var m = 'Could not get link. Run with verbose (-v) to see what went wrong.';
          msg += m;
          broken.push(k + ' ' + arch + ': ' + m);
          categorized = true;
        } else {
          web[arch] = url.resolve(rules[k].updater[arch].url, web[arch]);
          msg += 'Web: v.' + web['version'] + ' ' + web[arch];
          msg += '\n' + 'Reg: v.' + app.version + ' ' + reg;
          if (web[arch] == reg) {
            verbose(msg);
            verbose('Registry is up-to-date');
          } else if (helpers.isVersionNewer(app.version, web['version']) || args['-f']) {
            updateCount++;
            console.log(msg);
            console.log('New version found!');
          } else {
            versionNotNew = true;
            console.log(msg);
            console.log('New links found but version ' + web['version'] + ' doesn\'t seem to be newer than ' + app.version);
          }
        }
      }
    }
  }
  if (categorized == false) {
    if (versionNotNew) {
      var m = 'New links found but version ' + web['version'] + ' doesn\'t seem to be newer than ' + app.version;
      skipped.push(k + ': ' + m);
    } else if (updateCount != 0) {
      if (updateCount != archCount && args['-f'] == false) {
        var m = 'New version was found, but not for all architectures';
        skipped.push(k + ': ' + m);
      } else {
        re = new RegExp(web['version'].replace(/\./g, "\\."), 'g')
        updated.push(k);
        for (var arch in rules[k].updater) {
          app.installer[arch] = web[arch].replace(re, '{{.version}}');
        }
        app.version = web['version'];
      }
    }
  }
}

//Increments the progress counter for async operations
function oneDone() {
  progress++;
  if (progress == progressTarget) {
    clearInterval(progTimer);
    parseAll();
    conclude();
  }
}

//Outputs a summary and saves to disc
function conclude() {
  var saved = false;
  var allUpToDate = updated.length + skipped.length + broken.length == 0

  if (!allUpToDate && args['-ns'] == false && updated.length != 0) {
    console.log('\n---- Saving changes to just-install.json ----');
    fs.writeFileSync(path.join(regPath, regFile), JSON.stringify(registry, null, '  '));
    saved = true;
  }

  console.log('\n\n========== SUMMARY OF OPERATIONS ==========\n');
  if (allUpToDate) {
    console.log('All the packages that were found are already up-to-date!');
  } else {
    if (saved) {
      console.log('Changes to the registry file have been saved');
    } else if (args['-ns'] && updated.length != 0) {
      console.log('Option -ns was used, changes to the registry file have NOT been saved');
    }
    if (updated.length > 0) {
      console.log('\nUPDATED:');
      for (i in updated) {
        console.log("- " + updated[i]);
      }
    } else {
      console.log('No updated packages were found!');
    }
    if (skipped.length > 0) {
      console.log('\nSKIPPED:  ==>  To force update, call script with "-f" argument');
      for (i in skipped) {
        console.log("- " + skipped[i]);
      }
    }
    if (broken.length > 0) {
      console.log('\nERRORS:');
      for (i in broken) {
        console.log("- " + broken[i]);
      }
    }
  }
  if (notFound.length > 0) {
    console.log('\nNOT FOUND:');
    for (i in notFound) {
      console.log("- " + notFound[i]);
    }
  }
  if (updated.length > 0) {
    console.log('\nTEST AND COMMIT TO GIT:');
    var com = '';
    for (i in updated) {
      com += " " + updated[i];
    }
    console.log("Use the following commands to test your changes before committing them to Git:");
    console.log("\ncd " + regPath);
    console.log("just-install -d " + com);
  }
  if (!allUpToDate && args['-c'] && updated.length != 0) {
    commit();
  }
  if (args['-p']) {
    push();
  }
}

//Output callback for child processes
function errFunc(error, stdout, stderr) {
  console.log(`stdout: ${stdout}`);
  console.log(`stderr: ${stderr}`);
  if (error !== null) {
    console.log(`exec error: ${error}`);
  }
}

//Pulls the latest version of the registry from git
function pull() {
  console.log('\n...Pulling latest version from Git...');
  const child = require('child_process');
  var exec = child.execSync('git -C ' + regPath + ' pull', errFunc);
  console.log('Pull Done!');
}

//Prompts the user to commit the updated registry file to Git if the -c option is used
function commit() {
  console.log('\n...Committing to Git...');
  var m = 'Packages updated:';
  for (i in updated) {
    m += " " + updated[i];
  }

  const child = require('child_process');
  var exec = child.execSync('git -C ' + regPath + ' add just-install.json', errFunc);
  exec = child.execSync('git -C ' + regPath + ' commit -m "just-install-updater automatic commit" -m "' + m + '"', errFunc);
  console.log('Commit completed!');
}

//Prompts the user to push the changes to github if the -p option is used
function push(answer) {
  console.log('\n...Pushing to Github...');
  const child = require('child_process');
  var exec = child.execSync('git -C ' + regPath + ' push origin master', errFunc);
  console.log('Push to github completed!');
}

//Outputs additional debug info is the -v option is used
function verbose(msg, label = '', sublabel = '') {
  if (args['-v']) {
    if (label) {
      label += ' ' + sublabel + ': ';
    }
    console.log(label + msg);
  }
}

//Returns the values assigned associated with the targetKey in a JSON object
function traverseJSON(obj, targetKey) {
  var results = new Array();
  for (var i in obj) {
    if (obj[i] !== null && typeof (obj[i]) == "object") {
      results = results.concat(traverseJSON(obj[i], targetKey));
    } else if (i == targetKey) {
      results.push(obj[i]);
    }
  }
  return results;
}