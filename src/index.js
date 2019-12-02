const OpenApiLoader = require('./openApiLoader');
const RequestValidator = require('./openApiRequestValidator');
const ResponseValidator = require('./openApiResponseValidator');
const { ValidationError } = require('./errors');
const { isJson } = require('./utils');
const { TYPE_JSON } = require('./constants');

module.exports = class OpenApiValidator {
    constructor(params, lambdaBody) {
        if (!params.apiSpec) {
            throw Error('Missing requred API spec path');
        }
        this.apiSpec = params.apiSpec;
        this.contentType = params.contentType || TYPE_JSON;
        this.validateRequests = params.validateRequests || false;
        this.validateResponses = params.validateResponses || false;
        this.requestBodyTransformer = params.requestBodyTransformer;
        this.requestPathTransformer = params.requestPathTransformer;
        this.requestQueryTransformer = params.requestQueryTransformer;
        this.responseSuccessTransformer = params.responseSuccessTransformer;
        this.responseErrorTransformer = params.responseErrorTransformer;
        this.removeAdditional = params.removeAdditional === undefined
            ? false
            : params.removeAdditional;
        this.apiDoc = {}
        this.config = {};
        this.lambdaBody = lambdaBody;
    }

    install () {
        return async (event, context, callback) => {
            try {
                const loader = new OpenApiLoader({
                    filePath: this.apiSpec,
                });
                this.apiDoc = await loader.getDoc();
                this.event = event;
    
                const { paths } = this.apiDoc;
                const {
                    body,
                    httpMethod,
                    path,
                    pathParameters,
                    queryStringParameters,
                } = this.event;
                const httpMethodLower = httpMethod.toLowerCase();
    
                if (!paths[path] || !paths[path][httpMethodLower]) {
                    throw new ValidationError(`The path ${path} could not be found with http method ${httpMethodLower} in the API spec`, 400);
                }
                this.config = paths[path][httpMethodLower];
    
                // Validate Requests
                if (this.validateRequests) {
                    const filteredRequest = this._validateRequests(path, this.event, this.config);
                    
                    // Replace the properties of the event with the filtered ones (body, queryParams, pathParams)
                    Object.assign(this.event, filteredRequest);
                }
                // Transform Requests
                if (this.requestBodyTransformer) {
                    const transformedBody = this.requestBodyTransformer(body || {});
                    this.event.body = transformedBody;
                }
                if (this.requestPathTransformer) {
                    const transformedPath = this.requestPathTransformer(pathParameters || {});
                    this.event.pathParameters = transformedPath;
                }
                if (this.requestQueryTransformer) {
                    const transformedQuery = this.requestQueryTransformer(queryStringParameters || {});
                    this.event.queryStringParameters = transformedQuery;
                }
    
                const lambdaResponse = await this.lambdaBody(event, context, callback);
                // Response from lambda should return an array containing the response and statusCode
                // It is expected that the lambda handles errors accordingly to return the correct status code and response
                let [ response, statusCode, message='' ] = lambdaResponse;
    
                // Informational and Success responses use the success transformer
                if (statusCode < 300) {
                    if (this.responseSuccessTransformer) {
                        response = this.responseSuccessTransformer(response, statusCode);
                    } else {
                        response = this._constructDefaultResponse(response, statusCode);
                        
                    }
                } else if (this.responseErrorTransformer) {
                    response = this.responseErrorTransformer(response, statusCode, message);
                } else {
                    throw new ValidationError(message, statusCode);
                }

                // All responses require a body and statusCode where the body contains the response data
                if (!response.hasOwnProperty('body') || !response.hasOwnProperty('statusCode')) {
                    throw ValidationError('Response must contain a body and statusCode');
                }
    
                const responseBody = response.body;

                // Convert body to json if it's a string in json format in order to validate, else use the default value
                let responseToValidate = responseBody;
                let converted = false;

                if (isJson(responseBody)) {
                    responseToValidate = JSON.parse(responseBody);
                    converted = true;
                }

                if (this.validateResponses) {
                    const filteredResponse = this._validateResponses(path, responseToValidate, this.config, statusCode);
                    // Replace the content of the response by filtering based on the documentation
                    Object.assign(response, { body: converted ? JSON.stringify(filteredResponse) : filteredResponse });
                }
                
                callback(null, response);
            } catch (error) {
                console.log(error);
                callback(null, {
                    body: JSON.stringify({ message: error.message }),
                    statusCode: error.statusCode || 500,
                });
            }

        }
    }

    _validateRequests (path, event, schema) {
        if (schema) {
            const requestValidator = new RequestValidator(
                this.apiDoc,
                {
                    removeAdditional: this.removeAdditional,
                },
                schema);
            const request = {
                body: (event.body && JSON.parse(event.body)) || {},
                query: event.queryStringParameters || {},
                headers: event.headers || {},
                params: event.pathParameters || {},
            };
            requestValidator.validate(path, request);

            // @NOTE: ajv validator replaces the request with the sanitized data

            // Replace the request properties with the values after validation to ensure that the values are filtered
            return {
                body: request.body,
                queryStringParams: request.query,
                headers: request.headers,
                pathParameters: request.params,
            };
        }
    }

    _validateResponses (path, response, schema, statusCode) {
        if (schema) {
            const responseValidator = new ResponseValidator(
                this.apiDoc,
                {
                    removeAdditional: this.removeAdditional,
                },
                schema);
            responseValidator.validate(path, response, statusCode);

            // @NOTE: ajv validator replaces the response with the sanitized data
            return response;
        }
    }

    _constructDefaultResponse (response, statusCode) {
        const body = isJson(response) ? JSON.stringify(response) : response;
        return {
            body,
            statusCode,
        };
    }
}