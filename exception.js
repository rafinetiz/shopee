
module.exports.InvalidUrlException = class InvalidUrlException extends Error {
    constructor() {
        super('URL TIDAK VALID')
        this.code = 'ERRURLINVALID'
    }
}

module.exports.CheckoutFailed = class CheckoutFailed extends Error {
    constructor(str) {
        super(str)
        this.code = 'ERRCHECKOUTFAILED'
    }
}