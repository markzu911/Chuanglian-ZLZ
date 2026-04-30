import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import axios from 'axios';

// 配置 Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vercel rewrites 可能会导致 req.url 变化，我们根据实际路径处理
  const url = req.url || '';
  console.log("Request URL:", url);

  try {
    // 1. 处理 Gemini 请求
    if (url.includes('gemini')) {
      if (req.method !== 'POST') return res.status(405).end();
      
      const { model, payload } = req.body;
      
      const response = await ai.models.generateContent({
        model: model || "gemini-1.5-flash",
        contents: payload.contents,
        config: payload.generationConfig || payload.config
      });

      // 特殊处理：如果是图片生成模型，返回结构可能包含 candidates
      return res.status(200).json({
        text: response.text || "",
        candidates: response.candidates
      });
    }

    // 2. 处理 SaaS 平台工具接口转发 (/api/tool/*)
    if (url.includes('/api/tool/')) {
      // 提取 tool/ 之后的路径
      const match = url.match(/\/api\/tool\/(.+)/);
      if (!match) return res.status(404).json({ error: "Invalid tool path" });
      
      const targetPath = match[1];
      console.log("Proxying to SaaS tool:", targetPath);
      
      const saasResponse = await axios.post(`http://aibigtree.com/api/tool/${targetPath}`, req.body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      return res.status(200).json(saasResponse.data);
    }

    return res.status(404).json({ error: `Not Found: ${url}` });
  } catch (error: any) {
    console.error("API Proxy Error:", error.message);
    return res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data || "Internal Server Error"
    });
  }
}
