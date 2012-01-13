var net = require('net'),
	Protocol = require('./protocol').Protocol,
	EventEmitter = require('events').EventEmitter,
	Transactions = require('./transactions'),
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
	var client = net.connect(port, host, function (err) {
		self.emit('connect')
	})
	client.on('data', function (data) {
		self.protocol.append(data)
	})
	client.on('end', function () {
		console.log('end')
	})
	client.on('timeout', function () {
		console.log('timeout')
	})
	client.on('drain', function () {
		client.resume()
	})
	client.on('close', function () {
		console.log('close')
		self.client = closedSocket
	})
	client.on('error', function (err) {
		console.log(err)
	})
	this.client = client;
	if (typeof cb === 'function') {
		this.on('connect', cb)
	}
}

Connection.prototype.handleResponse = function (resp) {
	if (resp.tag) {
		this.txns.exec(resp.tag, resp)
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
	this.call(msg, function (resp) {
		cb(resp.rev)
	})
}

Connection.prototype.del = function (path, rev, cb) {
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

Connection.prototype.get = function (path, rev, cb) {
	var msg = {
		verb: 'GET',
		path: path,
		rev: rev
	}
	this.call(msg, function (resp) {
		cb(resp.value, resp.rev)
	})
}

Connection.prototype.getDir = function (dir, rev, offset, limit, cb) {
	var names = []
	async.whilst(
		function () { return limit !== 0 },
		function (next) {
			var msg = {
				verb: 'GETDIR',
				path: dir,
				rev: rev,
				offset: offset
			}
			this.call(msg,
				function (resp) {
					if (resp.errCode) {
						if (resp.errCode === 'RANGE') {
							next(new Error('Done'))
						}
						else {
							next(new Error(resp.errDetail))
						}
					}
					names.push(resp.path)
					offset++
					limit--
					next()
				}
			)
		},
		function (err) {
			if (err.message !== 'Done') {
				return cb(err)
			}
			cb(names)
		}
	)
}

Connection.prototype.getDirInfo = function (dir, rev, offset, limit, cb) {
	var self = this, info = []
	this.getDir(dir, rev, offset, limit, function (names) {
		if (dir !== '/') {
			dir += '/'
		}
		async.forEachSeries(
			names,
			function (name, next) {
				self.statInfo(dir + name, rev, function (err, fileInfo) {
					if (err) {
						info.push(name)
					}
					else {
						info.push(fileInfo)
					}
				})
			},
			function (err) {
				cb(err, info)
			})
	})
}

Connection.prototype.stat = function (path, rev, cb) {
	var msg = {
		verb: 'STAT',
		path: path,
		rev: rev
	}
	this.call(msg, function (resp) {
		cb(resp.len, resp.rev)
	})
}

Connection.prototype.statInfo = function (path, rev, cb) {
	//TODO implement. see conn.go 383
	this.stat(path, rev, function (len, srev) {
		var f = {
			len: len,
			rev: srev,
			name: path, //TODO: basename
			isSet: true //TODO: dir?
		}
	})
}

Connection.prototype.walk = function (glob, rev, offset, limit, cb) {
	// TODO implement. see conn.go 419
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
	this.call(msg, function (resp) {
		cb(resp.rev)
	})
}

module.exports = Connection
