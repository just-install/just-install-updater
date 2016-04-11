const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ch = require('cheerio');
const url = require('url');
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
var progress = 0;
var progressTarget = 0;

//Arguments received from the command line
var appList = new Array();
exports.appList = appList;
var args = new Array();
exports.args = args;
args['-c'] = false;
args['-f'] = false;
args['-ns'] = false;

//JSON data files and their paths
var registry = '';
var rules = JSON.parse(fs.readFileSync('update-rules.json'));
var regPath = '';
var regFile = 'just-install.json';

//This function is called by jiup.js to start the update process
exports.init = function(path){
  regPath = path;
  registry = JSON.parse(fs.readFileSync(regPath + regFile));
  setProgressTarget();
  if(appList.length){
    for(var k in appList) {
      load(appList[k], rules[appList[k]].url);
    }
  }else if(notFound.length){
    conclude();
  }else{
    for(var k in rules) {
      load(k, rules[k].url);
    };
  }
}

//Sets the targets for the progress counters for async operations according to
//the number of packages to be updated
function setProgressTarget(){
  cleanAppList();
  if(appList.length){
    progressTarget = appList.length;
  }else{
    progressTarget = Object.keys(rules).length;
  }
}

//Removes packages that do not exist from the package list received in argument
function cleanAppList(){
  if(cleanAppList.done == undefined || cleanAppList.done == false){
    var tmpList = new Array();
    for(var k in appList) {
      if(rules[appList[k]] != undefined){
        tmpList.push(appList[k]);
      }else{
        notFound.push(appList[k]);
      }
    }
    appList = tmpList;
    cleanAppList.done = true;
  }
}

//Loads the page in the update-rules for the app, and calls parse() and update() when done
function load(k, url){
  var page = '';
  var loadres = function(res){
    if(res.statusCode <= 308 && res.statusCode >= 300 && typeof(res.headers.location != 'undefined') && res.headers.location != ''){
      console.log(k + " redirecting to " + res.headers.location);
      load(k, res.headers.location);
    }else if(res.statusCode != 200){
      broken.push(k + ': Status code was ' + res.statusCode);
      oneDone();
    }else{
      res.on('data', (d) => {
        page += d;
      });
      res.on('end', (e) => {
        update(parse(page, k), k);
      });
    }
  };
  if(rules[k].url.match(/^https:/)){
    https.get(url, loadres).on('error', (e) => { console.error(e); });
  }else{
    http.get(url, loadres).on('error', (e) => { console.error(e); });
  }
}

/**
 * Parses a webpage using the update-rules for the specified package
 * Returns an array containing the download links for each architecture
 * as well as the version
 */
exports.parse = parse;
function parse(page, k){
  $ = ch.load(page);
  var web = new Array();
  for(var arch in rules[k].updater){
    var updater = rules[k].updater[arch];
    switch(updater.rule_type){
      case "css-link":
        web[arch] = decodeURI($(updater.selector).attr('href'));
        break;
      case "css-html-version":
        web['version'] = getVersion($(updater.selector).html(), k);
        web[arch] = updater.baselink.replace(/{{.version}}/g, web['version']);
        break;
      case "advanced":
        var advanced = require("./advanced_rules/" + k + ".js");
        web[arch] = decodeURI(advanced.get_link(page, arch));
    }
  }
  if(rules[k].versioner.rule_type == "from-link"){
    web['version'] = getVersion(web[x86], k);
  }
  return web;
}

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
    console.log('\n'+ k + ": Could not parse version number from data: \n" + data);
  }
  return version;
}

//Analyses the results from parse() and updates the registry if necessary
function update(web, k){
  var app = registry.packages[k];
  var updateCount = 0;
  var archCount = 0;
  var categorized = false;
  if(web['version'] == undefined || web['version'] == ''){
    var m = k + ": Could not parse version number. Check detailed log to see source data.";
    broken.push(m);
    categorized = true;
  }else{
    for(var arch in rules[k].updater){
      archCount ++;
      console.log(' ');
      var updater = rules[k].updater[arch];
      console.log('Updating ' + k + ' ' + arch + '... Rule type: ' + updater.rule_type);
      if(app == undefined || app.installer[arch] == undefined){
        skipped.push(k +": Registry doesn't have entry for architecture "+arch);
      }else{
        var reg = app.installer[arch].replace(/{{.version}}/g, app.version);
        if(web[arch] == undefined){
          var m = 'Could not match selector. Check update rules.';
          broken.push(k + ' ' + arch + ': ' + m);
          categorized = true;
          console.log(m);
        }else{
          web[arch] = url.resolve(rules[k].url, web[arch]);
          console.log('Web: v.' + web['version'] + ' '+ web[arch]);
          console.log('Reg: v.' + app.version + ' ' + reg);
          if(web[arch] == reg){
            console.log('Registry is up-to-date');
          }
          else if(isNotSameHost(web[arch], reg) && args['-f'] == false){
            var m = 'Web link and registry point to different hosts';
            skipped.push(k + ' ' + arch + ': ' + m);
            categorized = true;
            console.log(m);
          }else{
            updateCount ++;
            console.log('New version found!');
          }
        }
      }
    }
  }
  if(categorized == false){
    if(updateCount != archCount && args['-f'] == false){
      if(updateCount != 0){
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

//Checks if two URLs have the same host
exports.isNotSameHost = isNotSameHost;
function isNotSameHost(u1, u2){
  u1 = url.parse(u1);
  u2 = url.parse(u2);
  return (u1.hostname != u2.hostname);
}

//Increments the progress counter for async operations
function oneDone(){
  progress ++;
  if(progress == progressTarget){
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
      console.log('-Changes to the registry file have been saved');
    }else if(args['-ns'] && updated.length != 0){
      console.log('-Option -ns was used, changes to the registry file have NOT been saved');
    }
    if(updated.length > 0){
      console.log('\nUPDATED:');
      for(i in updated){
        console.log("- " + updated[i]);
      }
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
