var net = require('net'),
	async = require('async'),
	Protocol = require('./protocol').Protocol,
	EventEmitter = require('events').EventEmitter,
	Transactions = require('./transactions'),
	DoozerError = require('./err'),
	qs = require('querystring'),
	uriPrefix = 'doozer:?',
	inherits = require('util').inherits

var closedSocket = {
	write: function () {
		console.log("Not connected")
	},
	end: function () {}
}

function Connection (client) {
	this.client = client
	this.txns = new Transactions()
	this.protocol = new Protocol()
	this.protocol.on('response', handleResponse.bind(this))
}
inherits(Connection, EventEmitter)

Connection.dial = function (port, host, cb) {
	if (typeof port === 'string') {
		var addr = port.split(':')
		port = addr.length === 2 ? +(addr[1]) : 8046
		cb = host
		host = addr[0]
	}
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

	var self = new Connection(client)
	if (typeof cb === 'function') {
		self.on('connect', cb)
	}
	return self
}

function dialSecret(addr, secret, cb) {
	if (Array.isArray(addr)) {
		addr = addr[Math.floor(Math.random() * addr.length)]
	}
	Connection.dial(addr, function () {
		var self = this
		if (secret) {
			this.access(secret, function (err, resp) {
				if (err) {
					self.close()
					return cb(err)
				}
				cb.call(self)
			})
		}
		else {
			cb.call(self)
		}
	})
}

Connection.dialUri = function (uri, buri /*optional*/, cb) {
	if (arguments.length === 2) {
		cb = buri
	}
	if (uri.indexOf(uriPrefix) !== 0) {
		cb(new Error("Invalid Uri"))
		return
	}
	var q = uri.substr(uriPrefix.length)
	var p = qs.parse(q)
	var name = p.cn
	if (name && buri) {
		Connection.dialUri(buri, function () {
			var self = this
			this.lookup(name, function (err, addrs) {
				self.close()
				if (err) {
					return cb(err)
				}
				dialSecret(addrs, p.sk, cb)
			})
		})
	}
	else {
		var addrs = p.ca
		dialSecret(addrs, p.sk, cb)
	}
}

function handleResponse(resp) {
	var err
	if (resp.errCode) {
		err = new DoozerError(resp.errDetail, resp.errCode)
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

Connection.prototype.close = function () {
	this.client.end()
	this.client = closedSocket
}

Connection.prototype.lookup = function (name, cb) {
	var self = this
	var r = 0
	async.waterfall([
		function (next) {
			self.rev(next)
		},
		function (rev, next) {
			r = rev
			self.getDir('/ctl/ns/' + name, 0, -1, rev, next)
		},
		function (names, next) {
			async.map(
				names,
				function (n, nxt) {
					self.get('/ctl/ns/' + name + '/' + n, r, nxt)
				},
				function (err, addrs) {
					next(err, addrs)
				})
		},
		function (addrs, next) {
			cb(null, addrs.map(function (a) { return a.toString() }))
			next()
		}
		],
		function (err) {
			if (err) {
				cb(err)
			}
		})
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
		if (err) {
			return cb(err)
		}
		cb(err, resp.rev)
	})
}

Connection.prototype.del = function (path, rev, cb) {
	var msg = {
		verb: 'DEL',
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
	this.getDir(dir, offset, limit, rev, function (err, names) {
		if (err) {
			return cb(err)
		}
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

function basename(path) {
	return path.substr(path.lastIndexOf('/') + 1)
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
			name: basename(path),
			isSet: true,
			isDir: srev === -2
		}
		return cb(err, f)
	})
}

Connection.prototype.find = function (path, cb) {
	var self = this
	var v = {
		visitDir: function (path, info) {
			console.log(path)
			return true
		},
		visitFile: function (path, info) {
			console.log(path)
		}
	}
	async.waterfall([
		function (next) {
			self.rev(next)
		},
		function (rev, next) {
			self.walk(path, rev, v, next)
		}
		],
		cb)
}

Connection.prototype.walk = function (root, rev, visitor, cb) {
	var self = this
	this.statInfo(root, rev,
		function (err, info) {
			if (err) {
				return cb(err)
			}
			self._walk(root, rev, info, visitor, cb)
		}
	)
}

Connection.prototype._walk = function (path, rev, info, visitor, cb) {
	var self = this
	if (!info.isDir) {
		visitor.visitFile(path, info)
		return cb()
	}

	if (!visitor.visitDir(path, info)) {
		return cb()
	}

	this.getDirInfo(path, 0, -1, rev,
		function (err, dirinfo) {
			if (err) {
				console.error(path + ' ' + err)
				return cb()
			}
			if (path !== '/') path += '/'

			async.forEachSeries(
				dirinfo,
				function (nfo, next) {
					self._walk(path + nfo.name, rev, nfo, visitor, next)
				},
				function (err) {
					cb()
				}
			)
		}
	)
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
