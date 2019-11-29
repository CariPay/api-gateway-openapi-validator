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

module.exports = {
    augumentAjvErrors,
};
