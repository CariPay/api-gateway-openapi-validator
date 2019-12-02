const draftSchema = require('ajv/lib/refs/json-schema-draft-04.json');
const Ajv = require('ajv');

const { formats } = require('./formats');

const createRequestAjv = (openApiSpec, options={}) => {
  return createAjv(openApiSpec, options);
}

const createResponseAjv = (openApiSpec, options={}) => {
  return createAjv(openApiSpec, options, false);
}

const getValidateFunction = (keyword, message, deleteProp=false) => {
  return function validate(data, path, obj, propName) {
    const isValid = !(sch === true && data != null);
    if (deleteProp) {
      delete obj[propName];
    }
    validate.errors = [
      {
        keyword,
        dataPath: path,
        message,
        params: {
          [keyword]: propName
        },
      },
    ];
    return isValid;
  }
};

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
          return getValidateFunction('readOnly', 'is read-only', true);
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
          return getValidateFunction('writeOnly', 'is write-only');
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