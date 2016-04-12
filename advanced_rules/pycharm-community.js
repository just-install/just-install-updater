/*  Pycharm won't give link if javascript is disabled. Lets get the link from
*   their data service that provides the link instead
*/

exports.get_link = function(page, arch){
  var data = JSON.parse(page);
  if(arch == "x86"){
    return data.PCC[0].downloads.windows.link;
  }else{
    return '';
  }
}
