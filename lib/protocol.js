var fs = require('fs'),
	path = require('path'),
	EventEmitter = require('events').EventEmitter,
	inherits = require('util').inherits,
	Schema = require('pbuf').Schema,
	schema = new Schema(fs.readFileSync(path.join(__dirname, '../schema/msg.desc'))),
	Request = schema['doozer.Request'],
	Response = schema['doozer.Response']

function SizeState(buf) {
	this.sizeBuf = new Buffer(4)
	this.index = 0
	this.rest = buf
}

SizeState.prototype.next = function (buf) {
	var left = 4 - this.index
	var copied = Math.min(buf.length, left)
	buf.copy(this.sizeBuf, this.index, 0, copied)
	this.rest = buf.slice(copied)
	this.index += copied
	if (this.index === 4) {
		return new ReceivingState(this.sizeBuf.readInt32BE(0), this.rest)
	}
	return this
}

function ReceivingState(size, buf) {
	this.buffer = new Buffer(size)
	this.index = 0
	this.rest = buf
}

ReceivingState.prototype.next = function (buf) {
	var left = this.buffer.length - this.index
	var copied = Math.min(buf.length, left)
	buf.copy(this.buffer, this.index, 0, copied)
	this.rest = buf.slice(copied)
	this.index += copied
	if (this.index === this.buffer.length) {
		return new ResponseState(Response.parse(this.buffer), this.rest)
	}
	return this
}

function ResponseState(response, buf) {
	this.response = response
	this.rest = buf
}

ResponseState.prototype.next = function (buf) {
	return new SizeState(buf)
}

function Protocol () {
	this.state = new SizeState(new Buffer(0))
	this.sizeBuf = new Buffer(4)
}
inherits(Protocol, EventEmitter)

Protocol.prototype.append = function (buf) {
	while (buf.length > 0) {
		this.state = this.state.next(buf)
		buf = this.state.rest
		if (this.state instanceof ResponseState) {
			this.emit('response', this.state.response)
		}
	}
}

Protocol.prototype.write = function (stream, request) {
	var r = Request.serialize(request)
	this.sizeBuf.writeInt32BE(r.length, 0)
	stream.write(this.sizeBuf)
	stream.write(r)
}

exports.Protocol = Protocol
exports.Response = Response