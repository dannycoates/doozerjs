var net = require('net'),
	Protocol = require('./protocol'),
	EventEmitter = require('events').EventEmitter,
	inherits = require('util').inherits

function Connection () {
	var self = this
	this.protocol = new Protocol()
	this.protocol.on('response', function (res) {
		self.emit('response', res)
	})
}
inherits(Connection, EventEmitter)

Connection.prototype.connect = function (port, host) {
	var self = this
	var client = net.connect(port, host, function (err) {
		self.emit('connect')
	})
	client.on('data', function (data) {
		self.protocol.append(data)
	})
	client.on('end', function () {
		console.log('disconnected')
	})
	client.on('timeout', function () {
		console.log('timeout')
	})
	client.on('drain', function () {
		client.resume()
	})
	client.on('close', function () {
		console.log('close')
	})
	client.on('error', function (err) {
		console.log(err)
	})
}
