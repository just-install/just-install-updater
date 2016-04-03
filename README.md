# just-install-updater [![Build Status](https://travis-ci.org/guiweber/just-install-updater.svg?branch=master)](https://travis-ci.org/guiweber/just-install-updater)

A nodejs script for updating the [just-install](https://github.com/lvillani/just-install)
registry links to the latest releases

### How to use

1. npm install
* node jiup.js [path to just-install] [packages] [options]


#### arguments

* path to just-install: absolute path to the just-install development folder.
* packages: a space separated list of packages to update. By default, all packages are updated.
* args: a space separated list of options
  * -f : Forces the update by disabling the following safety checks:
    * The web link and registry link don't point to the same hosts.
  * -t : Test mode. Changes to the registry file are not saved.
