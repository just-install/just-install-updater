const cv = require('compare-version');
const url = require('url');

//Checks if two URLs have the same host
exports.isSameHost = function (u1, u2) {
  u1 = url.parse(u1);
  u2 = url.parse(u2);
  return (u1.hostname == u2.hostname);
}

//Attempts to determine if the web version is newer than the registry version.
//At the moment, letters are ignored.
exports.isVersionNewer = function (curVer, newVer) {
  curVer = curVer.split('_').join('.');
  newVer = newVer.split('_').join('.');
  if (cv(newVer, curVer) == 1) {
    return true;
  } else {
    return false;
  }
}