const fs = require('fs');
const http = require('http');
const https = require('https');
const assert = require('assert');
const Validator = require('jsonschema').Validator;
const jiup = require('./jiup-lib.js');

var rules = JSON.parse(fs.readFileSync('update-rules.json'));

describe('update-rules.js', function () {
  it('validated against the JSON schema', function () {
    var v = new Validator();
    var schema = JSON.parse(fs.readFileSync('update-rules-schema.json'));
    var res = v.validate(rules, schema);
    assert(res.valid, "Failed to validate JSON schema \n" + res.errors);
  });
});

describe('Testing update-rules urls', function () {
  fcall = function(k){
    it(rules[k].url, function (done) {
      var load = function(res){
        if(res.statusCode != 200){
          throw "Status code for " + rules[k].url + " is: " + res.statusCode
        }
        res.on('data', function(d){});
        res.on('end', done);
      };
      if(rules[k].url.match(/^https:/)){
        https.get(rules[k].url, load).on('error', done);
      }else{
        http.get(rules[k].url, load).on('error', done);
      }
    });
  };
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
