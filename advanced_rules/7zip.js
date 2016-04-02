// Unable to get the 7 zip link with regular CSS selector for unknown reasons...
const cheerio = require("cheerio");

exports.get_link = function(page, arch){
  $ = cheerio.load(page);
  if(arch == "x86"){
    return $("td.Item > a").eq(5).attr('href');
  }else{
    return $("td.Item > a").eq(6).attr('href');
  }
}
