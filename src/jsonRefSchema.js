const parser = require('json-schema-ref-parser');
const { loopWhile } = require('deasync');

const refParser = {
    bundle: (schema, options) => {
      var savedError,
        savedResult,
        done = false;
  
      parser.bundle(schema, options, (error, result) => {
        savedError = error;
        savedResult = result;
        done = true;
      });
  
      loopWhile(() => !done);
  
      if (savedError) throw savedError;
      return savedResult;
    },
};

module.exports = {
    refParser,
};