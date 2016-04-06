# just-install-updater [![Build Status](https://travis-ci.org/guiweber/just-install-updater.svg?branch=master)](https://travis-ci.org/guiweber/just-install-updater)

A nodejs script for updating the [just-install](https://github.com/lvillani/just-install)
registry links to the latest releases

### How to use

1. npm install
* node jiup.js path [options] [packages]


#### arguments

* path: absolute path to the just-install development folder.
* packages: a space separated list of packages to update. By default, all packages are updated.
* options: a space separated list of options
  * -c : Commit: Commits the updated registry file to Git.
  * -ns: No save: Changes to the registry file are not saved.
  * -f : Force mode: forces the update by disabling the following safety checks:
    * Skip if the web link and registry link don't point to the same hosts.
    * Skip if new version not found for all architectures.
