const https = require('https');
const http = require('http');
const fs = require('fs');
const ch = require('cheerio');

var updated = new Array();
var skipped = new Array();
var progress = 0;

if(process.argv[2]){
  var regPath = process.argv[2] + 'just-install.json';
}else{
  var regPath = 'just-install.json';
}
var apps = JSON.parse(fs.readFileSync(regPath)).packages;
var rules = JSON.parse(fs.readFileSync('update-rules.json'));

for(var k in rules) {
  update(k)
};

function update(k){
  var page = '';
  if(rules[k].url.match(/^https:/)){
    https.get(rules[k].url, (res) => {
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
    }).on('error', (e) => {
      console.error(e);
    });
  }else{
    http.get(rules[k].url, (res) => {
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
    }).on('error', (e) => {
      console.error(e);
    });
  }
}

function parse(page, k){
  $ = ch.load(page);
  var app = apps[k];
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
        m = 'Could not match selector. Check update rules.';
        skipped.push(k + ' ' + arch + ': ' + m);
        console.log(m);
      }else{
        //Need to checck that the match is made at end of string IMPORTANT!
        if(reg.match(web)){
          console.log('Registry is up-to-date');
        }
        else{
          updated.push(k + ' ' + arch);
          console.log('Registry will be updated with new link');
        }
      }
    }
  }
  oneDone();
}

function completeURL(url, k){
  return url;
}

function oneDone(){
  progress ++;
  if(progress == Object.keys(rules).length){
    summary();
  }
}

function summary(){
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
