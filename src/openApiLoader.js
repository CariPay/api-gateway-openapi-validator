const path = require('path');
const fs = require('fs');
const { refParser } = require('./jsonRefSchema');
const OpenAPISchemaValidator = require('./openApiSchemaValidator');

module.exports = class OpenApiLoader {
    constructor (params) {
        const fileContent = this.loadDoc(params.filePath);

        const validator = new OpenAPISchemaValidator({
            version: fileContent.openapi,
        });
        if (validator.validate(fileContent).errors.length) {
            throw new Error('Provided API specification is not valid');
        }
        this.docJson = fileContent;
    }

    // @TODO: Handle yaml files
    loadDoc (filePath) {
        const docPath = path.resolve(process.cwd(), filePath);
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(docPath, 'utf-8');
            const parsedContent = refParser.bundle(JSON.parse(fileContent));
            return parsedContent;
        } else {
            throw new Error('Open API spec could not be found');
        }
    }
}