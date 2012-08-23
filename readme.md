[![build status](https://secure.travis-ci.org/dannycoates/doozerjs.png)](http://travis-ci.org/dannycoates/doozerjs)
# Doozer.js

A node.js client driver for [Doozer](https://github.com/ha/doozerd)

## Requirements

Doozer.js requires the `pbuf` Protocol Buffers module, which requires [protobuf](http://code.google.com/p/protobuf/downloads/list) to be installed in `/usr/local`

## Usage

Add `doozer` to your package.json

```js
{
	"dependencies": {
		"doozer": "~0.1"
	}
}
```

Then:

```js
var Doozer = require('doozer')
```

## API

### Doozer.dial(port, host, [callback])

Connect to a Doozerd server on the given host and port. Returns a Doozer connection object.

__Arguments__

* port - server port number to connect to.
* host - server host to connect to. Either an IP string or host name
* callback() - An _optional_ callback for the 'connect' event.

__Example__

```js
Doozer.dial(8046, "localhost", function () {
	console.log("connected to Doozer")
});
```

---------------------------------------

### Doozer.dial(address, [callback])

Same as above except address is a string like `"localhost:8047"`. If no port is given 8046 will be assumed.

---------------------------------------

### Doozer.dialUri(uri, [buri], callback)

Connect to a Doozer cluster using a `doozer:?` uri string, optionally using DzNS for node lookup. See [Doozer URIs](https://github.com/ha/doozerd/blob/master/doc/uri.md) for details

Note, this function **DOES NOT** return a Doozer object. It is available as `this` in the callback.

__Arguments__

* uri - a "doozer:?" uri with either `ca` or `cn` parameters.
* buri - an optional "doozer:?" uri to the DzNS server
* callback(err) - A _required_ callback for the 'connect' event.

__Example__

```js
Doozer.dialUri("doozer:?cn=local", "doozer:?ca=10.0.1.5:8048", function (err) {
	this.rev(function(err, rev) {
		console.log(rev)
	})
})
```

### rev(callback)

Return the current rev number

__Arguments__

* callback(err, rev) - returns the rev number on success

---------------------------------------

### set(path, oldRev, value, callback)

Sets a value for the given file

__Arguments__

* path - path to the file to set
* oldRev - rev number this path had before
* value - the value to set
* callback(err, rev) - returns the new rev number on success

---------------------------------------

### get(path, [rev], callback)

Get the value at the given path

__Arguments__

* path - path to the file
* rev - _optional_ rev number of the value to get. Defaults to newest rev
* callback(err, value, rev) - returns the value and rev number on success

---------------------------------------

### del(path, rev, callback)

Delete the given path with the given rev number

__Arguments__

* path - the path to delete
* rev - the rev to delete
* callback(err, response)

---------------------------------------

### getDir(dir, offset, limit, [rev], callback)

Gets the names of the children of the given dir

__Arguments__

* dir - the path to a directory (must not be a file)
* offset - skips this number of child records, should usually be 0
* limit - max number of child names to return, use -1 for no limit
* rev - _optional_ rev number
* callback(err, names) - returns an array of child node names on success

---------------------------------------

### getDirInfo(dir, offset, limit, [rev], callback)

Like `getDir` except returns an array of `StatInfo` instead of names

---------------------------------------

### stat(path, [rev], callback)

Returns the file length and rev number at the given path

__Arguments__

* path - path to a file
* rev - _optional_ rev number
* callback(err, length, rev) - returns the length and rev on success

---------------------------------------

### statInfo(path, [rev], callback)

Return an object with stat information on the given path. A StatInfo contains:

* len
* rev
* name
* isSet
* isDir

__Arguments__

* path - path to a file or directory
* rev - _optional_ rev number
* callback(err, statInfo) - returns a statInfo object on success

---------------------------------------

### wait(glob, rev, callback)

Registers the given callback to be called when a file covered by glob meets or exceeds the given rev.

__Arguments__

* glob - a path pattern to watch. see [Glob Notation](https://github.com/ha/doozerd/blob/master/doc/proto.md)
* rev - the rev to watch for
* callback(err, response)

---------------------------------------

### close()

Closes the connection to Doozer

---------------------------------------