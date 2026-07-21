const express = require('express');
const cors = require('cors');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const resumeRoutes = require('./routes/resume');  // NAYI LINE

const app = express();

// multer's diskStorage assumes this folder already exists — create it on boot
// instead of relying on it having been created manually once.
const UPLOAD_DIR = 'uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Lock CORS down to a known origin in production. Set CORS_ORIGIN in .env
// (e.g. https://yourapp.com); falls back to allow-all for local dev only.
const corsOptions = process.env.CORS_ORIGIN
  ? { origin: process.env.CORS_ORIGIN }
  : {};
app.use(cors(corsOptions));
app.use(express.json());

// The upload route calls a paid Groq API per request — rate-limit it
// specifically so one client can't rack up your bill or DoS the endpoint.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { error: 'Bohot zyada requests. Thodi dair baad try karein.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/resume/upload', uploadLimiter);

app.use('/api/resume', resumeRoutes);  

app.use('/api/auth', require('./routes/auth'));

app.get('/', (req, res) => {
  res.send('Resume Analyzer Backend is running!');
});

// Catch-all error handler — ensures clients always get JSON, never Express's
// default HTML stack-trace page (which also leaks internals in production).
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server side kuch masla hua.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server chal raha hai port ${PORT} par`);
});