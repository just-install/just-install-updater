// Unable to get the 7 zip link with regular CSS selector for unknown reasons...
const cheerio = require("cheerio");
const helpers = require('../helpers');

exports.get_link = function(page, arch){
  var re_num = new RegExp('downloads/([0-9]*)/Crystal');
  var re_ver = new RegExp('CrystalDiskInfo(.*)-en\.exe');
  var highestVersion = '0';
  var highestID = '';
  $ = cheerio.load(page);
  $("a[href$='-en.exe/']").each(function(i, elem) {
    link = $(this).attr('href');
    var thisID = link.match(re_num)[1];
    var thisVersion = link.match(re_ver)[1];
    if(helpers.isVersionNewer(highestVersion, thisVersion)){
      highestVersion = thisVersion;
      highestID = thisID;
    }
  });
  return `http://tcpdiag.dl.osdn.jp/crystaldiskinfo/${highestID}/CrystalDiskInfo${highestVersion}-en.exe`;

}
