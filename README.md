<div align="center">

# 🖋️ ATSmate

### See your resume the way an ATS — and a recruiter — actually reads it.

*AI-powered resume analysis with keyword matching, copy-ready line rewrites, and a private, per-account history.*

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-5FA97E?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-C9A24C?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![Groq](https://img.shields.io/badge/AI-Groq-orange?style=for-the-badge)](https://groq.com/)
[![License](https://img.shields.io/badge/License-MIT-9CA5BE?style=for-the-badge)](#license)

[Live Demo](#) · [Report a Bug](#) · [Request a Feature](#)

</div>

---

## 📖 Overview

**ATSmate** is a full-stack web application that analyzes resumes the way an Applicant Tracking System and a human recruiter both would — in seconds. Upload a resume (PDF or DOCX), optionally paste a job description, and get back a detailed, structured verdict: an overall match score, keyword coverage, formatting and clarity metrics, line-by-line feedback with **ready-to-paste rewrites**, contact-info and employment-gap checks, and more.

Every account has its own private, saved history — nobody else can see your analyses but you.

<div align="center">

*[Insert a screenshot or GIF of the report screen here]*

</div>

---

## ✨ Features

- 🔐 **Private accounts** — JWT-based authentication; every analysis is tied to your account and visible only to you
- 📄 **PDF & DOCX support** — drag-and-drop upload with automatic text extraction and page-count estimation
- 🎯 **ATS match scoring** — an overall score plus five weighted metrics: keywords, formatting, impact, clarity, and action verbs
- 🧾 **Line-by-line feedback with copy-ready rewrites** — real bullets pulled from your resume, each marked strong / weak / missing. Weak bullets come with a **suggested rewrite** (quantified, action-verb-led) and a one-click **Copy** button, so the fix is one paste away instead of something you have to write yourself
- 📋 **Copy improved bullets (bulk)** — a single sidebar button that copies every suggested rewrite from the report at once, for pasting straight into your resume draft
- 🔍 **Keyword matching** — matched vs. missing keywords, scored against a pasted job description or general best practices for the inferred role
- 📇 **Header & length check** — flags missing email, phone, LinkedIn, or portfolio links, and whether the resume's length suits the candidate's experience level
- 📅 **Employment gap detection** — neutral, factual flags for gaps of 4+ months in the work history
- 🕓 **Personal history** — every past analysis is saved and revisitable, scoped strictly to the logged-in user
- 🖨️ **Exportable reports** — a print-optimized layout for saving or sharing a clean PDF of any report
- 🎨 **A designed, not templated, interface** — a dark ink-navy and brass-gold visual identity with a wax-seal "verified" motif carried throughout

> **Note on rewrite accuracy:** suggested rewrites may include example metrics (e.g. "reduced processing time by 40%") to illustrate *how* to quantify an achievement. Always replace these with your own real numbers before using them — never paste a statistic you can't personally verify or explain in an interview.

---

## 🛠️ Tech Stack

| Layer          | Technology                                                                 |
|----------------|------------------------------------------------------------------------------|
| **Frontend**   | React (Vite), Axios, custom CSS design system (no UI framework)             |
| **Backend**    | Node.js, Express                                                             |
| **Database**   | SQLite via `better-sqlite3`                                                 |
| **Auth**       | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` password hashing               |
| **AI**         | [Groq API](https://groq.com/) — `openai/gpt-oss-120b`                       |
| **File parsing** | `pdf-parse` (PDF), `mammoth` (DOCX), `multer` (uploads)                   |

---

## 📁 Project Structure

```
.
├── backend/
│   ├── database/
│   │   └── db.js              # SQLite connection, schema, and migrations
│   ├── middleware/
│   │   └── auth.js            # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js            # /api/auth — register, login, session check
│   │   └── resume.js          # /api/resume — upload, analyze, history
│   ├── utils/
│   │   └── groqClient.js      # Prompt building + Groq API integration
│   └── server.js              # App entry point
│
└── frontend/
    └── src/
        ├── App.jsx             # Main app shell and report UI
        ├── AuthScreen.jsx      # Login / sign-up screen
        ├── Icons.jsx           # Inline SVG icon set
        ├── App.css             # Design system + component styles
        └── index.css           # Global resets
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A free API key from [Groq](https://console.groq.com/)

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

```env
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET=a_long_random_secret_string
PORT=5000
```

Start the backend:

```bash
node server.js
```

### 3. Set up the frontend

```bash
cd ../frontend
npm install
```

Create a `.env` file inside `frontend/` (optional — defaults to `localhost:5000`):

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

The app will be running at `http://localhost:5173`.

---

## 🔑 Environment Variables

| Variable         | Location    | Required | Description                                      |
|------------------|-------------|----------|---------------------------------------------------|
| `GROQ_API_KEY`   | `backend/`  | Yes      | API key used to call the Groq LLM for analysis     |
| `JWT_SECRET`     | `backend/`  | Yes      | Secret used to sign and verify auth tokens         |
| `PORT`           | `backend/`  | No       | Port the Express server listens on (default `5000`) |
| `VITE_API_URL`   | `frontend/` | No       | Backend base URL (default `http://localhost:5000`) |

---

## 📡 API Reference

| Method | Endpoint             | Auth required | Description                                  |
|--------|----------------------|:--------------:|-----------------------------------------------|
| `POST` | `/api/auth/register` | No              | Create a new account                          |
| `POST` | `/api/auth/login`    | No              | Log in and receive a JWT                      |
| `GET`  | `/api/auth/me`       | Yes             | Verify the current token / fetch user info    |
| `POST` | `/api/resume/upload` | Yes             | Upload and analyze a resume (PDF/DOCX)        |
| `GET`  | `/api/resume/history`| Yes             | Fetch the logged-in user's saved analyses     |

---

## 🗺️ Roadmap

- [ ] Downloadable, ATS-friendly resume templates pre-filled with suggested rewrites
- [ ] Support for multiple job-description comparisons per resume
- [ ] Hosted database option for permanent, cross-deploy data persistence
- [ ] Shareable, read-only report links

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

## 👤 Author

**Mania Ashar**
Computer Science undergraduate, NED University of Engineering & Technology — specializing in Artificial Intelligence

- GitHub: https://github.com/mania0006
- LinkedIn: https://www.linkedin.com/in/mania-ashar-a7b96535a/

<div align="center">

*Built as part of an ongoing portfolio of AI-powered tools.*

</div>
