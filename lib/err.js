var inherits = require('util').inherits

function DoozerError(msg, code) {
  this.code = code
  Error.call(this, msg)
}
inherits(DoozerError, Error)

module.exports = DoozerError
