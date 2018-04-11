// Crystaldisk uses a redirect system from which I haven't been able to get a working link.
// Easier to just get the build ID and version and plug them in a known URL
const cheerio = require("cheerio");
const helpers = require('../helpers');

exports.get_link = function (page, arch) {
  var re_num = new RegExp('downloads/([0-9]*)/Crystal');
  var re_ver = new RegExp('CrystalDiskInfo(.*)\.exe');
  var highestVersion = '0';
  var highestID = '';
  $ = cheerio.load(page);
  $("a[href$='.exe/']").each(function (i, elem) {
    link = $(this).attr('href');
    var thisID = link.match(re_num)[1];
    var thisVersion = link.match(re_ver)[1];
    if (helpers.isVersionNewer(highestVersion, thisVersion)) {
      highestVersion = thisVersion;
      highestID = thisID;
    }
  });
  return `http://osdn.dl.osdn.jp/crystaldiskinfo/${highestID}/CrystalDiskInfo${highestVersion}.exe`;

}