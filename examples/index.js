const OpenApiValidator = require('../src');

const filePath = './examples/swagger.json';
const path = '/id_ocr';
const httpMethod = 'POST';

const validator = new OpenApiValidator({
    apiSpec: filePath,
    validateRequests: true,
});

validator.install({
    httpMethod, path,
});

// console.log(validator);






