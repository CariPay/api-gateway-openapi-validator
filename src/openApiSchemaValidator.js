const Ajv = require('ajv');
const merge = require('lodash/merge');
const draftSchema = require('ajv/lib/refs/json-schema-draft-04.json');
const openApiV3Schema = require('./openApiV3Schema.json');

module.exports = class OpenAPISchemaValidator {
    constructor({ version, extensions }) {
      const v = new Ajv({ schemaId: 'auto', allErrors: true });
      v.addMetaSchema(draftSchema);
  
      const ver = version && parseInt(String(version), 10);
      if (!ver) throw Error('version missing from OpenAPI specification');
      if (ver != 3) throw Error('OpenAPI v3 specification version is required');
  
      const schema = merge({}, openApiV3Schema, extensions || {});
      v.addSchema(schema);
      this.validator = v.compile(schema);
    }
  
    validate(openapiDoc) {
      const valid = this.validator(openapiDoc);
      if (!valid) {
        return { errors: this.validator.errors };
      } else {
        return { errors: [] };
      }
    }
  }

