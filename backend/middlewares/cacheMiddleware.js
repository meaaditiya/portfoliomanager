const apicache = require("apicache");
let cache = apicache.middleware;
module.exports = cache("3 minutes");
