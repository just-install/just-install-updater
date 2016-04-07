const jiup = require('./jiup-lib.js');
const process = require('process');

var argUsed = 0;
var help = false;
if(process.argv[2] && process.argv[2].charAt(0) != '-'){
  argUsed ++;
  var regPath = process.argv[2];
  if(process.platform == 'win32' && regPath.charAt(regPath.length-1) != '\\'){
    regPath += '\\';
  }else if(process.platform == 'linux' && regPath.charAt(regPath.length-1) != '/'){
    regPath += '/';
  }else if(process.platform != 'linux' && process.platform != 'win32'){
    throw "Only linux and windows are currently supported.";
  }
}else{
  regPath = '';
}

process.argv.slice(2+argUsed).forEach(function (val, index, array) {
  if(val.charAt(0) == '-'){
    if(val == '-h' || val == '-help'){
      showHelp();
      help = true;
    }else if(jiup.args[val] != undefined){
      jiup.args[val] = true;
    }
  }else{
    jiup.appList.push(val);
  }
});

if(help == false){
  if(regPath == ''){
    throw "A path to the just-install dev folder was not specified. Start the script with -h for help.";
  }else{
    jiup.init(regPath);
    jiup.update();
  }
}

function showHelp(){
  var s = '   ';
  console.log('\nUSAGE:');
  console.log(s+'node jiup path [options] [packages]');
  console.log('\npath:');
  console.log(s+'Absolute path to the just-install development folder.');
  console.log('\npackages:');
  console.log(s+'An optional space separated list of packages to update. By default, all packages are updated.');
  console.log('\noptions:');
  console.log(s+'-c : Commit: The updated registry file will be commited to Git.');
  console.log(s+'-ns: No save: Changes to the registry file are not saved.');
  console.log(s+'-f : Force mode: Packages that would otherwise be skipped will be processed.');
}
