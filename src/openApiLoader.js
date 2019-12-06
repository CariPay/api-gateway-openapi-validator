const path = require('path');
const fs = require('fs');
const { refParser } = require('./jsonRefSchema');
const OpenAPISchemaValidator = require('./openApiSchemaValidator');

module.exports = class OpenApiLoader {
    constructor (options) {
        this._options = options;
    }

    // @TODO: Handle yaml files
    async _loadDoc (filePath) {
        const docPath = path.resolve(process.cwd(), filePath);
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(docPath, 'utf-8');
            const parsedContent = await refParser.bundle(JSON.parse(fileContent));
            return parsedContent;
        } else {
            throw new Error('Open API spec could not be found');
        }
    }

    validate(fileContent) {
        const validator = new OpenAPISchemaValidator({
            version: fileContent.openapi,
        });
        if (validator.validate(fileContent).errors.length) {
            throw new Error('Provided API specification is not valid');
        }
    }

    async getDoc () {
        const fileContent = await this._loadDoc(this._options.filePath);

        if (this._options.validateSpec) {
            this.validate(fileContent);
        }

        return fileContent;
    }
}