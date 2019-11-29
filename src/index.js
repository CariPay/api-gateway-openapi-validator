const OpenApiLoader = require('./openApiLoader');
const RequestValidator = require('./openApiRequestValidator');
const { ValidationError } = require('./errors');
const { TYPE_JSON } = require('./constants');

module.exports = class OpenApiValidator {
    constructor(params, lambdaBody) {
        if (!params.apiSpec) {
            throw Error('Missing requred API spec path');
        }
        this.apiSpec = params.apiSpec;
        this.additionalProperties = params.additionalProperties || {};
        this.contentType = params.contentType || TYPE_JSON;
        this.validateRequests = params.validateRequests || false;
        this.validateResponses = params.validateResponses || false;
        this.requestBodyTransformer = params.requestBodyTransformer;
        this.requestPathTransformer = params.requestPathTransformer;
        this.requestQueryTransformer = params.requestQueryTransformer;
        this.responseTransformer = params.responseTransformer;
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
                    this._validateRequests(path, this.event, this.config);
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
    
                let response = await this.lambdaBody(event, context, callback);
    
                if (this.responseTransformer) {
                    const transformedResponse = this.requestTransformer(response);
                    response = {
                        ...response,
                        ...transformedResponse,
                    };
                }
                callback(null, {
                    body: response,
                    statusCode: 200,
                });
            } catch (error) {
                callback(null, {
                    message: error.message,
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
                    nullable: true,
                    removeAdditional: false,
                    additionalProperties: this.additionalProperties,
                },
                schema);
            const request = {
                body: (event.body && JSON.parse(event.body)) || {},
                query: event.queryStringParameters || {},
                headers: event.headers || {},
                params: event.pathParameters || {},
            };
            requestValidator.validate(path, request, schema);
        }
    }
}