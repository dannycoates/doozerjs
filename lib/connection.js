var net = require('net'),
	Protocol = require('./protocol').Protocol,
	EventEmitter = require('events').EventEmitter,
	inherits = require('util').inherits

var closedSocket = {
	write: function () {
		console.log("Not connected")
	}
}

function Connection () {
	var self = this
	this.client = closedSocket
	this.protocol = new Protocol()
	this.protocol.on('response', function (res) {
		self.emit('response', res)
	})
}
inherits(Connection, EventEmitter)

Connection.prototype.connect = function (port, host, cb) {
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

Connection.prototype.send = function (msg) {
	this.protocol.write(this.client, msg)
}

module.exports = Connection