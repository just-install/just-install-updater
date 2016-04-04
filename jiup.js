const jiup = require('./jiup-lib.js');

if(process.argv[2] && process.argv[2].charAt(0) != '-'){
  var regPath = process.argv[2] + 'just-install.json';
  process.argv.splice(2, 1);
}else{
  var regPath = 'just-install.json';
}

process.argv.slice(2).forEach(function (val, index, array) {
  if(val.charAt(0) == '-' && jiup.args[val] != undefined){
    jiup.args[val] = true;
  }
});

jiup.init(regPath);
jiup.updateAll();
