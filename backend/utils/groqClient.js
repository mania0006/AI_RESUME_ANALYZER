const axios = require('axios');

// Groq deprecated llama-3.3-70b-versatile (announced June 17, 2026).
// gpt-oss-120b is the recommended replacement for general-purpose text tasks.
// If Groq changes their lineup again, check https://console.groq.com/docs/models
const MODEL = 'openai/gpt-oss-120b';

const REQUIRED_TOP_LEVEL_FIELDS = [
  'candidateName', 'experienceLevel', 'skills', 'strengths', 'weaknesses',
  'suggestions', 'matchScore', 'summary', 'isATSFriendly', 'gapsFound',
  'metrics', 'matchedKeywords', 'missingKeywords', 'lineFeedback',
  'contactInfo', 'employmentGaps', 'pageLengthFeedback',
];
const REQUIRED_METRIC_FIELDS = ['keywords', 'formatting', 'impact', 'clarity', 'actionVerbs'];

function buildSchema() {
  return `{
  "candidateName": "extracted full name",
  "experienceLevel": "Entry/Mid/Senior",
  "skills": ["skill1", "skill2", ...],
  "strengths": ["strength1", ...],
  "weaknesses": ["weakness1", ...],
  "suggestions": ["suggestion1", ...],
  "matchScore": 0,
  "summary": "one short 1-2 sentence honest verdict on the resume, e.g. strengths and biggest gap",
  "isATSFriendly": true,
  "gapsFound": 0,
  "metrics": {
    "keywords": 0,
    "formatting": 0,
    "impact": 0,
    "clarity": 0,
    "actionVerbs": 0
  },
  "matchedKeywords": ["keyword1", ...],
  "missingKeywords": ["keyword1", ...],
  "lineFeedback": [
    {
      "quote": "short exact phrase or bullet copied from the resume (under 12 words)",
      "status": "strong",
      "note": "short comment, e.g. suggested rewrite or why it's missing a metric",
      "suggestedRewrite": "ONLY for status=\\"weak\\" or status=\\"missing\\": a complete, copy-paste-ready improved version of this bullet, written as if it belonged on the resume. Leave as an empty string for status=\\"strong\\"."
    }
  ],
  "contactInfo": {
    "hasEmail": true,
    "hasPhone": true,
    "hasLinkedIn": false,
    "hasPortfolioOrGithub": false,
    "note": "one short sentence flagging anything missing that recruiters expect to find"
  },
  "employmentGaps": [
    {
      "period": "e.g. Jan 2022 - Aug 2022",
      "note": "short neutral note describing the gap, not an accusation"
    }
  ],
  "pageLengthFeedback": "one short sentence on whether the resume's length fits its inferred experience level (e.g. entry-level should be ~1 page, senior can be 2)"
}`;
}

function buildPrompt(resumeText, jobDescription, pageCount) {
  const hasJD = jobDescription && jobDescription.trim().length > 0;

  const jdContext = hasJD
    ? `The candidate is applying for this specific job:\n${jobDescription}\n\nCalculate "matchScore" strictly based on how well the resume matches THIS job. If the resume is from a completely different field/role, matchScore MUST be low (10-30) even if the resume itself is well written. "keywords" metric = % of important job-description keywords present in resume. "missingKeywords"/"matchedKeywords" must reference actual keywords from the job description.`
    : `No specific job description was provided. Evaluate the resume against general best practices for its inferred role/industry. "matchScore" reflects overall resume quality and role clarity. "keywords" metric reflects how well the resume uses strong, industry-relevant keywords for its own field. matchedKeywords/missingKeywords should reference strong keywords for the resume's own inferred role.`;

  const pageContext = pageCount ? `\nThe resume is ${pageCount} page(s) long.` : '';

  return `You are an expert resume reviewer and ATS specialist, similar to tools like Jobscan.

${jdContext}${pageContext}

Also evaluate:
- "formatting": 0-100, how clean/ATS-parseable the structure is (headings, bullet usage, no tables/graphics issues)
- "impact": 0-100, how many bullets use quantified, measurable achievements (numbers, %, results) vs vague duties
- "clarity": 0-100, how clear and concise the writing is
- "actionVerbs": 0-100, how consistently bullets open with strong action verbs (e.g. "Led", "Built") rather than passive phrasing (e.g. "Responsible for", "Was tasked with")
- "isATSFriendly": true/false based on formatting and structure
- "gapsFound": count of missing important keywords/skills
- "lineFeedback": pick 3-5 actual bullets/lines from the resume. For bullets with no measurable metric, status="weak" and note should briefly say what's missing. For bullets that ARE strong (quantified, clear), status="strong" (and suggestedRewrite left as ""). For 1 entry, you may instead represent a MISSING keyword/skill entirely, with quote being the missing skill/keyword itself and status="missing". For every "weak" or "missing" entry, ALSO fill "suggestedRewrite" with a complete, ready-to-paste improved bullet — but NEVER invent a specific number, percentage, dollar amount, or count that isn't already stated somewhere in the resume text. If the original bullet has no real metric to draw from, use an explicit placeholder in square brackets instead (e.g. "reduced processing time by [X]%", "served [Y]+ users", "cut costs by $[Z]") so the candidate fills in their own true figure rather than pasting a fabricated one. Only use a concrete number in the rewrite if that exact number already appears elsewhere in the resume text.
- "contactInfo": detect whether the header includes an email, phone number, LinkedIn URL, and a portfolio/GitHub link. Flag anything a recruiter would expect but can't find.
- "employmentGaps": scan work history dates for gaps of 4+ months between roles. If none, return an empty array. Keep notes neutral and factual, never speculative about the reason.
- "pageLengthFeedback": judge whether the page count fits the candidate's inferred experience level.

Return ONLY valid JSON (no markdown fences, no extra text) with EXACTLY this structure:

${buildSchema()}

Resume Text:
${resumeText}`;
}

// Matches numbers the way they actually show up in resume bullets: plain (40),
// comma-grouped (10,000), decimal (3.5), with a leading $ or trailing % or +.
const NUMBER_PATTERN = /\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\+?/g;
const PLACEHOLDER_LETTERS = ['X', 'Y', 'Z', 'W', 'V'];

function numberCore(match) {
  // Strip everything except digits and the decimal point, so "10,000" / "$10,000"
  // / "10000" all compare equal, and "95%" compares equal to a bare "95".
  return match.replace(/[^0-9.]/g, '');
}

// This is the actual guarantee: it doesn't matter how well the model followed
// instructions — any number in the rewrite that isn't traceable to the original
// resume text gets swapped for a [X]-style placeholder before it ever reaches the user.
function stripFabricatedNumbers(rewrite, sourceText) {
  if (!rewrite) return rewrite;
  const sourceNumbers = new Set(
    (sourceText.match(NUMBER_PATTERN) || []).map(numberCore).filter(Boolean)
  );
  let placeholderIdx = 0;
  return rewrite.replace(NUMBER_PATTERN, (match) => {
    const core = numberCore(match);
    if (!core || sourceNumbers.has(core)) return match;
    const letter = PLACEHOLDER_LETTERS[placeholderIdx % PLACEHOLDER_LETTERS.length];
    placeholderIdx += 1;
    return `[${letter}]`;
  });
}

function validateAnalysis(obj, sourceText) {
  const missing = REQUIRED_TOP_LEVEL_FIELDS.filter((f) => !(f in obj));
  if (missing.length > 0) {
    throw new Error(`AI response missing fields: ${missing.join(', ')}`);
  }
  const missingMetrics = REQUIRED_METRIC_FIELDS.filter((f) => !(f in (obj.metrics || {})));
  if (missingMetrics.length > 0) {
    throw new Error(`AI response missing metrics: ${missingMetrics.join(', ')}`);
  }
  if (!Array.isArray(obj.lineFeedback) || obj.lineFeedback.length === 0) {
    throw new Error('AI response missing lineFeedback entries');
  }
  // suggestedRewrite is new and optional from the model's perspective — normalize
  // it to an empty string rather than failing validation if it's ever omitted.
  // Then strip any number the model invented that isn't actually in the resume.
  obj.lineFeedback = obj.lineFeedback.map((item) => {
    const rewrite = typeof item.suggestedRewrite === 'string' ? item.suggestedRewrite : '';
    return {
      ...item,
      suggestedRewrite: stripFabricatedNumbers(rewrite, sourceText),
    };
  });
  return obj;
}

async function callGroq(prompt) {
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 45000,
    }
  );

  const aiReply = response.data.choices[0].message.content;
  const cleanedReply = aiReply.replace(/```json|```/g, '').trim();
  return JSON.parse(cleanedReply);
}

async function analyzeResume(resumeText, jobDescription = '', pageCount = null) {
  const prompt = buildPrompt(resumeText, jobDescription, pageCount);

  try {
    const parsed = await callGroq(prompt);
    return validateAnalysis(parsed, resumeText);
  } catch (firstError) {
    // One retry: the model may have added stray text or dropped a field.
    // Ask it explicitly to correct itself instead of failing the whole request.
    console.warn('Groq response failed validation, retrying once:', firstError.message);
    try {
      const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous response was invalid (${firstError.message}). Return ONLY the raw JSON object, with every field listed above present, no markdown fences, no commentary.`;
      const parsed = await callGroq(retryPrompt);
      return validateAnalysis(parsed, resumeText);
    } catch (secondError) {
      console.error('Groq API Error:', secondError.response?.data || secondError.message);
      throw new Error('AI analysis failed');
    }
  }
}

module.exports = { analyzeResume };