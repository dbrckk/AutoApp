import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import OpenAI from 'openai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FileSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    path: {
      type: Type.STRING,
      description: 'The exact path of the file, starting with a slash (e.g. /App.tsx, /package.json, /src/utils.ts).'
    },
    content: {
      type: Type.STRING,
      description: 'The complete file content. If this is an external asset like an image or document that you cannot generate text for, use a placeholder URL (e.g. from pollinations.ai) if it is an image, otherwise leave blank or provide brief instructions.'
    }
  },
  required: ['path', 'content']
};

const GenerateResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    files: {
      type: Type.ARRAY,
      items: FileSchema,
      description: 'The list of files to create, update, or delete. To delete, set content to null.'
    },
    changelog: {
      type: Type.STRING,
      description: 'A brief summary of the changes made, explaining the improvements or the new app structure.'
    },
    estimatedTimeSaved: {
      type: Type.STRING,
      description: 'A fun string estimating how much time this automated generation saved the user.'
    }
  },
  required: ['files', 'changelog', 'estimatedTimeSaved']
};

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, currentFiles, isAutoImprove, aiConfig } = req.body;

    const provider = aiConfig?.provider || 'gemini';
    const MAX_CONTEXT_CHARS = provider === 'gemini' ? 200000 : 30000;
    let currentChars = 0;

    const filteredFiles = Array.isArray(currentFiles) 
      ? currentFiles.filter(f => !f.path.endsWith('package-lock.json') && !f.path.endsWith('yarn.lock')).map((f: any) => {
          const isLockFile = f.path.endsWith('.svg');
          const isTooLarge = f.content && f.content.length > 50000;
          
          if (isLockFile || isTooLarge) {
             return { ...f, content: '// Content omitted (too large or binary)' };
          }

          if (currentChars + f.content.length > MAX_CONTEXT_CHARS) {
             return { ...f, content: '// Content omitted to fit within model context limits. Ask the user if you need to see this file to make edits.' };
          }
          
          currentChars += f.content.length;
          return f;
        })
      : [];

    const fileContext = filteredFiles.length > 0 
      ? `Here are the currently existing files in the project:\n${filteredFiles.map((f: any) => `\n--- ${f.path} ---\n${f.content.replace(/\n{3,}/g, '\n\n')}`).join('\n')}`
      : 'This is a brand new project. Please generate the initial boilerplate (e.g., package.json, App.tsx, etc.)';

    const autoImproveContext = isAutoImprove 
      ? "\n*** AUTO-IMPROVE MODE ACTIVE ***\nThe user wants this app to reach 'Play Store Publishing' perfection automatically. Review the current code. If it lacks polish, error handling, visual flair, or core features, make those improvements now. \nIf (and ONLY if) the app is absolutely perfect, complete, production-ready, beautifully styled, and fully featured, include the exact string 'PERFECT_READY_TO_PUBLISH' in your changelog. Otherwise, just explain what you improved in this step in the changelog."
      : "";

    const fullPrompt = `
You are an expert cross-platform mobile and web application generator (Forge AI). 
The user wants to generate or improve an app. The app must be cross-platform (Windows, macOS, Linux, iOS, Android).
Recommend creating an Expo React Native application or a React+Vite PWA.
Provide the entire contents of all modified and newly created files. 
You must generate perfect, production-ready, beautifully styled, and bug-free code.
Always use free libraries/frameworks. If images are needed, use valid https://image.pollinations.ai/prompt/[encoded-prompt] URLs.

Critical Instructions:
1. Ensure the app has a beautiful, modern, and mobile-first UI (use Tailwind CSS or React Native StyleSheet).
2. Generate all necessary boilerplate, config files (package.json, App.tsx, etc.), and components.
3. For React Native/Expo, configure app.json and babel.config.js appropriately.
4. For React/Vite, configure vite.config.ts and tailwind config appropriately.
5. Provide completely readable, clean, well-architected source code.
6. Include helpful comments explaining complex logic.
7. If improving an existing app, CRITICALLY ONLY OUTPUT FILES THAT HAVE ACTUALLY CHANGED. DO NOT output existing files if they do not need modification. Omit them entirely from the 'files' array to save tokens. If you only changed 1 file, only output that 1 file.
8. CRITICAL: NEVER output base64 encoded strings for images, audio, or video. Use URL placeholders instead. Base64 strings will crash the parsing system.
9. WARNING: You have a strict MAX_TOKENS limit (8192). To avoid hitting it and breaking the output, be concise. Never return large assets, massive data blobs, or the entire codebase if not necessary. Keep files as small and modular as possible.
${autoImproveContext}

USER REQUEST:
${prompt}

${fileContext}
`;

    let textPayload = '';
    let finishReason = '';

    if (provider === 'gemini') {
      let response;
      let lastErr: any;
      const geminiModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
      
      for (const modelToTry of geminiModels) {
        let retries = 2;
        let delay = 2000;
        let success = false;
        
        while (retries > 0) {
          try {
            console.log(`[Gemini] Attempting with model: ${modelToTry} (retries left: ${retries - 1})`);
            response = await ai.models.generateContent({
              model: modelToTry,
              contents: fullPrompt,
              config: {
                // gemini-1.5-flash occasionally chokes on structured output if we enforce the schema perfectly for large files, but schema gives best results.
                responseMimeType: 'application/json',
                responseSchema: GenerateResponseSchema,
                temperature: 0.2, // low temp for code generation stability
                maxOutputTokens: 8192,
                safetySettings: [
                  {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                  },
                  {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                  },
                  {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                  },
                  {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_NONE,
                  }
                ]
              }
            });
            success = true;
            lastErr = null;
            break; // Success, exit retry loop
          } catch (apiErr: any) {
            lastErr = apiErr;
            const errMsg = String(apiErr.message || '');
            const status = apiErr.status || apiErr.code;
            
            if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || status === 503 || status === 'UNAVAILABLE') {
              retries--;
              if (retries > 0) {
                console.warn(`Gemini API unavailable (503). Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2; // Exponential backoff
              }
            } else if (errMsg.includes('429') || status === 429 || errMsg.includes('exceeded your current quota')) {
               console.warn(`[Gemini] Hit quota/rate limit for ${modelToTry}. Falling back to next model... Details: ${errMsg}`);
               break; // break retry loop, go to NEXT model in outer loop
            } else {
               // For other errors, it might be a payload issue, let's try the next model just in case, or we can break.
               console.error(`[Gemini] Failed with error on ${modelToTry}: ${errMsg}`);
               break; // break retry loop, try next model
            }
          }
        }
        
        if (success) {
           break; // Break outer model loop We succeeded!
        }
      }

      if (lastErr && !response) {
         const errMsg = String(lastErr.message || '');
         throw new Error(`Rate limit, quota exceeded, or failure across all Gemini fallback models. Please try again later, or use a different AI provider in settings. Last error details: ${errMsg}`);
      }

      if (!response) {
        throw new Error("No response from AI and all retries failed");
      }
      textPayload = response.text || '';
      finishReason = response.candidates?.[0]?.finishReason || '';
    } else {
      // Custom OpenAI Compatible Provider
      const openai = new OpenAI({
        apiKey: aiConfig.apiKey,
        baseURL: aiConfig.baseUrl || undefined,
      });

      const userModel = aiConfig.model || 'llama-3.3-70b-versatile';
      const fallbackModels = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'gemma2-9b-it'
      ];
      
      const modelsToTry = [userModel];
      
      // If using Groq (inferred by models or base URL), add fallbacks
      if ((aiConfig.baseUrl || '').includes('groq') || fallbackModels.includes(userModel)) {
        fallbackModels.forEach(m => {
          if (!modelsToTry.includes(m)) modelsToTry.push(m);
        });
      }

      let completion;
      let lastErr: any;

      for (const modelToTry of modelsToTry) {
        try {
          console.log(`[OpenAI] Trying model: ${modelToTry}...`);
          completion = await openai.chat.completions.create({
            model: modelToTry,
            messages: [{ role: 'user', content: fullPrompt + '\n\nIMPORTANT: YOU MUST RETURN ONLY VALID JSON CONFORMING TO THIS SCHEMA: {"type":"object","properties":{"files":{"type":"array","items":{"type":"object","properties":{"path":{"type":"string"},"content":{"type":["string","null"]}}}},"changelog":{"type":"string"},"estimatedTimeSaved":{"type":"string"}},"required":["files","changelog","estimatedTimeSaved"]}  DO NOT WRAP IN MARKDOWN.'}],
            temperature: 0.2,
            response_format: { type: 'json_object' }
          });
          
          textPayload = completion.choices[0]?.message?.content || '';
          finishReason = completion.choices[0]?.finish_reason || '';
          lastErr = null; // Success!
          break; // Exit the loop
        } catch (openaiErr: any) {
          lastErr = openaiErr;
          const errMsg = String(openaiErr.message || '');
          const status = openaiErr.status || 500;
          
          if (status === 413 || errMsg.includes('413') || errMsg.includes('too large')) {
            throw new Error(`The request is too large for the selected model or provider. Your context size exceeded the token limits for ${modelToTry}. Try reducing the number of files or using a provider with larger limits. Details: ${errMsg}`);
          }
          
          if (status === 400 && openaiErr.error?.failed_generation) {
            textPayload = openaiErr.error.failed_generation;
            finishReason = 'json_validation_failed';
            lastErr = null;
            break; // We can try to recover
          }

          // If rate limit or server error, continue to next model in loop
          if (status === 429 || errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit') || status >= 500) {
            console.warn(`[OpenAI] Model ${modelToTry} failed with rate limit or server error. Trying next fallback... Details: ${errMsg}`);
            continue; 
          }
          
          // For other errors (e.g. 401 Unauthorized), just throw immediately
          throw openaiErr;
        }
      }

      if (lastErr && !textPayload) {
          const errMsg = String(lastErr.message || '');
          throw new Error(`Rate limit exceeded or provider unavailable across all attempted fallback models. Please try again later, or switch to a different AI provider in the settings. Last error details: ${errMsg}`);
      }

      if (!textPayload && completion) {
        textPayload = completion.choices[0]?.message?.content || '';
        finishReason = completion.choices[0]?.finish_reason || '';
      }
    }

    if (!textPayload) {
      throw new Error(`No response from AI. Finish reason: ${finishReason}`);
    }

    let payload;
    try {
      // First try to extract just JSON if there's markdown wrapping it
      let jsonStr = textPayload;
      if (jsonStr.includes('```json')) {
         const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
         if (match) jsonStr = match[1];
      } else if (jsonStr.includes('```')) {
         const match = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
         if (match) jsonStr = match[1];
      }

      // Try repairing in case of missing quotes or trailing commas
      const repairedJson = jsonrepair(jsonStr);
      payload = JSON.parse(repairedJson);

      // Validate schema minimally to prevent weird crashes later
      if (!payload.files || !Array.isArray(payload.files)) {
         // Auto-wrap if the model just returned a single file object or wrong shape
         if (payload.path && (payload.content !== undefined)) {
            payload = { files: [payload], changelog: 'Updated file based on prompt', estimatedTimeSaved: '1m' };
         } else if (payload.content) {
            payload = { files: [{ path: 'src/App.tsx', content: payload.content }], changelog: 'Updated code', estimatedTimeSaved: '1m' };
         } else {
            throw new Error('Generated JSON does not match the required schema (missing files array).');
         }
      }
    } catch (parseErr: any) {
      // Fallback: try to manually extract files using regex/string parsing and bypass strict JSON
      const files: any[] = [];
      try {
          const pathRegex = /"path"\s*:\s*"([^"]+)"/g;
          let match;
          let matches = [];
          while ((match = pathRegex.exec(textPayload)) !== null) {
              matches.push({ path: match[1], index: match.index });
          }
          
          if (matches.length === 0) {
              const contentMatch = textPayload.match(/"content"\s*:\s*"([\s\S]*)$/);
              if (contentMatch) {
                  let rawContent = contentMatch[1].replace(/"\s*\}?\s*\]?\s*\}?\s*$/, '');
                  rawContent = rawContent.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\t/g, '\t');
                  payload = { files: [{ path: 'src/App.tsx', content: rawContent }], changelog: 'Recovered truncated file', estimatedTimeSaved: '1m' };
              }
          } else {
              for (let i = 0; i < matches.length; i++) {
                  const startObjIndex = matches[i].index;
                  const nextObjIndex = i + 1 < matches.length ? matches[i+1].index : textPayload.length;
                  const chunk = textPayload.substring(startObjIndex, nextObjIndex);
                  
                  let contentIdx = chunk.indexOf('"content"');
                  if (contentIdx === -1) continue;
                  
                  let colonIdx = chunk.indexOf(':', contentIdx);
                  if (colonIdx === -1) continue;
                  let quoteIdx = chunk.indexOf('"', colonIdx);
                  if (quoteIdx === -1) continue;
                  
                  let rawContent = chunk.substring(quoteIdx + 1);
                  rawContent = rawContent.replace(/"\s*\}?\s*\]?\s*\}?\s*,?\s*$/g, '');
                  rawContent = rawContent.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\t/g, '\t');
                  
                  files.push({ path: matches[i].path, content: rawContent });
              }
              if (files.length > 0) {
                  payload = { files, changelog: 'Recovered ' + files.length + ' truncated files', estimatedTimeSaved: '1m' };
              }
          }
      } catch (regexErr) {
          // Ignore regex errors
      }

      if (!payload || !payload.files || payload.files.length === 0) {
        throw new Error(`The AI model encountered a validation or token limit error and returned a truncated response that could not be parsed. Please try breaking your request into smaller parts, or switch to a provider with larger context capabilities (e.g. Gemini).`);
      }
    }

    res.json(payload);
  } catch (err: any) {
    console.error("Error generating app:", err);
    res.status(500).json({ error: err.message || 'Unknown error occurred' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  server.setTimeout(600000); // 10 minutes timeout
}

startServer();
