import express from "express";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini AI
const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY. Please set it in the Secrets panel.');
  }
  return new GoogleGenAI({ apiKey });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // CORS and Iframe headers
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  const proxyRequest = async (req: express.Request, res: express.Response, targetPath: string) => {
    const targetUrl = `http://aibigtree.com${targetPath}`;
    try {
      const response = await axios({
        method: req.method as any,
        url: targetUrl,
        data: req.method === 'GET' ? undefined : req.body,
        params: req.method === 'GET' ? req.query : undefined,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`Proxy error for ${targetPath}:`, error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败" });
    }
  };

  // Unified AI Proxy Route
  app.post("/api/gemini", async (req, res) => {
    try {
      const { model, payload } = req.body;
      const ai = getAIClient();
      
      const response = await ai.models.generateContent({
        model: model || "gemini-1.5-flash",
        contents: payload.contents,
        config: payload.generationConfig || payload.config
      });
      
      res.json({
        text: response.text,
        candidates: response.candidates
      });
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Handle standard SaaS result image preservation flow (Request Token -> PUT OSS -> Commit)
  app.post("/api/upload-result", async (req, res) => {
    const { userId, toolId, imageBase64, mimeType, fileName } = req.body;
    
    if (!userId || !toolId || !imageBase64) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const SAAS_BASE = "http://aibigtree.com";
    const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');

    try {
      // 1. Request OSS Token
      const tokenRes = await axios.post(`${SAAS_BASE}/api/upload/direct-token`, {
        userId, toolId, source: 'result', mimeType: mimeType || 'image/png', fileName: fileName || 'result.png', fileSize: imageBuffer.length
      }, { timeout: 15000 });
      if (!tokenRes.data.success) throw new Error(tokenRes.data.error || "Token request failed");

      const { uploadUrl, objectKey, headers } = tokenRes.data;

      // 2. Upload to OSS (PUT)
      await axios.put(uploadUrl, imageBuffer, {
        headers: { ...headers, 'Content-Length': imageBuffer.length },
        timeout: 30000
      });

      // 3. Commit to database
      const commitRes = await axios.post(`${SAAS_BASE}/api/upload/commit`, {
        userId, toolId, source: 'result', objectKey, fileSize: imageBuffer.length
      }, { timeout: 15000 });

      res.json(commitRes.data);
    } catch (err: any) {
      console.error("SaaS Upload Result Error:", err.message);
      res.status(500).json({ error: err.message, details: err.response?.data });
    }
  });

  // SaaS routes
  app.all("/api/tool/*", (req, res) => proxyRequest(req, res, req.path));
  app.all("/api/upload/*", (req, res) => proxyRequest(req, res, req.path));
  app.all("/api/coze/*", (req, res) => proxyRequest(req, res, req.path));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
