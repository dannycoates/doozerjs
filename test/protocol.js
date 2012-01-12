var fs = require('fs'),
	assert = require('assert'),
	Protocol = require('../lib/protocol').Protocol,
	Response = require('../lib/protocol').Response

var r = {
	tag: 1,
	flags: 2,
	rev: 3,
	path: '/foo/bar',
	errCode: 4,
	errDetail: "blah"
}

var b = Response.serialize(r)

var p = new Protocol();
p.on('response', function (r) {
	console.error(r)
})

console.error(b.length)

var lb = new Buffer(4);
lb.writeInt32BE(b.length, 0)

var b1 = b.slice(0,3)
var b2 = b.slice(3)


var s1 = lb.slice(0,1)
var s2 = lb.slice(1,3)
var s3 = lb.slice(3,4)

p.append(s1)
p.append(s2)
p.append(s3)
p.append(b1)
p.append(b2)

p.append(lb)
p.append(b)

p.append(s1)
p.append(s2)
p.append(s3)
p.append(b1)
p.append(b2)

p.append(lb)
p.append(b)