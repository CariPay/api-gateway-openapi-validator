const { Ajv } = require('ajv');
const { createRequestAjv } = require('./middleware/ajv');

const { ValidationError } = require('./errors');

module.exports = class RequestValidator {
    constructor(apiDoc, options, schema) {
        this._apiDoc = apiDoc;
        this._options = options;
        this._schema = schema;
        this._ajv = createRequestAjv(apiDoc, options);
    }

    validate (path, request, schema, contentType = 'application/json') {
        // const parameters = this.parametersToSchema(path, schema);
        // console.log(parameters)

        // let requestBody = request.body;
        // if (requestBody && requestBody.hasOwnProperty('$ref')) {
        //     const ref = requestBody.$ref;
        //     const id = ref.replace(/^.+\//i, '');
        //     requestBody = this._apiDoc.components.requestBodies[id];
        // }

        // let body = {};
        // const requiredAdds = [];
        // if (requestBody && requestBody.hasOwnProperty('content')) {
        //     const reqBodyObject = requestBody;
        //     body = this.requestBodyToSchema(path, contentType, reqBodyObject);
        //     if (reqBodyObject.required) requiredAdds.push('body');
        // }

        // const schema = {
        //     // $schema: "http://json-schema.org/draft-04/schema#",
        //     required: ['query', 'headers', 'params'].concat(requiredAdds),
        //     properties: {
        //         body,
        //         ...parameters.schema,
        //     },
        // };

        const validator = this._ajv.compile(schema);
        // return (req, res, next) => {
        //     if (!this._options.allowUnknownProperties) {
        //         this.rejectUnknownQueryParams(req.query, schema.properties.query, securityQueryParameter);
        //     }

        //     const openapi = req.openapi;
        //     const shouldUpdatePathParams = Object.keys(openapi.pathParams).length > 0;

        //     if (shouldUpdatePathParams) {
        //         req.params = openapi.pathParams || req.params;
        //     }

        //     // (<any>req).schema = schema;

        //     /**
        //      * support json in request params, query, headers and cookies
        //      * like this filter={"type":"t-shirt","color":"blue"}
        //      *
        //      * https://swagger.io/docs/specification/describing-parameters/#schema-vs-content
        //      */
        //     parameters.parseJson.forEach(item => {
        //         if (req[item.reqField] && req[item.reqField][item.name]) {
        //             req[item.reqField][item.name] = JSON.parse(
        //                 req[item.reqField][item.name],
        //             );
        //         }
        //     });

        //     /**
        //      * array deserialization
        //      * filter=foo,bar,baz
        //      * filter=foo|bar|baz
        //      * filter=foo%20bar%20baz
        //      */
        //     parameters.parseArray.forEach(item => {
        //         if (req[item.reqField] && req[item.reqField][item.name]) {
        //             req[item.reqField][item.name] = req[item.reqField][item.name].split(
        //                 item.delimiter,
        //             );
        //         }
        //     });

        //     /**
        //      * forcing convert to array if scheme describes param as array + explode
        //      */
        //     parameters.parseArrayExplode.forEach(item => {
        //         if (
        //             req[item.reqField] &&
        //             req[item.reqField][item.name] &&
        //             !(req[item.reqField][item.name] instanceof Array)
        //         ) {
        //             req[item.reqField][item.name] = [req[item.reqField][item.name]];
        //         }
        //     });

        //     const reqToValidate = {
        //         ...req,
        //         cookies: req.cookies ? {
        //             ...req.cookies,
        //             ...req.signedCookies
        //         } : undefined,
        //     };
        //     const valid = validator(reqToValidate);
        //     if (valid) {
        //         next();
        //     } else {
        //         // TODO look into Ajv async errors plugins
        //         const errors = augmentAjvErrors([...(validator.errors || [])]);
        //         const err = ajvErrorsToValidatorError(400, errors);
        //         const message = this.ajv.errorsText(errors, {
        //             dataVar: 'request'
        //         });
        //         throw ono(err, message);
        //     }
        // };
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
            .map(sec => sec.name) :
            [];
    }

    parametersToSchema (path, parameters = []) {
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
                throw ValidationError(message, 400);
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
                throw ValidationError(message, 400);
            }

            if (
                parameter.schema &&
                parameter.schema.type === 'array' &&
                !parameter.explode
            ) {
                const delimiter = arrayDelimiter[parameter.style];
                if (!delimiter) {
                    const message = `Parameter 'style' has incorrect value '${parameter.style}' for [${parameter.name}]`;
                    throw ValidationError(message, 400);
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

    requestBodyToSchema (path, contentType, requestBody) {
        if (requestBody.content) {
            const content = requestBody.content[type];

            if (!content) {
                const message = !contentType == null
                    ? 'media type not specified'
                    : `unsupported media type ${contentType.contentType}`;
                throw ValidationError(message, 415);
            }

            const schema = this.cleanseContentSchema(contentType, requestBody);
            return schema || content.schema || {};
        }
        return {};
    }

    cleanseContentSchema (contentType, requestBody) {
        const bodyContentSchema =
          requestBody.content[contentType] &&
          requestBody.content[contentType].schema;
    
        let bodyContentRefSchema = null;
        if (bodyContentSchema && '$ref' in bodyContentSchema) {
          const objectSchema = this.ajv.getSchema(bodyContentSchema.$ref);
          bodyContentRefSchema =
            objectSchema &&
            objectSchema.schema &&
            objectSchema.schema.properties
              ? { ...objectSchema.schema }
              : null;
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

    rejectUnknownQueryParams (query, schema, whiteList = []) {
        if (!schema.properties) return;
        const knownQueryParams = new Set(Object.keys(schema.properties));
        whiteList.forEach(item => knownQueryParams.add(item));
        const queryParams = Object.keys(query);
        for (const q of queryParams) {
          if (!knownQueryParams.has(q)) {
            throw ValidationError(`Unknown query parameter ${q}`, 400);
          }
        }
      }
}