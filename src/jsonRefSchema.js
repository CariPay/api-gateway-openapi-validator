const parser = require('json-schema-ref-parser');

const refParser = {
    bundle: (schema, options) => {
      return new Promise((resolve, reject) => {
        parser.bundle(schema, options, (error, result) => {
          if (error) reject(error);
          resolve(result);
        });
      });
    },
};

module.exports = {
    refParser,
};