// 时间格式化工具
function formatDate(date) {
  if (!date) return '';
  var d;
  if (typeof date === 'string') {
    d = new Date(date);
  } else if (date.getTime) {
    d = date;
  } else if (date.$date) {
    // 云数据库 serverDate 格式
    d = new Date(date.$date);
  } else {
    return String(date);
  }
  if (isNaN(d.getTime())) return String(date);
  var y = d.getFullYear();
  var M = pad(d.getMonth() + 1);
  var D = pad(d.getDate());
  var h = pad(d.getHours());
  var m = pad(d.getMinutes());
  return y + '年' + M + '月' + D + '日 ' + h + ':' + m;
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

module.exports = { formatDate: formatDate };
