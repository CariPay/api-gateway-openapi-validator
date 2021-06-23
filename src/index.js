const find = require('lodash/find');
const get = require('lodash/get');
const OpenApiLoader = require('./openApiLoader');
const RequestValidator = require('./openApiRequestValidator');
const ResponseValidator = require('./openApiResponseValidator');
const { ValidationError } = require('./errors');
const { isJson } = require('./utils');
const { comparePathToSpecPath } = require('./helpers');
const { TYPE_JSON } = require('./constants');

module.exports = class OpenApiValidator {
    constructor(params, lambdaBody) {
        if (!params.apiSpec || !isJson(params.apiSpec)) {
            throw Error('API spec not found or invalid');
        }
        this.apiSpec = params.apiSpec;
        this.contentType = params.contentType || TYPE_JSON;
        this.validateSpec = params.validateSpec || true;
        this.validateRequests = params.validateRequests || false;
        this.validateResponses = params.validateResponses || false;
        this.requestBodyTransformer = params.requestBodyTransformer;
        this.requestPathTransformer = params.requestPathTransformer;
        this.requestQueryTransformer = params.requestQueryTransformer;
        this.responseSuccessTransformer = params.responseSuccessTransformer;
        this.responseErrorTransformer = params.responseErrorTransformer;
        this.removeAdditionalRequestProps = params.removeAdditionalRequestProps || false;
        this.removeAdditionalResponseProps = params.removeAdditionalResponseProps || false;
        this.lambdaSetup = params.lambdaSetup;
        this.lambdaTearDown = params.lambdaTearDown;
        this.roleAuthorizerKey = params.roleAuthorizerKey || null;
        this.filterByRole = params.filterByRole || false;
        this.useDefaults = params.useDefaults || false;
        this.defaultRoleName = params.defaultRoleName || 'default';
        this.config = {};
        this.lambdaBody = lambdaBody;
    }

    install () {
        return async (event, context, callback) => {
            try {
                if (isJson(event.body)) {
                    event.body = JSON.parse(event.body);
                }
                this.event = event;
    
                const { paths } = this.apiSpec;
                const {
                    body,
                    httpMethod,
                    path,
                    pathParameters,
                    queryStringParameters,
                } = this.event;
                const httpMethodLower = httpMethod.toLowerCase();

                if (this.validateRequests || this.validateResponses) {
                
                    if (paths[path] && paths[path][httpMethodLower]) {
                        this.config = paths[path][httpMethodLower];
                    }
                    else {
                        const pathKeys = Object.keys(paths);
                        // Converts accounts/{uuid} to accounts/[a-zA-z0-9-] to find key
                        const foundKey = find(pathKeys, key => {
                            // The key should always contain a-zA-Z only but also accomodate for numbers if necessary and nothing else
                            const compare = comparePathToSpecPath(key, path);
                            return compare && paths[key][httpMethodLower];
                        });
                        if (foundKey) {
                            this.config = paths[foundKey][httpMethodLower];
                        }
                        else {
                            throw new ValidationError(`The path ${path} could not be found with http method ${httpMethodLower} in the API spec`, 400);
                        }
                    }
                    // Add the swagger spec for the individual route to the event
                    this.event.routeConfig = this.config;

                    // Add additional configuration containing resource limit or metadata
                    this.event.resources = this.config['x-resources'] || [];
                }
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

                if (this.lambdaSetup) {
                    const lambdaSetup = await this.lambdaSetup(event, context);
                    this.event.setupData = lambdaSetup;
                }
    
                const lambdaResponse = await this.lambdaBody(event, context, callback);
                // Response from lambda should return an array containing the response and statusCode
                // It is expected that the lambda handles errors accordingly to return the correct status code and response
                let [ response, statusCode, message='' ] = lambdaResponse;

                if (this.lambdaTearDown) {
                    response = await this.lambdaTearDown(event, context, response);
                }
    
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

                if (this.validateResponses || this.filterByRole) {
                    let filteredResponse = null;
                    if (this.filterByRole && this.roleAuthorizerKey){
                        // Get role for requestContenxt > authorizer > roleKey
                        // if it doesn't exist for the user, use the default role
                        const role = get(event, `requestContext.authorizer.claims.${this.roleAuthorizerKey}`, event.requestContext.authorizer.claims[this.defaultRoleName]);
                        filteredResponse = this._validateResponses(path, responseToValidate, this.config, statusCode, role);
                    } else {
                        filteredResponse = this._validateResponses(path, responseToValidate, this.config, statusCode);
                    }
                    // Replace the content of the response by filtering based on the documentation
                    Object.assign(response, { body: converted ? JSON.stringify(filteredResponse) : filteredResponse });
                }
                
                callback(null, response);
            } catch (error) {
                // Log the error so it can be show in cloudwatch
                console.log(`[VALIDATOR ERROR]: ${error.message}`);
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
                this.apiSpec,
                {
                    coerceTypes: true,
                    nullable: true,
                    removeAdditional: this.removeAdditionalRequestProps,
                    strictRequired: true,
                    useDefault: this.useDefaults,
                },
                schema);
            const request = {
                body: event.body || {},
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

    _validateResponses (path, response, schema, statusCode, role = null) {
        if (schema) {
            const responseValidator = new ResponseValidator(
                this.apiSpec,
                {
                    coerceTypes: true,
                    nullable: true,
                    removeAdditional: this.removeAdditionalResponseProps,
                    strictRequired: 'log',
                },
                schema,
                role);
            responseValidator.validate(path, response, statusCode);

        }
        // @NOTE: ajv validator replaces the response with the sanitized data
        return response;
    }

    _constructDefaultResponse (response, statusCode) {
        const body = isJson(response) ? JSON.stringify(response) : response;
        return {
            body,
            statusCode,
        };
    }
}