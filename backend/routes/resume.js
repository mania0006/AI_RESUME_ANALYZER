const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const { analyzeResume } = require('../utils/groqClient');
const db = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB — keep in sync with the frontend's MAX_FILE_SIZE_MB
const MAX_JD_LENGTH = 6000; // characters — enough for any real job posting, caps token cost/abuse
const MIN_TEXT_LENGTH = 40; // below this, treat as a scanned/empty file rather than analyze garbage

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

// Wrap multer so its errors (file too large, bad type) become clean JSON
// responses instead of bubbling up as generic 500s or raw error pages.
function handleUpload(req, res, next) {
  upload.single('resume')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File must be smaller than ${MAX_FILE_SIZE / (1024 * 1024)}MB.` });
    }
    if (err.message === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ error: 'Only PDF or DOCX files are allowed.' });
    }
    console.error('Upload error:', err);
    return res.status(400).json({ error: 'File upload failed.' });
  });
}

async function extractText(filePath, ext) {
  if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();
    const pageCount = pdfData.pages ? pdfData.pages.length : (pdfData.total || 1);
    await parser.destroy();
    return { text: pdfData.text, pageCount };
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    // DOCX has no native page count; estimate from word count (~500 words/page is a
    // reasonable resume-density assumption, good enough for the "is this too long" check).
    const wordCount = result.value.trim().split(/\s+/).filter(Boolean).length;
    const pageCount = Math.max(1, Math.ceil(wordCount / 500));
    return { text: result.value, pageCount };
  }

  throw new Error('UNSUPPORTED_FILE_TYPE');
}

router.post('/upload', requireAuth, handleUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file was uploaded.' });
  }

  const filePath = req.file.path;

  try {
    const jobDescription = (req.body.jobDescription || '').trim().slice(0, MAX_JD_LENGTH);
    const ext = path.extname(req.file.originalname).toLowerCase();

    const { text: extractedText, pageCount } = await extractText(filePath, ext);

    if (!extractedText || extractedText.trim().length < MIN_TEXT_LENGTH) {
      return res.status(422).json({
        error: "Couldn't extract text from this resume. It may be a scanned image PDF — try a text-based file instead.",
      });
    }

    const analysis = await analyzeResume(extractedText, jobDescription, pageCount);

    const stmt = db.prepare(`
      INSERT INTO analyses (filename, candidate_name, ats_score, experience_level, full_analysis, user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      req.file.filename,
      analysis.candidateName,
      analysis.matchScore,
      analysis.experienceLevel,
      JSON.stringify(analysis),
      req.userId
    );

    res.json({
      message: 'Resume analyzed successfully',
      filename: req.file.filename,
      originalName: req.file.originalname,
      pageCount: pageCount,
      hadJobDescription: !!jobDescription,
      analysis: analysis
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Something went wrong while processing the resume.' });
  } finally {
    // Don't keep candidates' resumes sitting on disk after we've extracted what we need.
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to clean up uploaded file:', err);
    });
  }
});

router.get('/history', requireAuth, (req, res) => {
  try {
    // Scoped to the logged-in user only — this is the fix for the "everyone sees
    // everyone's history" bug. Never drop the WHERE clause here.
    const rows = db
      .prepare('SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.userId);
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Could not fetch history.' });
  }
});

module.exports = router;