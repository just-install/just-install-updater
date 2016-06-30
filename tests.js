const fs = require('fs');
const http = require('http');
const https = require('https');
const assert = require('assert');
const Validator = require('jsonschema').Validator;
const jiup = require('./jiup-lib.js');
const helpers = require('./helpers');

var rules = JSON.parse(fs.readFileSync('update-rules.json'));
var pages = new Array();

for(var app in rules){
  if(rules[app].url != undefined){
    for(var arch in rules[app].updater){
      rules[app].updater[arch].url = rules[app].url;
    }
  }
}

describe('update-rules.js', function () {
  it('validated against the JSON schema', function () {
    var v = new Validator();
    var schema = JSON.parse(fs.readFileSync('update-rules-schema.json'));
    var res = v.validate(rules, schema);
    assert(res.valid, "Failed to validate JSON schema \n" + res.errors);
  });
});

describe('Testing update-rules urls', function () {
  this.timeout(10000);
  //Need to keep the for loop separated to avoid concurrency issues
  var load = function(k, url){
    it(url, function (done) {
      var loadme = function(k, url, done, storageIndex){
        if(storageIndex == undefined){
          var storageIndex = url;
        }
        var loadres = function(res){
          if(res.statusCode <= 308 && res.statusCode >= 300 && typeof(res.headers.location != 'undefined') && res.headers.location != ''){
            loadme(k, res.headers.location, done, storageIndex);
          }else if(res.statusCode != 200){
            done("Status code for " + url + " is: " + res.statusCode);
          }else{
            res.on('data', function(d){ pages[storageIndex] += d;});
            res.on('end', done);
          }
        };
        var params = jiup.getLoadParams(url);
        if(url.match(/^https:/)){
          https.get(params, loadres).on('error', done);
        }else{
          http.get(params, loadres).on('error', done);
        }
      }
      loadme(k,url,done);
    });
  };
  for(var app in rules) {
    for(var arch in rules[app].updater){
      if(pages[rules[app].updater[arch].url] == undefined){
        pages[rules[app].updater[arch].url] = '';
        load(app, rules[app].updater[arch].url);
      }
    }
  }
});

describe('Testing parsing rules and selectors', function () {
  //Need to keep the for loop separated to avoid concurrency issues
  var fcall = function(app, arch) {
    it(app + ' ' + arch + ' download links extraction', function (){
      var web = jiup.parse(pages[rules[app].updater[arch].url], app, arch); //Need to keep this inside the it() block to avoid concurrency issues
      //console.log(web[arch]);
      assert.notEqual(web[arch], undefined, app + ' ' + arch + ' download link is undefined');
      assert.notEqual(web[arch], '', app + ' ' + arch + ' download link is empty');
    });
    it(app + ' ' + arch +' version number extraction', function (){
      var web = jiup.parse(pages[rules[app].updater[arch].url], app, arch); //Need to keep this inside the it() block to avoid concurrency issues
      assert.notEqual(web['version'], undefined, app + ' version is undefined');
      assert.notEqual(web['version'], '', app + ' version is empty');
    });
  }
  for(var app in rules) {
    for(var arch in rules[app].updater){
      fcall(app, arch);
    }
  }
});




describe('Testing helper functions...', function () {
    it('isSameHost()', function () {
      assert(!helpers.isSameHost('http://a/7z1514.msi', 'http://dl.7-zip.org/7z1514.msi'), 'At isSameHost() Test #1');
      assert(helpers.isSameHost('https://nodejs.org/dist/v5.9.1/node-v5.9.1-x64.msi', 'https://nodejs.org/dist/v5.10.0/node-v5.10.0-x64.msi'), 'At isSameHost() Test #2');
    });
    it('isVersionNewer()', function () {
      var count = function(){
        if (count.c == undefined){
          count.c = 0;
        }
        count.c ++;
        return count.c;
      }
      //underscores
      assert(helpers.isVersionNewer('2_02_3','2_22_3'), 'At isVersionNewer() Test #'+count());

      //Letters are ignored for now
      assert(helpers.isVersionNewer('0.2.4c.1', '0.2.4.2a'), 'At isVersionNewer() Test #'+count());
      assert(helpers.isVersionNewer('0.2.4.1a', '0.2.4.10'), 'At isVersionNewer() Test #'+count());

      //Trailing zeros
      assert(helpers.isVersionNewer('2.2.4','2.2.30'), 'At isVersionNewer() Test #'+count());
      assert(helpers.isVersionNewer('5.9.1','5.10.1'), 'At isVersionNewer() Test #'+count());

      //Leading zeros5.10.1
      assert(helpers.isVersionNewer('0.002.4.1', '0.2.4.2'), 'At isVersionNewer() Test #'+count());
      assert(helpers.isVersionNewer('0.002.4.1', '0.22.4.1'), 'At isVersionNewer() Test #'+count());
      assert(helpers.isVersionNewer('0.0.2.4.1', '0.2.4.2'), 'At isVersionNewer() Test #'+count());

      //Compatc numbers
      assert(helpers.isVersionNewer('55322', '55342'), 'At isVersionNewer() Test #'+count());

    });
});
