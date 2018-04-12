// Crystaldisk uses a redirect system from which I haven't been able to get a working link.
// Easier to just get the build ID and version and plug them in a known URL
const cheerio = require("cheerio");
const helpers = require('../helpers');

exports.get_link = function (page, arch) {
  var highestVersion = '0';
  var highestID = '';
  $ = cheerio.load(page);
  $("a[href$='.zip/']").each(function (i, elem) {
    link = $(this).attr('href');
    var thisID = link.match(/downloads\/([0-9]*)\/CrystalDiskMark/)[1];
    var thisVersion = link.match(/CrystalDiskMark([0-9_]+)/)[1];
    if (helpers.isVersionNewer(highestVersion, thisVersion)) {
      highestVersion = thisVersion;
      highestID = thisID;
    }
  });
  return `https://ftp.halifax.rwth-aachen.de/osdn/crystaldiskmark/${highestID}/CrystalDiskMark${highestVersion}.exe`;
}