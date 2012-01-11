var fs = require('fs'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	inherits = require('util').inherits,
	Schema = require('pbuf').Schema,
	schema = new Schema(fs.readFileSync(path.join(__dirname, '../schema/msg.desc'))),
	Request = schema['doozer.Request'],
	Response = schema['doozer.Response']

function SizeBuffer() {
	this.buffer = new Buffer(4)
	this.index = 0
}

function Protocol () {
	this.state = 'fresh'
	this.sizeBuffer = new SizeBuffer()
	this.buffer = null
	this.index = 0
}
inherits(Protocol, EventEmitter)

Protocol.prototype.append = function (buf) {
	if (buf.length === 0) return
	if (this.state === 'fresh') {
		if (buf.length > 3) {
			var size = buf.readInt32BE(0)
			buf = buf.slice(4)
			this.buffer = new Buffer(size)
			this.state = 'receiving'
		}
		else {
			this.state = 'size'
		}
	}
	if (this.state === 'size') {
		var left = this.sizeBuffer.buffer.length - this.sizeBuffer.index
		var extra = buf.length - left
		var copied = Math.min(buf.length, left)
		buf.copy(this.sizeBuffer.buffer, this.sizeBuffer.index, 0, copied)
		this.sizeBuffer.index += copied
		if (extra >= 0) {
			var size = this.sizeBuffer.buffer.readInt32BE(0)
			this.buffer = new Buffer(size)
			this.sizeBuffer.index = 0
			buf = buf.slice(copied)
			this.state = 'receiving'
		}
	}
	if (this.state === 'receiving') {
		var copied = Math.min(buf.length, this.buffer.length)
		buf.copy(this.buffer, this.index, 0, copied)
		this.index += copied
		if (this.index === this.buffer.length) {
			var r = Response.parse(this.buffer)
			this.emit('response', r)
			this.buffer = null
			this.index = 0
			this.state = 'fresh'
			buf = buf.slice(copied)
		}
	}
	if (this.state === 'fresh') {
		this.append(buf)
	}
}

exports.Request = Request
exports.Response = Response
exports.Protocol = Protocol