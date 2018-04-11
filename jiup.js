const jiup = require('./jiup-lib.js');
const process = require('process');
const argv = require('minimist')(process.argv.slice(2));

process.exit(main());

function main() {
  if (argv.n && argv.s) argv.ns = true;
  if (argv.v) console.dir(argv);

  if (argv.h || argv.help) {
    showHelp()
    return 1;
  }

  if (argv._.length < 1) {
    console.log("The path to the just-install registry folder was not specified. Start the script with --help for more info.")
    return 1;
  }

  let regPath = argv._.shift();
  let packages = argv._;

  jiup.appList = jiup.appList.concat(packages);
  if (argv.v) console.dir(jiup.applist);

  Object.keys(argv).forEach(k => jiup.args[`-${k}`] = true);
  if (argv.v) console.dir(jiup.args);

  try {
    jiup.init(regPath);
  } catch (err) {
    console.log(`Error: ${err.toString()}`);
    return 1;
  }

  return 0;
}

function showHelp() {
  console.log(`
USAGE:
    node jiup [options] registry_dir [packages]

options:
    -c : Commit: Pulls the latest version of the registry and prompts to commit the registry file to Git.
    -p : Push: Pushes the changes to github using stored credentials
    -f : Force mode: Packages that would otherwise be skipped will be processed.
    -ns: No save: Changes to the registry file are not saved.
    -v : Verbose: Outputs additional info, best used for debugging a single package.
    -todo : Displays the just-install entries for which no update rules exist.

registry_dir:
    Absolute path to the folder containing just-install.json.

packages:
    An optional space separated list of packages to update. By default, all packages are updated.`);
}