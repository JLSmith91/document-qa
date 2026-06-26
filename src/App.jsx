import { useState, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import Papa from "papaparse";

import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
const COLORS = {
  bg: "#0d1117",
  surface: "#161b22",
  surface2: "#1c2333",
  border: "#2d3748",
  accent: "#c8a96e",
  accentDim: "#8a7040",
  accentPale: "rgba(200,169,110,0.08)",
  green: "#3fb950",
  red: "#f87171",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  muted: "#484f58",
  text: "#e6edf3",
  textDim: "#8b949e",
};

const MAX_CHARS = 80000;

function chunkText(text, maxChars = MAX_CHARS) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[Document truncated to fit context window. Showing first ~80,000 characters.]";
}

async function extractText(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "txt" || ext === "md") {
    return await file.text();
  }

  if (ext === "csv") {
    const text = await file.text();
    const result = Papa.parse(text, { header: true });
    const headers = result.meta.fields?.join(", ") || "";
    const rows = result.data.slice(0, 200).map(row =>
      Object.values(row).join(" | ")
    ).join("\n");
    return `CSV FILE: ${file.name}\nColumns: ${headers}\n\n${rows}`;
  }

  if (ext === "docx") {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (ext === "pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(" ");
      fullText += `[Page ${i}]\n${pageText}\n\n`;
    }
    return fullText;
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

export default function DocumentQA() {
  const [document, setDocument] = useState(null);
  const [docText, setDocText] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const chatRef = useRef();

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleFile(file) {
    if (!file) return;
    setExtracting(true);
    setError(null);
    setMessages([]);
    setDocText("");
    setDocument(null);

    try {
      const text = await extractText(file);
      const chunked = chunkText(text);
      setDocText(chunked);
      setDocument({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        chars: chunked.length,
        pages: file.name.endsWith(".pdf") ? "Processing..." : null,
        type: file.name.split(".").pop().toUpperCase(),
      });
      setMessages([{
        role: "assistant",
        content: `Document loaded: **${file.name}**\n\nI've read through the document and I'm ready to answer your questions. Ask me anything about its contents.`,
        isIntro: true,
      }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading || !docText) return;

    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = `You are a precise document analyst. You have been given the full text of a document to analyze.

DOCUMENT: ${document?.name}
---
${docText}
---

Rules:
- Answer questions based ONLY on the content in the document above
- If the answer isn't in the document, say so clearly
- When citing information, reference the specific section, page, or part of the document
- Be concise but thorough
- Format your responses clearly with bullet points or numbered lists when appropriate
- If asked to summarize, provide a structured summary with key sections`;

      const apiMessages = newMessages
        .filter(m => !m.isIntro)
        .map(m => ({ role: m.role, content: m.content }));

      if (apiMessages.length === 0 || apiMessages[0].role !== "user") {
        apiMessages.unshift({ role: "user", content: input.trim() });
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "API error");

      const reply = data.content[0]?.text || "No response generated.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}`, isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function formatMessage(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d1117; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.surface, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: "16px", color: COLORS.text, letterSpacing: "-0.02em" }}>
          📄 Document <span style={{ color: COLORS.accent }}>Q&A</span>
        </div>
        {document && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ fontSize: "11px", padding: "3px 10px", background: COLORS.accentPale, border: `1px solid rgba(200,169,110,0.2)`, color: COLORS.accent, borderRadius: "20px" }}>
              {document.type}
            </div>
            <div style={{ fontSize: "12px", color: COLORS.textDim }}>{document.name}</div>
            <button
              onClick={() => { setDocument(null); setDocText(""); setMessages([]); setError(null); }}
              style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.muted, padding: "4px 10px", borderRadius: "6px", fontSize: "11px", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
            >
              New Document
            </button>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: "860px", margin: "0 auto", width: "100%", padding: "32px 32px 0" }}>

        {/* Upload Zone */}
        {!document && !extracting && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? COLORS.accent : COLORS.border}`,
              borderRadius: "16px",
              padding: "80px 40px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? COLORS.accentPale : COLORS.surface,
              transition: "all 0.2s",
              marginBottom: "24px",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "20px" }}>📄</div>
            <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "20px", fontWeight: 700, color: COLORS.text, marginBottom: "8px", letterSpacing: "-0.02em" }}>
              Drop your document here
            </div>
            <div style={{ fontSize: "14px", color: COLORS.textDim, marginBottom: "24px" }}>
              or click to browse
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              {["PDF", "DOCX", "TXT", "CSV", "MD"].map(type => (
                <span key={type} style={{ fontSize: "11px", padding: "4px 12px", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, color: COLORS.textDim, borderRadius: "20px" }}>{type}</span>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.csv,.md"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {extracting && (
          <div style={{ textAlign: "center", padding: "80px 0", color: COLORS.accentDim, fontSize: "13px", letterSpacing: "0.1em", animation: "pulse 1.5s ease-in-out infinite" }}>
            Reading document...
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.3)`, borderRadius: "8px", padding: "16px", color: COLORS.red, fontSize: "13px", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {/* Chat */}
        {document && (
          <>
            {/* Doc Info Bar */}
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "10px", padding: "12px 20px", marginBottom: "16px", display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "10px", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>File</div>
                <div style={{ fontSize: "13px", color: COLORS.text, fontWeight: 500 }}>{document.name}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>Size</div>
                <div style={{ fontSize: "13px", color: COLORS.text }}>{document.size}</div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>Characters</div>
                <div style={{ fontSize: "13px", color: COLORS.text }}>{document.chars.toLocaleString()}</div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={chatRef}
              style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px", minHeight: "300px", maxHeight: "calc(100vh - 340px)" }}
            >
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%",
                    padding: "14px 18px",
                    borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: msg.role === "user" ? COLORS.accentPale : COLORS.surface,
                    border: `1px solid ${msg.role === "user" ? "rgba(200,169,110,0.2)" : COLORS.border}`,
                    fontSize: "14px",
                    color: msg.isError ? COLORS.red : COLORS.text,
                    lineHeight: "1.7",
                  }}
                    dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                  />
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ padding: "14px 18px", borderRadius: "12px 12px 12px 2px", background: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: COLORS.accentDim, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Input Bar */}
      {document && (
        <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "16px 32px", background: COLORS.surface, flexShrink: 0 }}>
          <div style={{ maxWidth: "860px", margin: "0 auto", display: "flex", gap: "12px" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask anything about this document..."
              style={{
                flex: 1,
                background: COLORS.surface2,
                border: `1px solid ${COLORS.border}`,
                color: COLORS.text,
                padding: "12px 16px",
                fontSize: "14px",
                borderRadius: "8px",
                fontFamily: "'Inter', sans-serif",
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                padding: "12px 24px",
                background: loading || !input.trim() ? COLORS.surface2 : COLORS.accent,
                color: loading || !input.trim() ? COLORS.muted : COLORS.bg,
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: loading || !input.trim() ? "default" : "pointer",
                fontFamily: "'Inter', sans-serif",
                flexShrink: 0,
              }}
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}