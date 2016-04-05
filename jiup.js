const jiup = require('./jiup-lib.js');
const process = require('process');

if(process.argv[2] && process.argv[2].charAt(0) != '-'){
  var regPath = process.argv[2];
  process.argv.splice(2, 1);
  if(process.platform == 'win32' && regPath.charAt(regPath.length-1) != '\\'){
    regPath += '\\';
  }else if(process.platform == 'linux' && regPath.charAt(regPath.length-1) != '/'){
    regPath += '/';
  }else if(process.platform != 'linux' && process.platform != 'win32'){
    throw "Only linux and windows are currently supported.";
  }
}else{
  var regPath = '';
}

process.argv.slice(2).forEach(function (val, index, array) {
  if(val.charAt(0) == '-' && jiup.args[val] != undefined){
    jiup.args[val] = true;
  }
});

jiup.init(regPath);
jiup.updateAll();
