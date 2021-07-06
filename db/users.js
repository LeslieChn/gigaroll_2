var records = [
  // { id: 1, username: 'prestoncarey', password: 'password', displayName: 'Preston', emails: [ { value: 'pcarey1213@gmail.com' } ] },
  { id: 1, "username":"prestoncarey","password":"6ff2b2d724362e153b56519bcb7f28f8", "displayName":"Preston"},
  { id: 2, "username":"raminfarz", "password":"8959753740a2818ef1c23b9250c676d7", "displayName": "Ramin" },
  { id: 3, "username":"lzhang","password":"3aeb9fe54b40f02090795bc1ecedb956", "displayName":"Leslie"},
  { id: 4, "username":"bkaur","password":"30f4d1c4dd708b30a8ab3ce53eeab13e","displayName":"Balpreet"},
  { id: 5, "username":"apascarella","password":"816c725694a63793932d24e58b0b7784","displayName":"Aldo"}
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
