const fs = require('fs');
const http = require('http');
const https = require('https');
const assert = require('assert');
const Validator = require('jsonschema').Validator;
const jiup = require('./jiup-lib.js');

var rules = JSON.parse(fs.readFileSync('update-rules.json'));
var pages = new Array();

describe('update-rules.js', function () {
  this.timeout(5000);
  it('validated against the JSON schema', function () {
    var v = new Validator();
    var schema = JSON.parse(fs.readFileSync('update-rules-schema.json'));
    var res = v.validate(rules, schema);
    assert(res.valid, "Failed to validate JSON schema \n" + res.errors);
  });
});

describe('Testing update-rules urls', function () {
  //Need to keep the for loop separated to avoid concurrency issues
  var load = function(k, url){
    it(url, function (done) {
      var loadme = function(k, url, done){
        pages[k] = '';
        var loadres = function(res){
          if(res.statusCode <= 308 && res.statusCode >= 300 && typeof(res.headers.location != 'undefined') && res.headers.location != ''){
            loadme(k, res.headers.location,done);
          }else if(res.statusCode != 200){
            done("Status code for " + url + " is: " + res.statusCode);
          }else{
            res.on('data', function(d){ pages[k] += d;});
            res.on('end', done);
          }
        };
        if(url.match(/^https:/)){
          https.get(url, loadres).on('error', done);
        }else{
          http.get(url, loadres).on('error', done);
        }
      }
      loadme(k,url,done);
    });
  };
  for(var k in rules) {
    load(k, rules[k].url);
  }
});

describe('Testing parsing rules and selectors', function () {
  //Need to keep the for loop separated to avoid concurrency issues
  var fcall = function(k) {
    it(k + ' download links extraction', function (){
      var web = jiup.parse(pages[k], k); //Need to keep this inside the it() block to avoid concurrency issues
      for(var arch in rules[k].updater){
        //console.log(web[arch]);
        assert.notEqual(web[arch], undefined, k + ' ' + arch + ' download link is undefined');
        assert.notEqual(web[arch], '', k + ' ' + arch + ' download link is empty');
      }
    });
    it(k + ' version number extraction', function (){
      var web = jiup.parse(pages[k], k); //Need to keep this inside the it() block to avoid concurrency issues
      assert.notEqual(web['version'], undefined, k + ' version is undefined');
      assert.notEqual(web['version'], '', k + ' version is empty');
    });
  }
  for(var k in rules) {
    fcall(k);
  }
});




describe('Testing some juip.js functions...', function () {
    it('isNotSameHost()', function () {
      assert(jiup.isNotSameHost('http://a/7z1514.msi', 'http://dl.7-zip.org/7z1514.msi'), 'At isNotSameHost() Test #1');
      assert(!jiup.isNotSameHost('https://nodejs.org/dist/v5.9.1/node-v5.9.1-x64.msi', 'https://nodejs.org/dist/v5.10.0/node-v5.10.0-x64.msi'), 'At isNotSameHost() Test #2');
    });
});
