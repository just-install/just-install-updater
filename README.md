# just-install-updater [![Build Status](https://travis-ci.org/guiweber/just-install-updater.svg?branch=master)](https://travis-ci.org/guiweber/just-install-updater)

A nodejs script for updating the [just-install](https://github.com/lvillani/just-install)
registry links to the latest releases

### Installation

Make sure you have the latest NodeJS version installed on your system. Download the just-install-updater from Github, and `npm install` from the directory where the files are located.

### Usage

From the install directory:

```node jiup path [options] [packages]```


##### arguments

* `path`: Absolute path to the just-install development folder.
* `packages`: An optional space separated list of packages to update. By default, all packages are updated.
* `options`: A space separated list of options.
  * `-c` : Commit: If updated packages are found, a prompt will offer the possibility to commit the updated registry file to Git.
  * `-ns`: No Save: Changes to the registry file are not saved.
  * `-f` : Force: Packages that would otherwise be skipped will be processed. The following safety checks are disabled:
    * Skip if the web link and registry link don't point to the same hosts.
    * Skip if new version not found for all architectures.

Finally, starting the script with `-h` or `-help` will discard all other arguments and show basic help.
