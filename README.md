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
    "api-gateway-openapi-validator": "git://github.com/CariPay/api-gateway-openapi-validator.git#branch_name" 
}
```

## Usage

```js
const OpenApiValidator = require('api-gateway-openapi-validator');
const camelCase = require('./camelCase');

const options = {
    apiSpec: './swagger.json',
    filterByRole: true,
    validateRequests: true,
    validateResponses: true,
    roleAuthorizerKey: 'custom:role',
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

    - apiSpec: The open api documentation to use for validation in json format(required, must be v3)
    - defaultRoleName: The default role to use if a user does not have a role in the event authorizer property. (`default: default`) **See example in /examples.
    - filterByRole: Whether the validator should use a role specified in the event's authorizer property to filter results based on data in the openapi documentation. (`default: false`) **See example in /examples.
    - lambdaSetup: Handle async data before running the main lambda code and return the response back to the lambda in the event. Can be used to get and update authentication data.
    - lambdaTearDown: Handle async after running the main lambda code. Can be used to update authentication.
    - removeAdditionalRequestProps: Whether additional properties not contained in the documentation's schema should be accepted and be removed. See https://ajv.js.org/#options for more information.
    - removeAdditionalResponseProps: Whether additional properties not contained in the documentation's schema should be accepted and be removed. See https://ajv.js.org/#options for more information.
    - contentType: The default content format used in a request and response (default: application/json)
    - requestBodyTransformer: Function used to transform the body of a request (`argument: body obtained from event.body, returns: transformed response`)
    - requestPathTransformer: Function used to transform the body of a request (`argument: path obtained from event.pathParameters, returns: transformed response`)
    - requestQueryTransformer: Function used to transform the body of a request (`argument: query obtained from event.queryStringParameters, returns: transformed response`)
    - responseErrorTransformer: Function used to transform the body of a request (`argument: response from lambda, statusCode, message; returns: transformed response`). **See note below.
    - responseSuccessTransformer: Function used to transform the body of a request (`argument: response from lambda, statusCode; returns: transformed response`) **See note below
    - roleAuthorizerKey: The key used to access the role property from a user in the event authorizer property. **See example in /examples.
    - validateRequests: Whether or not to validate the request body, params, query, headers to the api documentation included (`default: false`)
    - validateResponses: Whether or not to validate the response to the api documentation included (`default: false`)

    ***
    Note: If specifying a response transformer, it should be noted that you are responsible for returning a response in a format required by api gateway to resolve the request.

        ```js
        // Example
        return {
            body: JSON.stringify(transformedResponse),
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            statusCode: 200,
        }
        ```
    - validateSpec: Whether or not to validate the api spec before being used in other parts in the validator. (`default: true`)
    ***
    Note: Unvalidated spec can decrease the security of the validator. Only set `validateSpec to false` if you have verified that the spec is indeed a validated openapi v3 document before being used. View more here: https://www.npmjs.com/package/ajv#security-considerations
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

## Disclaimer

Validation of the apiSpec is an important step for the security of our apis but increases the response time of the lambda execution significantly. As such, document validation was removed from the functional execution of the library, but code still exist to help with validating the input. If document validation is important to your use case, feel free to fork this project and use the code here: [./src/openApiLoader](./src/openApiLoader) to extend [./src/index.js](./src/index.js).

This step was added to the build step of our external projects to ensure that the schema used were always validated and could be replicated for similar projects while reducing the need to validate the documentation on lambda invocation.