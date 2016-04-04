const fs = require('fs');
const http = require('http');
const https = require('https');
const ch = require('cheerio');
const urlparse = require('url-parse');

var updated = new Array();
var skipped = new Array();
var progress = 0;

var args = new Array();
exports.args = args;
args['-f'] = false;
args['-ns'] = false;


var registry = '';
var rules = '';
var regPath = '';

exports.init = function(path){
  regPath = path;
  registry = JSON.parse(fs.readFileSync(regPath));
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

      web = completeURL(web, k);
      console.log('Web: ' + web);
      console.log('Reg: ' + reg);
      if(web == undefined){
        var m = 'Could not match selector. Check update rules.';
        skipped.push(k + ' ' + arch + ': ' + m);
        console.log(m);
      }else{
        if(web == reg){
          console.log('Registry is up-to-date');
        }
        else if(isNotSameHost(web, reg) && args['-f'] == false){
          var m = 'Web link and registry point to different hosts. To force update, call script with "-f" argument.';
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

function completeURL(url, k){
  url = new urlparse(url, rules[k].url);
  return url.href;
}

exports.isNotSameHost = isNotSameHost;
function isNotSameHost(u1, u2){
  u1 = new urlparse(u1);
  u2 = new urlparse(u2);
  return (u1.hostname != u2.hostname);
}

function oneDone(){
  progress ++;
  if(progress == Object.keys(rules).length){
    conclude();
  }
}

function conclude(){
  if(args['-ns'] == false){
    console.log(' ');
    console.log('Saving changes to the registry file');
    fs.writeFile(regPath, JSON.stringify(registry, null, '  '));
  }
  console.log(' ');
  console.log('========== SUMMARY OF OPERATIONS ==========');
  if(updated.length > 0){
    console.log(' ');
    console.log('UPDATED:');
    for(i in updated){
      console.log("- " + updated[i]);
    }
  }
  if(skipped.length > 0){
    console.log(' ');
    console.log('ERRORS:');
    for(i in skipped){
      console.log("- " + skipped[i]);
    }
  }
}
