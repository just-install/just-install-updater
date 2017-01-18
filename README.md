# just-install-updater [![Build Status](https://travis-ci.org/just-install/just-install-updater.svg?branch=master)](https://travis-ci.org/just-install/just-install-updater)

A nodejs script for updating the [just-install](https://github.com/just-install/just-install)
registry links to the latest releases

### Installation

Make sure you have the latest NodeJS version installed on your system. Download just-install-updater from Github, and `npm install` from the directory where the files are located.

Placing a [Github API access token](https://github.com/blog/1509-personal-api-tokens) in a file named `githubAuth` at the root of the development folder is also recommended (but not essential). This will ensure you avoid hitting the rate limit of 60 requests per hour for unauthenticated API calls.

### Usage

From the install directory:

```
node jiup path [options] [packages]
```


##### arguments

* `path`: Absolute path to the just-install development folder.
* `packages`: An optional space separated list of packages to update. By default, all packages are updated.
* `options`: A space separated list of options.
  * `-c` : Commit: If updated packages are found, a prompt will offer the possibility to commit the updated registry file to Git.
  * `-ns`: No Save: Changes to the registry file are not saved.
  * `-f` : Force: Packages that would otherwise be skipped will be processed. The following safety checks are disabled:
    * Skip if the web version number is not higher than the registry version number.
    * Skip if new version not found for all architectures.
  * `-v` : Verbose: Outputs additional info, best used for debugging a single package.

Finally, starting the script with the following commands will perform a special task
 * `-h` or `-help` displays basic help.
 * `-todo` displays the just-install entries for which no update rules exist.

### Contributing
If you wish to contribute, please read the [documentation on the wiki](https://github.com/just-install/just-install-updater/wiki)
