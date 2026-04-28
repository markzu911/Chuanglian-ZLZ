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
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: { 'Content-Type': 'application/json' }
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`Proxy error for ${targetPath}:`, error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "代理转发失败" });
    }
  };

  // SaaS API Routes
  app.post("/api/tool/launch", (req, res) => proxyRequest(req, res, "/api/tool/launch"));
  app.post("/api/tool/verify", (req, res) => proxyRequest(req, res, "/api/tool/verify"));
  app.post("/api/tool/consume", (req, res) => proxyRequest(req, res, "/api/tool/consume"));

  // AI Routes
  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const { image, type } = req.body;
      const ai = getAIClient();
      const base64Data = image.split(',')[1];
      
      const prompt = type === 'scene' 
        ? "请分析这张室内房间图片，识别以下特征并以简短的词汇描述：房间类型、装修风格、地板材质、墙面装饰、灯光氛围、房间主色调、现有家具。请以 JSON 格式返回，键名为：roomType, style, floor, wall, lighting, color, furniture。"
        : "请分析这张窗帘产品图片，识别其物理特征：颜色、材质属性、纹理、拼接花纹、表面质感。请以 JSON 格式返回，键名为：color, material, texture, pattern, surface。";

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: prompt }
          ]
        }],
        config: {
          responseMimeType: "application/json"
        }
      });
      
      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { parts, config } = req.body;
      const ai = getAIClient();
      
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [{
          role: 'user',
          parts: parts
        }],
        config: config
      });
      
      res.json(response);
    } catch (error: any) {
      console.error("AI Generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

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
