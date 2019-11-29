const { Ajv } = require('ajv');

const { createRequestAjv } = require('./middleware/ajv');
const { augumentAjvErrors } = require('./utils');
const { ValidationError } = require('./errors');
const { TYPE_JSON } = require('./constants');

module.exports = class RequestValidator {
    constructor(apiDoc, options, schema) {
        this._apiDoc = apiDoc;
        this._options = options;
        this._schema = schema;
        this._ajv = createRequestAjv(apiDoc, options);
    }

    validate(path, request, schema, options = {}) {
        const {
            requestBody,
            parameters
        } = schema;
        const contentType = options.contentType || TYPE_JSON;

        const params = this.parametersToSchema(parameters);

        let body = {};
        const requiredAdds = [];
        if (requestBody && requestBody.hasOwnProperty('content')) {
            const reqBodyObject = requestBody;
            body = this.requestBodyToSchema(path, contentType, requestBody);
            if (requestBody.required) requiredAdds.push('body');
        }

        const apiSchema = {
            required: ['query', 'headers', 'params'].concat(requiredAdds),
            properties: {
                body,
                query: {},
                headers: {},
                params: {},
            },
        };

        const validator = this._ajv.compile(apiSchema);

        /**
         * support json in request params, query, headers and cookies
         * like this filter={"type":"t-shirt","color":"blue"}
         *
         * https://swagger.io/docs/specification/describing-parameters/#schema-vs-content
         */
        params.parseJson.forEach(item => {
            if (request[item.reqField] && request[item.reqField][item.name]) {
                request[item.reqField][item.name] = JSON.parse(
                    request[item.reqField][item.name],
                );
            }
        });

        /**
         * array deserialization
         * filter=foo,bar,baz
         * filter=foo|bar|baz
         * filter=foo%20bar%20baz
         */
        params.parseArray.forEach(item => {
            if (request[item.reqField] && request[item.reqField][item.name]) {
                request[item.reqField][item.name] = request[item.reqField][item.name].split(
                    item.delimiter,
                );
            }
        });

        /**
         * forcing convert to array if scheme describes param as array + explode
         */
        params.parseArrayExplode.forEach(item => {
            if (
                request[item.reqField] &&
                request[item.reqField][item.name] &&
                !(request[item.reqField][item.name] instanceof Array)
            ) {
                request[item.reqField][item.name] = [request[item.reqField][item.name]];
            }
        });

        const valid = validator(request);

        if (!valid) {
            const errors = augumentAjvErrors([...(validator.errors || [])]);
            const message = this._ajv.errorsText(errors, {
                dataVar: 'request',
            });
            throw new ValidationError(message, 415);
        }
    }

    getSecurityQueryParams(usedSecuritySchema, securitySchema) {
        return usedSecuritySchema && securitySchema ?
            usedSecuritySchema
            .filter(obj => Object.entries(obj).length !== 0)
            .map(sec => {
                const securityKey = Object.keys(sec)[0];
                return securitySchema[securityKey];
            })
            .filter(sec => sec && sec.in && sec.in === 'query')
            .map(sec => sec.name) : [];
    }

    parametersToSchema(parameters = []) {
        const schema = {
            query: {},
            headers: {},
            params: {},
            cookies: {}
        };
        const reqFields = {
            query: 'query',
            header: 'headers',
            path: 'params',
            cookie: 'cookies',
        };
        const arrayDelimiter = {
            form: ',',
            spaceDelimited: ' ',
            pipeDelimited: '|',
        };
        const parseJson = [];
        const parseArray = [];
        const parseArrayExplode = [];

        parameters.forEach(parameter => {
            if (parameter.hasOwnProperty('$ref')) {
                const id = parameter.$ref.replace(/^.+\//i, '');
                parameter = this._apiDoc.components.parameters[id];
            }

            const $in = parameter.in;
            const name =
                $in === 'header' ? parameter.name.toLowerCase() : parameter.name;

            const reqField = reqFields[$in];
            if (!reqField) {
                const message = `Parameter 'in' has incorrect value '${$in}' for [${parameter.name}]`;
                throw new ValidationError(message, 400);
            }

            let parameterSchema = parameter.schema;
            if (parameter.content && parameter.content[TYPE_JSON]) {
                parameterSchema = parameter.content[TYPE_JSON].schema;
                parseJson.push({
                    name,
                    reqField
                });
            }

            if (!parameterSchema) {
                const message = `No available parameter 'schema' or 'content' for [${parameter.name}]`;
                throw new ValidationError(message, 400);
            }

            if (
                parameter.schema &&
                parameter.schema.type === 'array' &&
                !parameter.explode
            ) {
                const delimiter = arrayDelimiter[parameter.style];
                if (!delimiter) {
                    const message = `Parameter 'style' has incorrect value '${parameter.style}' for [${parameter.name}]`;
                    throw new ValidationError(message, 400);
                }
                parseArray.push({
                    name,
                    reqField,
                    delimiter
                });
            }

            if (
                parameter.schema &&
                parameter.schema.type === 'array' &&
                parameter.explode
            ) {
                parseArrayExplode.push({
                    name,
                    reqField
                });
            }

            if (!schema[reqField].properties) {
                schema[reqField] = {
                    type: 'object',
                    properties: {},
                };
            }

            schema[reqField].properties[name] = parameterSchema;
            if (parameter.required) {
                if (!schema[reqField].required) {
                    schema[reqField].required = [];
                }
                schema[reqField].required.push(name);
            }
        });

        return {
            schema,
            parseJson,
            parseArray,
            parseArrayExplode
        };
    }

    requestBodyToSchema(path, contentType, requestBody) {
        if (requestBody.content) {
            const content = requestBody.content[contentType];

            if (!content) {
                const message = !contentType == null ?
                    'media type not specified' :
                    `unsupported media type ${contentType.contentType}`;
                throw new ValidationError(message, 415);
            }

            const schema = this.cleanseContentSchema(contentType, requestBody);
            return schema || content.schema || {};
        }
        return {};
    }

    cleanseContentSchema(contentType, requestBody) {
        const bodyContentSchema =
            requestBody.content[contentType] &&
            requestBody.content[contentType].schema;

        let bodyContentRefSchema = null;
        if (bodyContentSchema && '$ref' in bodyContentSchema) {
            const objectSchema = this._ajv.getSchema(bodyContentSchema.$ref);
            bodyContentRefSchema =
                objectSchema &&
                objectSchema.schema &&
                objectSchema.schema.properties ?
                {
                    ...objectSchema.schema
                } :
                null;
        }
        // handle readonly / required request body refs
        // don't need to copy schema if validator gets its own copy of the api spec
        // currently all middlware i.e. req and res validators share the spec
        const schema = bodyContentRefSchema || bodyContentSchema;
        if (schema && schema.properties) {
            Object.keys(schema.properties).forEach(prop => {
                const propertyValue = schema.properties[prop];
                const required = schema.required;
                if (propertyValue.readOnly && required) {
                    const index = required.indexOf(prop);
                    if (index > -1) {
                        schema.required = required
                            .slice(0, index)
                            .concat(required.slice(index + 1));
                    }
                }
            });
            return schema;
        }
    }

    rejectUnknownQueryParams(query, schema, whiteList = []) {
        if (!schema.properties) return;
        const knownQueryParams = new Set(Object.keys(schema.properties));
        whiteList.forEach(item => knownQueryParams.add(item));
        const queryParams = Object.keys(query);
        for (const q of queryParams) {
            if (!knownQueryParams.has(q)) {
                throw new ValidationError(`Unknown query parameter ${q}`, 400);
            }
        }
    }
}