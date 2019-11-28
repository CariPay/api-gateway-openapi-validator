const draftSchema = require('ajv/lib/refs/json-schema-draft-04.json');
const Ajv = require('ajv');

const { formats } = require('./formats');

const createRequestAjv = (openApiSpec, options={}) => {
  return createAjv(openApiSpec, options);
}

const createResponseAjv = (openApiSpec, options={}) => {
  return createAjv(openApiSpec, options, false);
}

const createAjv = (openApiSpec, options = {}, request=true) => {
  const ajv = new Ajv({
    ...options,
    schemaId: 'auto',
    allErrors: true,
    meta: draftSchema,
    formats: { ...formats, ...options.formats },
    unknownFormats: options.unknownFormats,
  });
  ajv.removeKeyword('propertyNames');
  ajv.removeKeyword('contains');
  ajv.removeKeyword('const');
  
  if (request) {
    ajv.removeKeyword('readOnly');
    ajv.addKeyword('readOnly', {
      modifying: true,
      compile: sch => {
        if (sch) {
          return function validate(data, path, obj, propName) {
            const isValid = !(sch === true && data != null);
            delete obj[propName];
            validate.errors = [
              {
                keyword: 'readOnly',
                dataPath: path,
                message: `is read-only`,
                params: { readOnly: propName },
              },
            ];
            return isValid;
          };
        }

        return () => true;
      },
    });
  } else {
    // response
    ajv.removeKeyword('writeOnly');
    ajv.addKeyword('writeOnly', {
      modifying: true,
      compile: sch => {
        if (sch) {
          return function validate(data, path, obj, propName) {
            const isValid = !(sch === true && data != null);
            validate.errors = [
              {
                keyword: 'writeOnly',
                dataPath: path,
                message: `is write-only`,
                params: { writeOnly: propName },
              },
            ];
            return isValid;
          };
        }

        return () => true;
      },
    });
  }

  if (openApiSpec.components.schemas) {
    Object.entries(openApiSpec.components.schemas).forEach(
      ([id, schema]) => {
        ajv.addSchema(schema, `#/components/schemas/${id}`);
      },
    );
  }

  if (openApiSpec.components.requestBodies) {
    Object.entries(openApiSpec.components.requestBodies).forEach(
      ([id, schema]) => {
        // TODO add support for content all content types
        ajv.addSchema(
          schema.content['application/json'].schema,
          `#/components/requestBodies/${id}`,
        );
      },
    );
  }

  return ajv;
}

module.exports = {
    createRequestAjv,
    createResponseAjv,
}