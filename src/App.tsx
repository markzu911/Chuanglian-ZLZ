/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Upload, 
  History, 
  Layers, 
  Plus, 
  Sparkles, 
  Loader2,
  CheckCircle2,
  X,
  Maximize2,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI
const getAIClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY. Please set it in the Secrets panel.');
  }
  return new GoogleGenAI({ apiKey });
};

interface SceneData {
  roomType: string;
  style: string;
  floor: string;
  wall: string;
  lighting: string;
  color: string;
  furniture: string;
  window: string;
}

interface CurtainData {
  material: string;
  texture: string;
  pattern: string;
  surface: string;
  color: string;
}

const Sidebar = ({ view, setView, userData, toolData }: { 
  view: 'editor' | 'history', 
  setView: (v: 'editor' | 'history') => void,
  userData: { name: string, integral: number } | null,
  toolData: { name: string, integral: number } | null
}) => (
  <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 p-6 z-20">
    <div className="flex items-center gap-2 mb-10 cursor-pointer" onClick={() => setView('editor')}>
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
        <Layers size={18} />
      </div>
      <h1 className="font-bold text-slate-800 tracking-tight">智能窗帘生成</h1>
    </div>
    
    <nav className="space-y-2 flex-1">
      <button 
        onClick={() => setView('editor')}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${view === 'editor' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        <Plus size={18} />
        <span>开始创作</span>
      </button>
      <button 
        onClick={() => setView('history')}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${view === 'history' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
      >
        <History size={18} />
        <span>历史记录</span>
      </button>
    </nav>
    
    {userData && (
      <div className="mt-auto pt-6 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>用户账户</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{userData.name}</span>
            <div className="flex items-center gap-1">
              <Sparkles size={10} className="text-blue-500" />
              <span className="text-xs text-blue-600 font-bold">{userData.integral}</span>
            </div>
          </div>
          {toolData && (
            <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center">
              <span className="text-[10px] text-slate-400">单次渲染</span>
              <span className="text-[10px] text-slate-500 font-bold">{toolData.integral} 积分</span>
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

const SectionTitle = ({ number, title, subtitle }: { number: string; title: string; subtitle: string }) => (
  <div className="mb-6">
    <div className="flex items-baseline gap-2">
      <span className="text-xl font-bold text-slate-800">{number}.</span>
      <h2 className="text-xl font-bold text-slate-800">{title}</h2>
    </div>
    {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
  </div>
);

export default function App() {
  const [view, setView] = useState<'editor' | 'history'>('editor');
  const [history, setHistory] = useState<Array<{ id: string, image: string, timestamp: number, composition: string }>>([]);

  // SaaS Integration State
  const [userId, setUserId] = useState<string | null>(null);
  const [toolId, setToolId] = useState<string | null>(null);
  const [saasConfig, setSaasConfig] = useState<{ context?: string, prompt?: string[] } | null>(null);
  const [userData, setUserData] = useState<{ name: string, integral: number } | null>(null);
  const [toolData, setToolData] = useState<{ name: string, integral: number } | null>(null);
  const [isSaasInitialized, setIsSaasInitialized] = useState(false);

  // SaaS Message Listener
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data && data.type === 'SAAS_INIT') {
        const { userId, toolId, context, prompt } = data;
        if (userId && userId !== "null" && userId !== "undefined") setUserId(userId);
        if (toolId && toolId !== "null" && toolId !== "undefined") setToolId(toolId);
        setSaasConfig({ context, prompt });
        setIsSaasInitialized(true);
      }
    };

    window.addEventListener('message', handleMessage);
    // For local testing if not in iframe
    if (window.location.search.includes('mock=true')) {
       window.postMessage({ type: 'SAAS_INIT', userId: 'test_user', toolId: 'curtain_tool', context: '现代简约风客厅', prompt: ['高质感', '丝绒'] }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Launch API
  React.useEffect(() => {
    if (isSaasInitialized && userId && toolId) {
      const fetchLaunch = async () => {
        try {
          const res = await fetch('/api/tool/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, toolId })
          });
          const result = await res.json();
          if (result.success) {
            setUserData(result.data.user);
            setToolData(result.data.tool);
          }
        } catch (err) {
          console.error("Launch failed:", err);
        }
      };
      fetchLaunch();
    }
  }, [isSaasInitialized, userId, toolId]);

  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [curtainImage, setCurtainImage] = useState<string | null>(null);
  const [isAnalyzingScene, setIsAnalyzingScene] = useState(false);
  const [isAnalyzingCurtain, setIsAnalyzingCurtain] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);

  const [sceneData, setSceneData] = useState<SceneData>({
    roomType: '',
    style: '',
    floor: '',
    wall: '',
    lighting: '',
    color: '',
    furniture: '',
    window: '',
  });

  const [curtainData, setCurtainData] = useState<CurtainData | null>(null);

  // Sync SaaS Context to Scene Data
  React.useEffect(() => {
    if (saasConfig?.context) {
      setSceneData(prev => ({ 
        ...prev, 
        roomType: saasConfig.context || prev.roomType 
      }));
    }
    if (saasConfig?.prompt && saasConfig.prompt.length > 0) {
      setSceneData(prev => ({
        ...prev,
        furniture: prev.furniture ? `${prev.furniture}, ${saasConfig.prompt?.join(', ')}` : saasConfig.prompt?.join(', ') || ''
      }));
    }
  }, [saasConfig]);

  const [aspectRatio, setAspectRatio] = useState('3:4');
  const [quality, setQuality] = useState('2K');
  const [selectedCompositions, setSelectedCompositions] = useState<string[]>(['场景全景']);

  const toggleComposition = (comp: string) => {
    setSelectedCompositions(prev => 
      prev.includes(comp) 
        ? prev.filter(c => c !== comp) 
        : [...prev, comp]
    );
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const curtainInputRef = useRef<HTMLInputElement>(null);

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `curtain-render-${Date.now()}.png`;
    link.click();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const analyzeScene = async (base64: string) => {
    setIsAnalyzingScene(true);
    try {
      const ai = getAIClient();
      const base64Data = base64.split(',')[1];
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: "请分析这张室内房间图片，识别以下特征并以简短的词汇描述：房间类型、装修风格、地板材质、墙面装饰、灯光氛围、房间主色调、现有家具。请以 JSON 格式返回，键名为：roomType, style, floor, wall, lighting, color, furniture。" }
          ]
        }],
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const data = JSON.parse(response.text);
      setSceneData(data);
    } catch (error) {
      console.error("Scene analysis failed:", error);
    } finally {
      setIsAnalyzingScene(false);
    }
  };

  const analyzeCurtain = async (base64: string) => {
    setIsAnalyzingCurtain(true);
    try {
      const ai = getAIClient();
      const base64Data = base64.split(',')[1];
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: "请分析这张窗帘产品图片，识别其物理特征：颜色、材质属性、纹理、拼接花纹、表面质感。请以 JSON 格式返回，键名为：color, material, texture, pattern, surface。" }
          ]
        }],
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const data = JSON.parse(response.text);
      setCurtainData(data);
    } catch (error) {
      console.error("Curtain analysis failed:", error);
    } finally {
      setIsAnalyzingCurtain(false);
    }
  };

  const handleGenerate = async () => {
    if (!sceneImage || !curtainImage || selectedCompositions.length === 0) {
      alert("请先上传场景图和窗帘图，并至少选择一个构图角度");
      return;
    }

    // SaaS Verify Step
    if (userId && toolId) {
      try {
        const verifyRes = await fetch('/api/tool/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, toolId })
        });
        const verifyResult = await verifyRes.json();
        if (!verifyResult.success) {
          alert(verifyResult.message || "积分不足，无法生成");
          return;
        }
      } catch (err) {
        console.error("Verify failed:", err);
        // Relaxed check: if API fails, might still allow for demo purposes but alert developer
      }
    }
    
    // Switch to history tab immediately
    setView('history');
    
    setIsGenerating(true);
    setResultImage(null);

    const generatedResults: Array<{ url: string, composition: string }> = [];

    try {
      const ai = getAIClient();

      // Combine SaaS Prompts
      const saasContext = saasConfig?.context ? `\nSaaS Context: ${saasConfig.context}` : "";
      const saasPrompts = saasConfig?.prompt?.length ? `\nSaaS Additional Keywords: ${saasConfig.prompt.join(', ')}` : "";

      for (const currentComp of selectedCompositions) {
        let compositionPrompt = "";
        if (currentComp === '场景全景') {
          compositionPrompt = `
            High-End Interior Design Showroom Shot — Full Room:
            - Concept: Create a NEW, professionally designed interior scene that captures the ESSENCE and STYLE of the original room, but feels like an upgraded, luxury showroom version. ${saasContext}
            - Style & Vibe: STRICTLY adhere to the identified style (${sceneData?.style}) and color palette (${sceneData?.color}). ${saasPrompts}
            - Furniture & Decor: Incorporate furniture pieces (${sceneData?.furniture}) that match the high-end aesthetic of the identified style. They should be arranged in a professional, balanced, "catalog-ready" composition.
            - Architectural Details: High-quality ${sceneData?.floor} flooring and ${sceneData?.wall} wall finishes that complement the overall design.
            - Curtain Integration: The primary focus is the BRAND NEW curtain installation featuring material (${curtainData?.material}) and pattern (${curtainData?.pattern}). The curtains should hang perfectly from floor to ceiling as a grand focal point.
            - Lighting: Cinematic, layered natural lighting matching the atmospheric vibe (${sceneData?.lighting}).
            - Model Inclusion: An elegant East Asian female model in sophisticated loungewear, positioned center-left. She is interacting with the curtain (e.g., gently adjusting the folds), highlighting the fabric's natural fall, weight, and volume.
            - Goal: A professionally crafted commercial interior photograph that showcases how the new curtains transform a stylish room.
          `;
        } else if (currentComp === '效果中景') {
          compositionPrompt = `
            High-End Lifestyle Interior Photography — SINGLE CAMERA VIEW (深度中景):
            - [MANDATORY COMPOSITION]: This is a SINGLE, UNIFIED interior photograph. PROHIBIT any split-screens, before/after lines, or collage patterns. ${saasContext}
            - [CAMERA MAGNIFICATION]: Simulate a physical camera move CLOSER (zoom in) by 1.5 meters. The focus remains on the specific window and curtains from the source. ${saasPrompts}
            - [MODEL SOLIDITY]: The model MUST be a 100% OPAQUE, SOLID human figure. Her hand MUST be anatomically attached to her arm and body. NO ghosting, NO fading, NO transparency.
            - [SHADOW LOGIC]: The model must cast a realistic, integrated shadow onto the curtain and floor to prove physical presence.
            - [ERROR PREVENTION]: NO second model. NO floating limbs. NO vertical dividing lines in the background. The background architecture MUST be ONE continuous surface without "jumps" in perspective.
            - Model Detail: East Asian female, elegant side profile, chic beige tweed jacket. She is interacting with the ${curtainData?.texture || 'textile'} curtain naturally.
          `;
        } else if (currentComp === '材质特写') {
          compositionPrompt = `
            macro detail shot of layered curtain fabric, extreme close-up, 
            natural side-backlight filtering through linen and sheer voile, 
            warm golden hour glow creating soft gradient from bright to shadow, 
            textured natural linen weave with visible fiber grain, ${saasContext}
            delicate tonal embroidery of botanical leaf pattern, ${saasPrompts}
            shallow depth of field with gentle bokeh on background folds, 
            cream and warm beige monochromatic palette, 
            light catching on fabric ridges, subtle translucency on sheer layer, 
            quiet luxury textile detail, soft atmospheric haze, 
             macro lens, photorealistic material rendering
          `;
        }

        let finalPrompt = "";
        let parts: any[] = [];

        if (currentComp === '材质特写') {
          finalPrompt = `
            Generate an extremely high-quality macro detail shot of the provided curtain fabric.
            
            Specific Visual Reference (CURTAIN IMAGE):
            - Material: ${curtainData?.material || 'High-end fabric'}
            - Color: ${curtainData?.color || 'Original'}
            - Texture: ${curtainData?.texture || 'Detailed weave'}
            - Pattern: ${curtainData?.pattern || 'As shown'}
            
            Visual Shot Description:
            ${compositionPrompt}
            
            Technical Requirements:
            - Focus: Sharp on the fabric's micro-fibers and texture.
            - Quality: 8k resolution, photorealistic, material rendering.
          `;
          parts = [
            { inlineData: { mimeType: "image/jpeg", data: curtainImage.split(',')[1] } },
            { text: finalPrompt + "\n\nIMPORTANT: Since you are a multimodal model, please describe the final image in extreme detail as if you were an expert prompt engineer, then generate the base64 image data." }
          ];
        } else {
          const isMediumShot = currentComp === '效果中景';
          const roomPrompt = `
            Based on the provided scene and curtain details, generate a high-quality rendering image.
            
            Scene Details:
            - Room Type: ${sceneData.roomType}
            - Style: ${sceneData.style}
            - Flooring: ${sceneData.floor}
            - Walls: ${sceneData.wall}
            - Lighting: ${sceneData.lighting}
            - Main Colors: ${sceneData.color}
            - Furniture & Decor (STRICT DYNAMIC MAPPING): ${sceneData.furniture}. The AI MUST recreate the scene using ONLY these items. If items were edited in the text field, reflect those changes in the final image.
            - Architectural Consistency: ${isMediumShot ? 'Move the camera 1.5m CLOSER to the subject. Maintain ONE continuous room background.' : 'Maintain the original panoramic room framing exactly.'}
            - GLOBAL SYNTHESIS RULE: Generate ONE single, continuous, and realistic photograph. PROHIBIT all split screens, collage patterns, and vertical/horizontal dividing lines.
            - Background/Style Context: ${saasContext} ${saasPrompts}
            
            Curtain Product Details (ONLY CHANGE IN THE SCENE):
            - Replace the existing window treatment with curtains featuring:
            - Material: ${curtainData?.material || 'Curtain fabric'}
            - Texture: ${curtainData?.texture || 'Smooth'}
            - Pattern: ${curtainData?.pattern || 'Solid'}
            - Surface: ${curtainData?.surface || 'Soft'}
            
            Rendering Parameters:
            - Composition: ${compositionPrompt}
            - Quality: Highly detailed, photorealistic, premium e-commerce lifestyle photography, 8k resolution.
            - Lighting Consistency: The lighting on the curtains and any added model MUST perfectly match the ambient lighting of the original scene.
          `;
          finalPrompt = roomPrompt;
          parts = [
            { inlineData: { mimeType: "image/jpeg", data: sceneImage.split(',')[1] } },
            { inlineData: { mimeType: "image/jpeg", data: curtainImage.split(',')[1] } },
            { text: finalPrompt + "\n\nIMPORTANT: Since you are a multimodal model, please describe the final image in extreme detail as if you were an expert prompt engineer, then generate the base64 image data." }
          ];
        }

        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image-preview",
          contents: [{
            role: 'user',
            parts: parts
          }],
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any,
              imageSize: quality === '4K' ? '4K' : (quality === '2K' ? '2K' : '1K')
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const generatedUrl = `data:image/png;base64,${part.inlineData.data}`;
            generatedResults.push({ url: generatedUrl, composition: currentComp });
            break;
          }
        }
      }

      if (generatedResults.length > 0) {
        // setResultImage(generatedResults[0].url); // REMOVED: Do not jump/popup automatically
        const newHistoryItems = generatedResults.map(res => ({
          id: `${Date.now()}-${res.composition}`,
          image: res.url,
          timestamp: Date.now(),
          composition: res.composition
        }));
        setHistory(prev => [...newHistoryItems, ...prev]);

        // SaaS Consume Step
        if (userId && toolId) {
          try {
            const consumeRes = await fetch('/api/tool/consume', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, toolId })
            });
            const consumeResult = await consumeRes.json();
            if (consumeResult.success) {
              setUserData(prev => prev ? { ...prev, integral: consumeResult.data.currentIntegral } : null);
            }
          } catch (err) {
            console.error("Consume failed:", err);
          }
        }
      }
    } catch (error: any) {
      console.error("Generation failed:", error);
      if (error?.message?.includes('PERMISSION_DENIED') || error?.message?.includes('403')) {
        alert("模型访问被拒绝 (403 Permission Denied)。这通常是因为当前 API Key 权限不足或模型名称暂不可用。请在设置中检查您的 Gemini API Key。");
      } else {
        alert("渲染引擎启动失败，请检查网络或重新尝试。");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 overflow-x-hidden">
      <Sidebar view={view} setView={setView} userData={userData} toolData={toolData} />
      
      <main className="flex-1 p-8 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {view === 'editor' ? (
            <motion.div 
              key="editor"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="max-w-7xl mx-auto grid grid-cols-12 gap-8"
            >
              <div className="col-span-12 lg:col-span-5 space-y-12">
                <section id="step-01">
                  <SectionTitle 
                    number="01" 
                    title="场景分析" 
                    subtitle="AI 自动识别房间风格与布局" 
                  />
                  <div className="bg-slate-100 p-8 rounded-[40px] relative group">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const base64 = await fileToBase64(file);
                          setSceneImage(base64);
                        }
                      }}
                    />
                    
                    {sceneImage ? (
                      <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                        <img src={sceneImage} className="w-full h-full object-cover" alt="Scene" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => setSceneImage(null)}
                          className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                        >
                          <X size={16} />
                        </button>
                        {isAnalyzingScene && (
                          <div className="absolute inset-0 bg-blue-600/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                            <Loader2 className="animate-spin mb-2" />
                            <span className="text-sm font-medium">识别中...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[4/3] bg-white border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-blue-400 transition-colors cursor-pointer group"
                      >
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                          <Upload size={20} />
                        </div>
                        <span className="text-slate-400 text-sm font-medium">点击上传房间照片</span>
                      </div>
                    )}
                  </div>
                </section>

                <section id="step-02">
                  <SectionTitle 
                    number="02" 
                    title="窗帘产品" 
                    subtitle="上传对应窗帘，我们将提取其物理特征" 
                  />
                  <div className="bg-slate-100 p-8 rounded-[40px] relative">
                    <input 
                      type="file" 
                      ref={curtainInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const base64 = await fileToBase64(file);
                          setCurtainImage(base64);
                        }
                      }}
                    />
                    <div className="aspect-[4/3] bg-white rounded-3xl flex flex-col items-center justify-center p-4">
                      {curtainImage ? (
                        <div className="relative h-full aspect-[3/4] rounded-2xl overflow-hidden shadow-md group">
                          <img src={curtainImage} className="w-full h-full object-cover" alt="Curtain" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => setCurtainImage(null)}
                            className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                          {isAnalyzingCurtain && (
                            <div className="absolute inset-0 bg-blue-600/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                              <Loader2 className="animate-spin mb-2" size={20} />
                              <span className="text-xs font-medium">分析中...</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div 
                          onClick={() => curtainInputRef.current?.click()}
                          className="w-32 h-44 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 transition-colors cursor-pointer"
                        >
                          <Plus size={24} className="text-blue-600" />
                          <span className="text-slate-400 text-xs">添加窗帘图</span>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => {
                        if (sceneImage) analyzeScene(sceneImage);
                        if (curtainImage) analyzeCurtain(curtainImage);
                      }}
                      disabled={!sceneImage || !curtainImage || isAnalyzingScene || isAnalyzingCurtain}
                      className="w-full mt-6 bg-blue-600 text-white rounded-2xl py-4 flex items-center justify-center gap-2 font-bold hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {isAnalyzingScene || isAnalyzingCurtain ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>正在分析图像特征...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          <span>分析图像</span>
                        </>
                      )}
                    </button>
                  </div>
                </section>
              </div>

              <div className="col-span-12 lg:col-span-7 space-y-12">
                <section id="step-03">
                  <SectionTitle 
                    number="03" 
                    title="环境特征" 
                    subtitle="微调房间氛围，AI将智能协调光感" 
                  />
                  <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 grid grid-cols-2 gap-x-8 gap-y-6">
                    {[
                      { label: "房间类型", key: "roomType", placeholder: "如：主卧、亲子房" },
                      { label: "装修风格", key: "style", placeholder: "如：奶油风、轻奢" },
                      { label: "地板材质", key: "floor", placeholder: "如：原木地板、米白瓷砖" },
                      { label: "墙面装饰", key: "wall", placeholder: "如：艺术漆、壁画" },
                      { label: "灯光氛围", key: "lighting", placeholder: "如：晨光自然、微醺暖阳" },
                      { label: "房间主色调", key: "color", placeholder: "如：莫兰迪色系" },
                    ].map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400">{field.label}</label>
                        <input 
                          type="text" 
                          value={sceneData[field.key as keyof SceneData]}
                          onChange={(e) => setSceneData({...sceneData, [field.key]: e.target.value})}
                          placeholder={field.placeholder} 
                          className="w-full bg-slate-50 border border-transparent rounded-xl py-4 px-5 text-sm focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                        />
                      </div>
                    ))}
                    <div className="col-span-2 space-y-2">
                      <label className="text-xs font-semibold text-slate-400">现有家具（输入多个家具，用逗号或空格分隔）</label>
                      <input 
                        type="text" 
                        value={sceneData.furniture}
                        onChange={(e) => setSceneData({...sceneData, furniture: e.target.value})}
                        placeholder="如：真皮沙发、落地灯" 
                        className="w-full bg-slate-50 border border-transparent rounded-xl py-4 px-5 text-sm focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none" 
                      />
                    </div>
                  </div>
                </section>

                <section id="step-04">
                  <SectionTitle 
                    number="04" 
                    title="渲染参数" 
                    subtitle="" 
                  />
                  <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 space-y-10">
                    <div className="space-y-4">
                      <label className="text-xs font-semibold text-slate-400">拍摄比例</label>
                      <div className="grid grid-cols-4 gap-4">
                        {['1:1', '3:4', '4:3', '16:9'].map(ratio => (
                          <button 
                            key={ratio}
                            onClick={() => setAspectRatio(ratio)}
                            className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                              aspectRatio === ratio 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-12">
                      <div className="space-y-4">
                        <label className="text-xs font-semibold text-slate-400">渲染画质</label>
                        <div className="flex gap-2">
                          {['1K', '2K', '4K'].map(q => (
                            <button 
                              key={q}
                              onClick={() => setQuality(q)}
                              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                                quality === q
                                  ? 'bg-blue-50 border-blue-400 text-blue-600' 
                                  : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-xs font-semibold text-slate-400">构图角度 (可多选)</label>
                        <div className="space-y-2">
                          {['场景全景', '效果中景', '材质特写'].map(comp => {
                            const isSelected = selectedCompositions.includes(comp);
                            return (
                              <button 
                                key={comp}
                                onClick={() => toggleComposition(comp)}
                                className={`w-full py-3 px-5 rounded-xl border text-sm font-medium text-left flex justify-between items-center transition-all ${
                                  isSelected
                                    ? 'bg-blue-50 border-blue-400 text-blue-600' 
                                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                }`}
                              >
                                <span>{comp}</span>
                                {isSelected && <CheckCircle2 size={16} className="text-blue-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating || !sceneImage || !curtainImage}
                      className="w-full bg-slate-900 text-white rounded-2xl py-6 flex items-center justify-center gap-3 font-bold hover:bg-slate-800 transition-all active:scale-[0.98] mt-4 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden relative"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 size={20} className="animate-spin text-blue-400" />
                          <span className="tracking-widest">
                            正在生成 ({history.length > 0 && selectedCompositions.length > 1 ? `队列处理中` : '实景渲染引擎'}... )
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={20} className="text-blue-400 group-hover:scale-125 transition-transform" />
                          <span className="tracking-widest">05. 开启实景渲染</span>
                        </>
                      )}
                      {isGenerating && (
                        <motion.div 
                          className="absolute inset-x-0 bottom-0 h-1 bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 15, ease: "linear" }}
                        />
                      )}
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-7xl mx-auto"
            >
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">历史生成记录</h2>
                  <p className="text-slate-400 mt-2">在这里您可以查看并下载过往的所有渲染作品</p>
                </div>
                <button 
                  onClick={() => setView('editor')}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  <span>新建渲染</span>
                </button>
              </div>

              {history.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {history.map((item) => (
                    <motion.div 
                      key={item.id}
                      layoutId={item.id}
                      onClick={() => setResultImage(item.image)}
                      className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 hover:shadow-xl transition-all cursor-pointer group"
                    >
                      <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4 bg-slate-100 relative">
                        <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="History render" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 size={24} className="text-white" />
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">{item.composition}</p>
                          <p className="text-slate-400 text-xs mt-1">
                            {new Date(item.timestamp).toLocaleString('zh-CN', { 
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            })}
                          </p>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(item.image);
                          }}
                          className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-colors"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center text-slate-300">
                  <ImageIcon size={48} className="mb-4 opacity-20" />
                  <p>暂无渲染记录，快去开启您的第一次实景创作吧</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {resultImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center p-8 backdrop-blur-xl"
            onClick={() => setResultImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-w-5xl w-full bg-white rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-full max-h-[800px]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex-1 bg-black flex items-center justify-center p-8 overflow-hidden">
                <img src={resultImage} className="max-h-full max-w-full object-contain rounded-xl shadow-2xl" alt="Generated Result" referrerPolicy="no-referrer" />
              </div>
              <div className="w-full md:w-80 p-8 border-l border-slate-100 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-2xl text-slate-800">渲染完成</h3>
                      <p className="text-slate-400 text-sm mt-1">AI 已根据您的设置生成最终实景</p>
                    </div>
                    <button onClick={() => setResultImage(null)} className="text-slate-300 hover:text-slate-900">
                      <X size={24} />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">构图角度</p>
                      <p className="font-medium text-slate-700">{selectedCompositions.join(', ')}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">拍摄比例</p>
                      <p className="font-medium text-slate-700">{aspectRatio}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={() => downloadImage(resultImage!)}
                    className="w-full bg-blue-600 text-white rounded-xl py-4 font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    <span>下载高清图</span>
                  </button>
                  <button 
                    onClick={() => setResultImage(null)}
                    className="w-full bg-slate-100 text-slate-600 rounded-xl py-3 font-bold hover:bg-slate-200 transition-colors"
                  >
                    返回编辑器
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
