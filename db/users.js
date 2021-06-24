var records = [
  // { id: 1, username: 'prestoncarey', password: 'password', displayName: 'Preston', emails: [ { value: 'pcarey1213@gmail.com' } ] },
  { id: 1, "username":"prestoncarey","password":"6ff2b2d724362e153b56519bcb7f28f8", "displayName":"Preston"}
];

exports.findById = function(id, cb) {
  process.nextTick(function() {
    var idx = id - 1;
    if (records[idx]) {
      cb(null, records[idx]);
    } else {
      cb(new Error('User ' + id + ' does not exist'));
    }
  });
}

exports.findByUsername = function(username, cb) {
  process.nextTick(function() {
    for (var i = 0, len = records.length; i < len; i++) {
      var record = records[i];
      if (record.username === username) {
        return cb(null, record);
      }
    }
    return cb(null, null);
  });
}
