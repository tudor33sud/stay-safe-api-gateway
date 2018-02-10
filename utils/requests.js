/**
 * @typedef {Object} ResolveErrorOptions
 * @property {String} unknownErrorMessage Message to send to response for internal errors
 * @property {Boolean} log=false Flag if error should be logged
 * @property {Boolean} displayErrorReason=false Flag to determine if internal server error should display the error message also.
 * @typedef {Object} CorsOptions
 * @property {String} allowedOrigin 
 */

const _ = require('lodash');
const ApiError = require('../error/api-error');
const logger = require('./log.js').logger;


/**
 * Default resolving for errors and sending appropriate message with the response
 * @param {Error} err error object
 * @param {Express.Request} req express request object
 * @param {Express.Response} res express response object
 * @param {ResolveErrorOptions} options Options Object
 */
function resolveError(err, req, res, options) {
    const opts = _.extend({
        unknownErrorMessage: 'Internal Server Error',
        log: false,
        displayErrorReason: false
    }, options || {});

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json(err.toJSON());
    } else if (err.statusCode) {
        return res.status(err.statusCode).json(err.error);
    } else {
        if (opts.log) {
            logger.error(`${opts.unknownErrorMessage}. Reason: ${err.message}`, { req, stack: err.stack });
        }
        const errorMessage = opts.displayErrorReason ? `${opts.unknownErrorMessage}. Reason: ${err.message}` : `${opts.unknownErrorMessage}`;
        return res.status(500).json({ message: errorMessage });
    }
}


function cors(options = {}) {
    options.allowedOrigin = options.allowedOrigin || '*';
    return function (req, res, next) {
        res.header("Access-Control-Allow-Origin", options.allowedOrigin);
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept,Authorization");
        res.header('Access-Control-Allow-Methods', 'OPTIONS,GET,PUT,POST,DELETE');
        next();
    }
}


function defaultErrorHandler(environment) {
    if (environment == 'localhost') {
        return developmentErrorHandler;
    }
    return productionErrorHandler;
}

function developmentErrorHandler(err, req, res, next) {
    resolveError(err, req, res, { log: true, req, displayErrorReason: true })
}

function productionErrorHandler(err, req, res, next) {
    resolveError(err, req, res, { log: true, req })
}

/**
 * Resolve default requests
 * @param {RequestPromise} requestPromise Request Promise Object
 * @param {Express.Response} res Express response object 
 * @param {ResolveRequestOptions} options 
 */
function resolveDefault(requestPromise, res) {
    return requestPromise.then(function (response) {
        return res.status(response.statusCode).json(response.body);
    });
}

/**
 * Extract options object to be used to proxy the request in a default manner.
 * Gets the method, uri, headers,qs and body of the called endpoint
 * @param {Express.Request} req express request object
 */
function defaultTargetOptions(req, uri) {
    return {
        method: req.method,
        uri: uri || req.originalUrl,
        headers: req.passedHeaders,
        body: req.body,
        qs: req.query
    };
}

/**
 * Default Proxy Handler
 * @param {RequestPromise.defaults} baseRequest Requst Promise base request(needed for initial configuration baseUrl, json response etc.) 
 * @param {String} uri override original URI when proxying with custom one. If not specified, the original URI which was triggered will be use
 */
const defaultProxyRequest = (baseRequest, uri) => {
    return async (req, res, next) => {
        try {
            const options = defaultTargetOptions(req, uri);
            const response = await baseRequest(options);
            res.status(response.statusCode).json(response.body);
        } catch (err) {
            next(err);
        }
    };
};


module.exports = {
    middleware: {
        cors: cors,
        defaultErrorHandler
    },
    defaultProxyHandler: defaultProxyRequest,
    defaultTargetOptions: defaultTargetOptions
}