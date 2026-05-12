/**
 * Vercel serverless entry — default export must be the Express app.
 * https://vercel.com/guides/using-express-with-vercel
 
 */
const app = require('../server/app');

module.exports = app;
