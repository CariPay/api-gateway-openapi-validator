# API Gateway OpenAPI Validation

## Description

Provide request and response validation using swagger open api documentation for APIs' developed using API Gateway lambdas in a nodejs environment. The inspiration for this project was taken from [express-openapi-validator](https://github.com/cdimascio/express-openapi-validator).

## Features

- Request and response validation using swagger generated documentation.
- Security validation
- Request and response transfomation or parsing.

## Install

```bash
npm i api-gateway-openapi-validator
```

or

Attach the following to the dependencies of your package.json.
```json
{
    "api-gateway-openapi-validator": "git://github.com/CariPay/api-gateway-openapi-validator.git" 
}
```

## Usage

```js
const OpenApiValidator = require('api-gateway-openapi-validator');
const camelCase = require('./camelCase');

const options = {
    apiSpec: './swagger.json',
    validateRequests: true,
    validateResponses: true,
    requestBodyTransformer: (body) => {
        return camelCase(body);
    },
};

const handler = (event, context) => {
    // event, and context are retained as in a default lambda function

    // Lambda Code here

    // You are required to handle exceptions and return the statusCodes to use, else the a default response will be returned with a statusCode of 500

    // response - The response to return by the api (required)
    // statusCode - The statusCode to use in the api response (defaults to 200)
    // message - An error message to include if the response was not successful (optional)
    return [ response, statusCode, message ]
};

exports.handler = new OpenApiValidator(options, handler).install();
```

### Parameters

- options: `<Object>`: Parameters used to customize the validator

    - apiSpec: The path to the open api documentation to use for validation (required, must be v3)
    - removeAdditional: Whether additional properties not contained in the documentation's schema should be accepted and removed for all request types and responses
    - contentType: The default content format used in a request and response (default: application/json)
    - requestBodyTransformer: Function used to transform the body of a request (`argument: body obtained from event.body, returns: transformed response`)
    - requestPathTransformer: Function used to transform the body of a request (`argument: path obtained from event.pathParameters, returns: transformed response`)
    - requestQueryTransformer: Function used to transform the body of a request (`argument: query obtained from event.queryStringParameters, returns: transformed response`)
    - responseErrorTransformer: Function used to transform the body of a request (`argument: response from lambda, statusCode, message; returns: transformed response`)
    - responseSuccessTransformer: Function used to transform the body of a request (`argument: response from lambda, statusCode; returns: transformed response`)
    - validateRequests: Whether or not to validate the request body, params, query, headers to the api documentation included (`default: false`)
    - validateResponses: Whether or not to validate the response to the api documentation included (`default: false`)
- handler: `<Function>`: Main functionality of the API code
    #### Arguments
    - event: Provides information about the request (path, headers, body, etc)
    - context: Provides methods and properties that provide information about the invocation, function, and execution environment

    #### Returns
    - response: Content contained in a successful request (required)
    - statusCode: The status code to use when sending a response (default: 200, required if message is used)
    - message: The message to send in a response body if there is an error

## Example

You can try out the example implementation of the validator locally by reading the implementation and setup docs [here](./examples/README.md).