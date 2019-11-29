const { Ajv } = require('ajv');

const { createResponseAjv } = require('./middleware/ajv');
const { augumentAjvErrors } = require('./utils');
const { ValidationError } = require('./errors');
const { TYPE_JSON } = require('./constants');

module.exports = class ResponseValidator {
    constructor(apiDoc, options, schema) {
        this._apiDoc = apiDoc;
        this._options = options;
        this._schema = schema;
        this._ajv = createResponseAjv(apiDoc, options);
    }

    validate(path, response, statusCode, options = {}) {
        const { responses } = this._schema;
        const validators = this.buildValidators(responses);
        
        const valid = validators[statusCode](response);
        if (!valid) {
            const errors = augumentAjvErrors([...(validator.errors || [])]);
            const message = this._ajv.errorsText(errors, {
                dataVar: 'response',
            });
            throw new ValidationError(message, 500);
        }
    }

    buildValidators(responses) {
        const canValidate = r =>
          typeof r.content === 'object' &&
          r.content[TYPE_JSON] &&
          r.content[TYPE_JSON].schema;
    
        const schemas = {};
        for (const entry of Object.entries(responses)) {
          const [name, response] = entry;
          if (!canValidate(response)) {
            // @TODO support content other than JSON
            // don't validate, assume content is valid
            continue;
          }
          const schema = response.content[TYPE_JSON].schema;
          schemas[name] = {
            type: 'object',
            properties: {
              response: schema,
            },
            components: this._apiDoc.components || {},
            additionalProperties: this._options.additionalProperties,
          };
        }
    
        const validators = {};
        for (const [name, schema] of Object.entries(schemas)) {
          validators[name] = this._ajv.compile(schema);
        }
        return validators;
    }
}