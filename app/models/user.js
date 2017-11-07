var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: false,
  defaults: {},

  initialize: function() {
    this.on('creating', function(model, attrs, options) {
      // salt the password
      var salt = bcrypt.genSaltSync(10);
      // hash the password
      var hash = bcrypt.hashSync(model.get('password'), salt);
      // store hash in database
      model.set({salt: salt, password: hash});
    });
  }

});

module.exports = User;