/*  Pycharm won't give link if javascript is disabled. Lets get the link from
 *   their data service that provides the link instead
 */

exports.get_link = function (page, arch) {
  var data = JSON.parse(page);
  return arch == "x86" ? data.PCC[0].downloads.windows.link : "";
}