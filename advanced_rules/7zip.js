// Unable to get the 7 zip link with regular CSS selector for unknown reasons...
const cheerio = require("cheerio");

exports.get_link = function (page, arch) {
  $ = cheerio.load(page);
  return $("td.Item > a").eq(arch == "x86" ? 5 : 6).attr('href');
}