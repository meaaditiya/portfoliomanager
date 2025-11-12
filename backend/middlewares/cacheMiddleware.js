const apicache = require("apicache");
let cache = apicache.middleware;
module.exports = cache("15 minutes");
