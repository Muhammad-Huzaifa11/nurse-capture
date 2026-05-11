require('dotenv').config();
const { connectDb } = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API http://127.0.0.1:${PORT} (from Vite use /api → proxied here)`);
    });
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
