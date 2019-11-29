const OpenApiValidator = require('dist/index');

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */


exports.lambdaHandler = new OpenApiValidator(
    {
        apiSpec: 'examples/swagger.json',
        validateRequests: true,
    },
    async (event, context) => {
        try {
            return JSON.parse(event.body);
        } catch (err) {
            console.log(err);
            return err;
        }
}).install();