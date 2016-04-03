const fs = require('fs');
const http = require('http');
const https = require('https');
const assert = require('assert');
const Validator = require('jsonschema').Validator;

var rules = JSON.parse(fs.readFileSync('update-rules.json'));

describe('update-rules.js', function () {
  it('should be validated against tje JSON schema', function () {
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
