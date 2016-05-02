const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ch = require('cheerio');
const url = require('url');
const helpers = require('./helpers');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

//Indexes used for the different architectures in the json files
const x86 = 'x86';
const x64 = 'x86_64';

//Progress trackers
var updated = new Array();
var skipped = new Array();
var broken = new Array();
var notFound = new Array();
var pages = new Array();
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
args['-v'] = false;

//JSON data files and their paths
var registry = '';
var rules = JSON.parse(fs.readFileSync('update-rules.json'));
var regPath = '';
var regFile = 'just-install.json';

//This function is called by jiup.js to start the update process
exports.init = function(path){
  regPath = path;
  registry = JSON.parse(fs.readFileSync(regPath + regFile));
  setArchSettings();
  process.stdout.write(`\nFetching data`);
  progTimer = setInterval(function(){ process.stdout.write(`.`);}, 250);
  if(appList.length){
    for(var app in appList) {
      loadPages(appList[app]);
    }
  }else if(notFound.length){
    conclude();
  }else{
    for(var app in rules) {
      loadPages(app);
    };
  }
}

//Copies the general settings to each architecture for easier access
function setArchSettings(){
  for(var app in rules){
    if(rules[app].url != undefined){
      for(var arch in rules[app].updater){
        rules[app].updater[arch].url = rules[app].url;
      }
    }
  }
}

//Removes packages that do not exist from the package list received in argument
function cleanAppList(){
  if(cleanAppList.done == undefined || cleanAppList.done == false){
    var tmpList = new Array();
    for(var app in appList) {
      if(rules[appList[app]] != undefined){
        tmpList.push(appList[app]);
      }else{
        notFound.push(appList[app]);
      }
    }
    appList = tmpList;
    cleanAppList.done = true;
  }
}

//Loads the page in the update-rules for the app, and calls parse() and update() when done
function load(app, url, storageIndex){
  if(storageIndex == undefined){
    var storageIndex = url;
  }
  var page = '';
  var loadres = function(res){
    if(res.statusCode <= 308 && res.statusCode >= 300 && typeof(res.headers.location != 'undefined') && res.headers.location != ''){
      verbose("redirecting to " + res.headers.location, app);
      load(app, res.headers.location, storageIndex);
    }else if(res.statusCode != 200){
      broken.push(app + ': Status code was ' + res.statusCode);
      oneDone();
    }else{
      res.on('data', (d) => {
        page += d;
      });
      res.on('end', (e) => {
        pages[storageIndex] = page;
        oneDone();
      });
    }
  };
  if(url.match(/^https:/)){
    https.get(url, loadres).on('error', (e) => { console.error(e); });
  }else{
    http.get(url, loadres).on('error', (e) => { console.error(e); });
  }
}

//Loads all pages described in the rules
function loadPages(app){
  for(var arch in rules[app].updater){
    if(pages[rules[app].updater[arch].url] == undefined){
      progressTarget ++;
      pages[rules[app].updater[arch].url] = '';
      load(app, rules[app].updater[arch].url);
    }
  }
}

//Calls parseApp() for each packages that needs it
function parseAll(){
  if(appList.length){
    for(var app in appList){
      update(parseApp(appList[app]), appList[app]);
    }
  }else{
    for(var app in rules){
      update(parseApp(app), app);
    }
  }
}

/**
 * Calls parse() for each architecture of a package and groups the results
 * Returns an array containing the download links for each package and the version number for the app
 */
function parseApp(app){
  var result = false;
  for(var arch in rules[app].updater){
    verbose('Processing ' + rules[app].updater[arch].rule_type + ' rule on data from ' + rules[app].updater[arch].url, app, arch);
    var temp = parse(pages[rules[app].updater[arch].url], app, arch);
    verbose('Found link '+ temp[arch], app, arch);
    verbose('Found version '+ temp.version, app, arch);
    if(!result){
      result = temp;
    }else if(result.version == temp.version){
      result[arch] = temp[arch];
    }else{
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
function parse(page, app, arch){
  $ = ch.load(page);
  var web = new Array();
  var updater = rules[app].updater[arch];
  var highVersion = '0';
  switch(updater.rule_type){
    case "css-link":
      verbose('Found ' + $(updater.selector).get().length + ' CSS selector matches', app, arch);
      $(updater.selector).each(function (i, elem) {
        var filter_pass = true;
        var link = decodeURI($(this).attr('href'));
        if(updater.filter != undefined){
          var re = new RegExp(updater.filter);
          filter_pass = re.test(link);
        }
        if(filter_pass){
          var thisVersion = getVersion(link, app);
          if(thisVersion != undefined && helpers.isVersionNewer(highVersion, thisVersion)){
            highVersion = thisVersion;
            web[arch] = link;
          }
        }
      });
      break;
    case "regexp-link":
      var re = new RegExp(updater.filter, 'g');
      results = page.match(re);
      if(results == null){
        verbose('No regexp matches found', app, arch);
      }else{
        verbose('Found ' + results.length + ' regexp matches', app, arch);
        results.forEach(function(link){
          var link = decodeURI(link);
          var thisVersion = getVersion(link, app);
          if(thisVersion != undefined && helpers.isVersionNewer(highVersion, thisVersion)){
            highVersion = thisVersion;
            web[arch] = link;
          }
        });
      }
      break;
    case "css-html-version":
      web['version'] = getVersion($(updater.selector).html(), app);
      web[arch] = updater.baselink.replace(/{{.version}}/g, web['version']);
      break;
    case "regexp-version":
      var re = new RegExp(updater.filter, 'g');
      results = page.match(re);
      if(results == null){
        verbose('No regexp matches found', app, arch);
      }else{
        verbose('Found ' + results.length + ' regexp matches', app, arch);
        results.forEach(function(match){
          var thisVersion = getVersion(match, app);
          if(thisVersion != undefined && helpers.isVersionNewer(highVersion, thisVersion)){
            highVersion = thisVersion;
          }
        });
        web['version'] = highVersion;
        web[arch] = updater.baselink.replace(/{{.version}}/g, web['version']);
      }
      break;
    case "advanced":
      var advanced = require("./advanced_rules/" + app + ".js");
      web[arch] = decodeURI(advanced.get_link(page, arch));
  }
  if(rules[app].forceHTTPS != undefined && rules[app].forceHTTPS){
    web[arch] = web[arch].replace('http:', 'https:');
  }
  if(web['version'] == undefined && rules[app].versioner.rule_type == "from-link"){
    web['version'] = getVersion(web[arch], app);
  }
  return web;
}

//Parses the version number from the provided data using the package rule
function getVersion(data, k){
  var version = '';
  var versioner = rules[k].versioner;
  if(versioner){
    switch(versioner.rule_type){
      case "from-link":
      case "from-data":
        var re = new RegExp(versioner.extractor);
        var matches = re.exec(data);
        if(matches != null){
          if(matches.length == 1){
            version = matches[0];
          }else{
            for(var i=1; i < matches.length; i++){
              if(i != 1){
                version += '.';
              }
              version += matches[i];
            }
          }
        }
        break;
    }
  }
  if(version == ''){
    verbose("getVersion() could not parse version number from data: " + data, k);
  }
  return version.replace(/_/g, '.');
}

//Analyses the results from parse() and updates the registry if necessary
function update(web, k){
  var app = registry.packages[k];
  var updateCount = 0;
  var archCount = 0;
  var categorized = false;
  var versionNotNew = false;
  if(web['version'] == undefined || web['version'] == ''){
    var m = k + ": No version number. Run with verbose (-v) to see what went wrong.";
    broken.push(m);
    categorized = true;
  }else{
    for(var arch in rules[k].updater){
      archCount ++;
      console.log(' ');
      var updater = rules[k].updater[arch];
      console.log('Updating ' + k + ' ' + arch);
      if(app == undefined || app.installer[arch] == undefined){
        skipped.push(k +": Registry doesn't have entry for architecture "+arch);
      }else{
        var reg = app.installer[arch].replace(/{{.version}}/g, app.version);
        if(web[arch] == undefined){
          var m = 'Could not get link. Run with verbose (-v) to see what went wrong.';
          broken.push(k + ' ' + arch + ': ' + m);
          categorized = true;
          console.log(m);
        }else{
          web[arch] = url.resolve(rules[k].updater[arch].url, web[arch]);
          console.log('Web: v.' + web['version'] + ' '+ web[arch]);
          console.log('Reg: v.' + app.version + ' ' + reg);
          if(web[arch] == reg){
            console.log('Registry is up-to-date');
          }else if(helpers.isVersionNewer(app.version, web['version']) || args['-f']){
            updateCount ++;
            console.log('New version found!');
          }else{
            versionNotNew = true;
            console.log('New links found but version '+web['version']+' doesn\'t seem to be newer than '+app.version);
          }
        }
      }
    }
  }
  if(categorized == false){
    if(versionNotNew){
      var m = 'New links found but version '+web['version']+' doesn\'t seem to be newer than '+app.version;
      skipped.push(k + ': ' + m);
    }else if(updateCount != archCount){
      if(updateCount != 0 && args['-f'] == false){
        var m = 'New version was found, but not for all architectures';
        skipped.push(k + ': ' + m);
        console.log(m);
      }
    }else{
      re = new RegExp(web['version'], 'g')
      updated.push(k);
      for(var arch in rules[k].updater){
        app.installer[arch] = web[arch].replace(re, '{{.version}}');
      }
      app.version = web['version'];
    }
  }
  oneDone();
}

//Increments the progress counter for async operations
function oneDone(){
  progress ++;
  if(progress == progressTarget){
    clearInterval(progTimer);
    parseAll();
    conclude();
  }
}

//Outputs a summary and saves to disc
function conclude(){
  var saved = false;
  var allUpToDate = updated.length + skipped.length + broken.length == 0

  if(!allUpToDate && args['-ns'] == false && updated.length != 0){
    console.log('\n---- Saving changes to just-install.json ----');
    fs.writeFileSync(regPath + regFile, JSON.stringify(registry, null, '  '));
    saved = true;
  }

  console.log('\n========== SUMMARY OF OPERATIONS ==========\n');
  if(allUpToDate){
    console.log('All the packages that were found are already up-to-date!');
  }else{
    if(saved){
      console.log('Changes to the registry file have been saved');
    }else if(args['-ns'] && updated.length != 0){
      console.log('Option -ns was used, changes to the registry file have NOT been saved');
    }
    if(updated.length > 0){
      console.log('\nUPDATED:');
      for(i in updated){
        console.log("- " + updated[i]);
      }
    }else{
      console.log('No updated packages were found!');
    }
    if(skipped.length > 0){
      console.log('\nSKIPPED:  ==>  To force update, call script with "-f" argument');
      for(i in skipped){
        console.log("- " + skipped[i]);
      }
    }
    if(broken.length > 0){
      console.log('\nERRORS:');
      for(i in broken){
        console.log("- " + broken[i]);
      }
    }
  }
  if(notFound.length > 0){
    console.log('\nNOT FOUND:');
    for(i in notFound){
      console.log("- " + notFound[i]);
    }
  }
  if(updated.length > 0){
    console.log('\nTEST AND COMMIT TO GIT:');
    var com = '';
    for(i in updated){
      com += " "+updated[i];
    }
    console.log("Use the following commands to test your changes before committing them to Git:");
    console.log("\ncd "+regPath);
    console.log("just-install -d "+com);
  }
  if(!allUpToDate && args['-c'] && regPath && updated.length != 0){
    rl.question('\nWould you like to commit your changes to Git? [Y/n]: ', commit);
  }else{
    rl.close();
  }
}

//Prompts the user to commit the updated registry file to Git if the -c option is used
function commit(answer){
  if(answer == 'Y' || answer == 'y'){
    console.log('\n...Committing to Git...');
    var errFunc = function(error, stdout, stderr){
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
      if (error !== null) {
        console.log(`exec error: ${error}`);
      }
    }
    var m = 'Packages updated:';
    for(i in updated){
      m += " "+updated[i];
    }

    const child = require('child_process');
    var exec = child.execSync('git -C ' + regPath + ' add just-install.json', errFunc);
    exec = child.execSync('git -C ' + regPath + ' commit -m "just-install-updater automatic commit" -m "' + m +'"', errFunc);
    console.log('All Done!')
    rl.close();
  }else if(answer == 'N' || answer == 'n'){
    console.log('\nCommit skipped; you can commit manually later.');
    rl.close();
  }else{
    console.log('Please answer Y or N');
    rl.question('Would you like to commit your changes to Git? [Y/n]: ', commit);
  }
}

//Outputs additional debug info is the -v option is used
function verbose(msg, label, sublabel){
  if(args['-v']){
    if(sublabel == undefined){
      sublabel = '';
    }
    if(label == undefined){
      label = '';
    }else{
      label += ' '+sublabel+': ';
    }
    console.log(label + msg);
  }
}
