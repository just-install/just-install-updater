const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const ch = require('cheerio');
const url = require('url');

var updated = new Array();
var skipped = new Array();
var broken = new Array();
var progress = 0;

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

exports.updateAll = function(){
  for(var k in rules) {
    update(k)
  };
}

function update(k){
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
  for(var arch in rules[k].updater){
    console.log(' ');
    var updater = rules[k].updater[arch];
    console.log('Updating ' + k + ' ' + arch + '... Rule type: ' + updater.rule_type);
    if(app == undefined || app.installer[arch] == undefined){
      skipped.push(k +": Registry doesn't have entry for architecture "+arch);
    }else{
      var reg = app.installer[arch].replace(/{{.version}}/g, app.version);
      switch(updater.rule_type){
        case "css-link":
          var web = $(updater.selector).attr('href');
          break;
        case "advanced":
          var advanced = require("./advanced_rules/" + k + ".js");
          var web = advanced.get_link(page, arch);
      }

      if(web == undefined){
        var m = 'Could not match selector. Check update rules.';
        broken.push(k + ' ' + arch + ': ' + m);
        console.log(m);
      }else{
        web = url.resolve(rules[k].url, web);
        console.log('Web: ' + web);
        console.log('Reg: ' + reg);
        if(web == reg){
          console.log('Registry is up-to-date');
        }
        else if(isNotSameHost(web, reg) && args['-f'] == false){
          var m = 'Web link and registry point to different hosts';
          skipped.push(k + ' ' + arch + ': ' + m);
          console.log(m);
        }else{
          updated.push(k + ' ' + arch);
          app.installer[arch] = web;
          console.log('Registry will be updated with new link');
        }
      }
    }
  }
  oneDone();
}

exports.isNotSameHost = isNotSameHost;
function isNotSameHost(u1, u2){
  u1 = url.parse(u1);
  u2 = url.parse(u2);
  return (u1.hostname != u2.hostname);
}

function oneDone(){
  progress ++;
  if(progress == Object.keys(rules).length){
    conclude();
  }
}

function conclude(){
  var saved = false;
  var committed = false;

  if(args['-ns'] == false && updated.length != 0){
    console.log('\n---- Saving changes to just-install.json ----');
    fs.writeFileSync(regPath + regFile, JSON.stringify(registry, null, '  '));
    saved = true;
  }
  if(args['-c'] == true && regPath && updated.length != 0){
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

  if(saved){
    console.log('-Changes to the registry file have been saved');
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
