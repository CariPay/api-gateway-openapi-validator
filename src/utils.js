const augumentAjvErrors = (errors=[]) => {
    errors.forEach(e => {
      if (e.keyword === 'enum') {
        const params = e.params;
        const allowedEnumValues = params && params.allowedValues;
        e.message = !!allowedEnumValues
          ? `${e.message}: ${allowedEnumValues.join(', ')}`
          : e.message;
      }
    });
    return errors;
};

const isJson = (str) => {
  try {
    const jsonStr = JSON.parse(str);
    return true;
  } catch (error) {
    return typeof(str) === 'object';
  }
  return false;
};

module.exports = {
  augumentAjvErrors,
  isJson,
};
