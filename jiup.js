const jiup = require('./jiup-lib.js');

if(process.argv[2] && process.argv[2].charAt(0) != '-'){
  var regPath = process.argv[2];
  process.argv.splice(2, 1);
  if(regPath.charAt(regPath.length-1) != '\\' && regPath.charAt(regPath.length-1) != '/'){
    throw "The path to the just-install folder should end with \\ on Windows or / on Linux";
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
