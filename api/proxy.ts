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
    // 2. 处理 Gemini 请求
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

    // 新增：针对 SaaS 结果图保存在后端的标准流程 (直传 OSS + commit)
    if (url.includes('upload-result')) {
      if (req.method !== 'POST') return res.status(405).end();
      const { userId, toolId, imageBase64, mimeType, fileName } = req.body;
      
      if (!userId || !toolId || !imageBase64) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const SAAS_BASE = "http://aibigtree.com";
      const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');

      try {
        // 1. 申请 OSS Token
        console.log("SaaS Flow: Requesting upload token...");
        const tokenRes = await axios.post(`${SAAS_BASE}/api/upload/direct-token`, {
          userId, toolId, source: 'result', mimeType: mimeType || 'image/png', fileName: fileName || 'result.png', fileSize: imageBuffer.length
        }, { timeout: 15000 });
        if (!tokenRes.data.success) throw new Error(tokenRes.data.error || "Token request failed");

        const { uploadUrl, objectKey, headers } = tokenRes.data;

        // 2. 直接上传 OSS (PUT)
        console.log("SaaS Flow: Uploading to OSS...");
        await axios.put(uploadUrl, imageBuffer, {
          headers: { ...headers, 'Content-Length': imageBuffer.length },
          timeout: 30000
        });

        // 3. 提交确认入库
        console.log("SaaS Flow: Committing upload...");
        const commitRes = await axios.post(`${SAAS_BASE}/api/upload/commit`, {
          userId, toolId, source: 'result', objectKey, fileSize: imageBuffer.length
        }, { timeout: 15000 });

        return res.status(200).json(commitRes.data);
      } catch (err: any) {
        console.error("SaaS Upload Result Error:", err.message);
        return res.status(500).json({ error: err.message, details: err.response?.data });
      }
    }

    // 3. 处理 SaaS 平台工具接口转发 (/api/tool/*, /api/upload/*, /api/coze/*)
    const isSaasPath = url.includes('/api/tool/') || url.includes('/api/upload/') || url.includes('/api/coze/');

    if (isSaasPath) {
      const match = url.match(/\/api\/(tool|upload|coze)\/(.+)/);
      if (!match) return res.status(404).json({ error: "Invalid SaaS proxy path" });
      
      const type = match[1];
      const targetPath = match[2];
      const finalUrl = `http://aibigtree.com/api/${type}/${targetPath}`;
      console.log(`Proxying ${req.method} to SaaS:`, finalUrl);
      
      const saasResponse = await axios({
        method: req.method as any,
        url: finalUrl,
        data: req.method === 'GET' ? undefined : req.body,
        params: req.method === 'GET' ? req.query : undefined,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      return res.status(saasResponse.status).json(saasResponse.data);
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
