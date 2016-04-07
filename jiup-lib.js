const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ch = require('cheerio');
const url = require('url');

//Indexes used for the different architectures in the json files
const x86 = 'x86';
const x64 = 'x86_64';

var updated = new Array();
var skipped = new Array();
var broken = new Array();
var notFound = new Array();
var progress = 0;
var progressTarget = 0;

var appList = new Array();
exports.appList = appList;
var args = new Array();
exports.args = args;
args['-c'] = false;
args['-f'] = false;
args['-ns'] = false;


var registry = '';
var rules = '';
var regPath = '';
var regFile = 'just-install.json';

exports.init = function(path){
  regPath = path;
  registry = JSON.parse(fs.readFileSync(regPath + regFile));
  rules = JSON.parse(fs.readFileSync('update-rules.json'));
}

function setProgressTarget(){
  cleanAppList();
  if(appList.length){
    progressTarget = appList.length;
  }else{
    progressTarget = Object.keys(rules).length;
  }
}

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

exports.update = function(){
  setProgressTarget();
  if(appList.length){
    for(var k in appList) {
      load(appList[k]);
    }
  }else if(notFound.length){
    conclude();
  }else{
    for(var k in rules) {
      load(k)
    };
  }
}

function load(k){
  var page = '';
  var load = function(res){
    if(res.statusCode != 200){
      skipped.push(k + ': Status code was ' + res.statusCode);
      oneDone();
    }else{
      res.on('data', (d) => {
        page += d;
      });
      res.on('end', (e) => {
        parse(page, k)
      });
    }
  };
  if(rules[k].url.match(/^https:/)){
    https.get(rules[k].url, load).on('error', (e) => { console.error(e); });
  }else{
    http.get(rules[k].url, load).on('error', (e) => { console.error(e); });
  }
}

function parse(page, k){
  $ = ch.load(page);
  var app = registry.packages[k];
  var updateCount = 0;
  var archCount = 0;
  var web = new Array();
  var categorized = false;
  for(var arch in rules[k].updater){
    archCount ++;
    console.log(' ');
    var updater = rules[k].updater[arch];
    console.log('Updating ' + k + ' ' + arch + '... Rule type: ' + updater.rule_type);
    if(app == undefined || app.installer[arch] == undefined){
      skipped.push(k +": Registry doesn't have entry for architecture "+arch);
    }else{
      var reg = app.installer[arch].replace(/{{.version}}/g, app.version);
      switch(updater.rule_type){
        case "css-link":
          web[arch] = $(updater.selector).attr('href');
          break;
        case "advanced":
          var advanced = require("./advanced_rules/" + k + ".js");
          web[arch] = advanced.get_link(page, arch);
      }

      if(web[arch] == undefined){
        var m = 'Could not match selector. Check update rules.';
        broken.push(k + ' ' + arch + ': ' + m);
        categorized = true;
        console.log(m);
      }else{
        web[arch] = url.resolve(rules[k].url, web[arch]);
        console.log('Web: ' + web[arch]);
        console.log('Reg: ' + reg);
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
  if(categorized == false){
    if(updateCount != archCount && args['-f'] == false){
      if(updateCount != 0){
        var m = 'New version was found, but not for all architectures';
        skipped.push(k + ': ' + m);
        console.log(m);
      }
    }else{
      updated.push(k);
      app.installer[x86] = web[x86];
      app.installer[x64] = web[x64];
      //app.version = updateVersion(page, k);
    }
  }
  oneDone();
}

function updateVersion(page, k){
  return '0.0.0.0';
}

exports.isNotSameHost = isNotSameHost;
function isNotSameHost(u1, u2){
  u1 = url.parse(u1);
  u2 = url.parse(u2);
  return (u1.hostname != u2.hostname);
}

function oneDone(){
  progress ++;
  if(progress == progressTarget){
    conclude();
  }
}

function conclude(){
  var saved = false;
  var committed = false;
  var allUpToDate = updated.length + skipped.length + broken.length == 0

  if(!allUpToDate && args['-ns'] == false && updated.length != 0){
    console.log('\n---- Saving changes to just-install.json ----');
    fs.writeFileSync(regPath + regFile, JSON.stringify(registry, null, '  '));
    saved = true;
  }
  if(!allUpToDate && args['-c'] && regPath && updated.length != 0){
    console.log('\n---- Committing to Git ----');
    var errFunc = function(error, stdout, stderr){
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
      if (error !== null) {
        console.log(`exec error: ${error}`);
      }
    }
    const child = require('child_process');
    var exec = child.execSync('git -C ' + regPath + ' add just-install.json', errFunc);
    exec = child.execSync('git -C ' + regPath + ' commit -m "just-install-updater automatic commit"', errFunc);
    committed = true;
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
    if(committed){
      console.log('-The updated registry file has been committed to Git');
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
}
