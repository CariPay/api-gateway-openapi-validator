const comparePathToSpecPath = (key, path) => {
    const regex = RegExp(key.replace(/{[a-zA-Z0-9]+}/g, '([a-zA-z0-9-])+') + '$');
    return regex.test(path);
};

module.exports = {
    comparePathToSpecPath,
};