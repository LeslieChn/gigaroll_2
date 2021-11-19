var records = [
  // { id: 1, username: 'prestoncarey', password: 'password', displayName: 'Preston', emails: [ { value: 'pcarey1213@gmail.com' } ] },
  { id: 1, "username":"prestoncarey","password":"6ff2b2d724362e153b56519bcb7f28f8", "displayName":"Preston"},
  { id: 2, "username":"raminfarz", "password":"8959753740a2818ef1c23b9250c676d7", "displayName": "Ramin" },
  { id: 3, "username":"lzhang","password":"3aeb9fe54b40f02090795bc1ecedb956", "displayName":"Leslie"},
  { id: 4, "username":"bkaur","password":"30f4d1c4dd708b30a8ab3ce53eeab13e","displayName":"Balpreet"},
  { id: 5, "username":"apascarella","password":"816c725694a63793932d24e58b0b7784","displayName":"Aldo"},
  { id: 6, "username":"rlau","password":"773803507eff16125ab83b0a2ff01023","displayName":"Rhea"},
  { id: 7, "username":"jweiner","password":"4f170a276dee2378096ff93e6a6c8f6c","displayName":"Jonathan"},
  { id: 8, "username":"lreiss","password":"98a0b3016b635871c08599dc33698669","displayName":"Lisa"},
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
