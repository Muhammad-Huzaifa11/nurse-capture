/**
 * Vercel serverless entry — default export must be the Express app.
 * https://vercel.com/guides/using-express-with-vercel
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });

const app = require('../server/app');

module.exports = app;
