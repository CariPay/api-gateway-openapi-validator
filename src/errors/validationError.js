module.exports = class ValidationError extends Error {
    constructor(message, statusCode=500) {
        super();
        this.message = message;
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}