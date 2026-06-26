# 📄 Document Q&A

An AI-powered document intelligence agent that extracts text from PDFs, Word docs, CSVs, and text files — enabling multi-turn conversation grounded in document content.

**Live Demo:** [document-qa-one.vercel.app](https://document-qa-one.vercel.app)

---

## What It Does

Upload any document and have a full conversation with it. The agent reads and understands your document, then answers questions based exclusively on its content — no hallucination, no guessing.

**Supported file types:**
- PDF — extracted page by page with page number references
- DOCX — Word documents via mammoth.js
- CSV — parsed and formatted with column headers
- TXT / MD — plain text and markdown files

**Features:**
- Drag and drop file upload
- Multi-turn conversation with full memory — ask follow-up questions naturally
- Answers grounded only in document content
- Document info panel showing file name, size, and character count
- Large document handling with smart truncation for context window management

---

## Example Use Cases

- Upload a contract and ask "What are the termination clauses?"
- Upload a research paper and ask "What were the key findings?"
- Upload a resume and ask "What roles would this candidate be good for?"
- Upload a CSV and ask "What are the top 5 entries by revenue?"
- Upload a manual and ask "How do I reset the device?"

---

## Tech Stack

- **React** + **Vite** — frontend framework and build tool
- **Anthropic Claude API** (`claude-sonnet-4-6`) — document understanding and Q&A
- **PDF.js** — client-side PDF text extraction
- **mammoth.js** — DOCX to text conversion
- **Papaparse** — CSV parsing
- **Vercel** — deployment and hosting

---

## Getting Started

### Prerequisites
- Node.js v18+
- Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Installation

```bash
git clone https://github.com/JLSmith91/document-qa.git
cd document-qa
npm install
```

### Environment Variables

Create a `.env` file in the root of the project:

```
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and upload a document.

---

## How to Use

1. Drag and drop a file or click to browse
2. Wait for the document to load and process
3. Ask any question about the document's contents
4. Continue the conversation — the agent remembers all previous questions and answers

---

## Deployment

This project is deployed on Vercel. To deploy your own instance:

1. Fork this repo
2. Import it into [vercel.com](https://vercel.com)
3. Add `VITE_ANTHROPIC_API_KEY` as an environment variable
4. Deploy

---

## Part of a Larger AI Tooling Portfolio

Document Q&A is part of a suite of AI-powered tools built for real-world use. Other projects include a multi-step research agent, a pre-market trading intelligence agent, an AI job search agent, a full stack trade journal, and a meal planning agent.

---

## Author

**Jared Smith** — [@JLSmith91](https://github.com/JLSmith91)
