var net = require('net'),
	async = require('async'),
	Protocol = require('./protocol').Protocol,
	EventEmitter = require('events').EventEmitter,
	Transactions = require('./transactions'),
	DoozerError = require('./err'),
	inherits = require('util').inherits

var closedSocket = {
	write: function () {
		console.log("Not connected")
	}
}

function Connection () {
	var self = this
	this.client = closedSocket
	this.txns = new Transactions()
	this.protocol = new Protocol()
	this.protocol.on('response', this.handleResponse.bind(this))
}
inherits(Connection, EventEmitter)

Connection.prototype.dial = function (port, host, cb) {
	var self = this
	var client = net.connect(port, host,
		function (err) {
			self.emit('connect')
		}
	)
	client
		.on('data', function (data) {
			self.protocol.append(data)
		})
		.on('end', function () {
			console.log('end')
		})
		.on('close', function () {
			console.log('close')
			self.client = closedSocket
		})
		.on('error', function (err) {
			console.log(err)
		})
	this.client = client;
	if (typeof cb === 'function') {
		this.on('connect', cb)
	}
}

Connection.prototype.handleResponse = function (resp) {
	var err
	if (resp.errCode) {
		err = new DoozerError(resp.errDetail, errCode)
	}
	if (resp.tag) {
		this.txns.exec(resp.tag, err, resp)
	}
	else {
		console.log(resp)
	}
}

Connection.prototype.call = function (msg, cb) {
	msg.tag = this.txns.add(cb)
	this.protocol.write(this.client, msg)
}

Connection.prototype.access = function (token, cb) {
	var msg = {
		verb: 'ACCESS',
		value: token
	}
	this.call(msg, cb)
}

Connection.prototype.set = function (path, oldRev, value, cb) {
	//TODO: test different value types
	var msg = {
		verb: 'SET',
		path: path,
		value: value,
		rev: oldRev
	}
	this.call(msg, function (err, resp) {
		cb(err, resp.rev)
	})
}

Connection.prototype.del = function (path, rev /*optional*/, cb) {
	if (arguments.length === 2) {
		cb = rev
		rev = null
	}
	var msg = {
		verb: 'GET',
		path: path,
		rev: rev
	}
	this.call(msg, cb)
}

Connection.prototype.nop = function (cb) {
	var msg = {
		verb: 'NOP'
	}
	this.call(msg, cb)
}

Connection.prototype.get = function (path, rev /*optional*/, cb) {
	if (arguments.length === 2) {
		cb = rev
		rev = null
	}
	var msg = {
		verb: 'GET',
		path: path,
		rev: rev
	}
	this.call(msg, function (err, resp) {
		cb(err, resp.value, resp.rev)
	})
}

Connection.prototype.getDir = function (dir, offset, limit, rev /*optional*/, cb) {
	if (arguments.length === 4) {
		cb = rev
		rev = null
	}
	var names = [], self = this
	async.whilst(
		function () { return limit !== 0 },
		function (next) {
			var msg = {
				verb: 'GETDIR',
				path: dir,
				rev: rev,
				offset: offset
			}
			self.call(msg,
				function (err, resp) {
					if (err) {
						return next(err)
					}
					offset++
					limit--
					names.push(resp.path)
					next()
				}
			)
		},
		function (err) {
			if (err && err.code !== 'RANGE') {
				return cb(err)
			}
			cb(null, names)
		}
	)
}

Connection.prototype.getDirInfo = function (dir, offset, limit, rev /*optional*/, cb) {
	if (arguments.length === 4) {
		cb = rev
		rev = null
	}
	var self = this, info = []
	this.getDir(dir, rev, offset, limit, function (err, names) {
		if (err) {
			return cb(err)
		}
		if (dir !== '/') {
			dir += '/'
		}
		async.forEach(
			names,
			function (name, next) {
				self.statInfo(dir + name, rev, function (err, fileInfo) {
					if (err) {
						info.push(name)
					}
					else {
						info.push(fileInfo)
					}
					next()
				})
			},
			function (err) {
				cb(err, info)
			})
	})
}

Connection.prototype.stat = function (path, rev /*optional*/, cb) {
	if (arguments.length === 2) {
		cb = rev
		rev = null
	}
	var msg = {
		verb: 'STAT',
		path: path,
		rev: rev
	}
	this.call(msg, function (err, resp) {
		cb(err, resp.len, resp.rev)
	})
}

Connection.prototype.statInfo = function (path, rev /*optional*/, cb) {
	if (arguments.length === 2) {
		cb = rev
		rev = null
	}
	this.stat(path, rev, function (err, len, srev) {
		var f = {
			len: len,
			rev: srev,
			name: path, //TODO: basename
			isSet: true,
			isDir: srev === -2
		}
		return cb(err, f)
	})
}

Connection.prototype.walk = function (glob, rev, offset, limit, cb) {
	// TODO implement. see conn.go 419
	cb(new Error("Not Implemented"))
}

Connection.prototype.wait = function (glob, rev, cb) {
	var msg = {
		verb: 'WAIT',
		path: glob,
		rev: rev
	}
	this.call(msg, cb)
}

Connection.prototype.rev = function (cb) {
	var msg = {
		verb: 'REV'
	}
	this.call(msg, function (err, resp) {
		cb(err, resp.rev)
	})
}

Connection.prototype.touch = function (path, cb) {
	var self = this
	this.get(path,
		function (err, val, rev) {
			if (err) {
				return cb(err)
			}
			self.set(path, rev, val, cb)
		}
	)
}

module.exports = Connection
