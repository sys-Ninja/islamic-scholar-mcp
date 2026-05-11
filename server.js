#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *   Islamic Scholar MCP Server - HTTP Transport + Web UI
 *   يشغل MCP عبر HTTP بدل stdio
 *   للاستخدام مع Claude Desktop/Kiro عبر الإنترنت
 * ═══════════════════════════════════════════════════════════════
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek'; // deepseek or gemini
const AI_API_KEY = process.env.AI_API_KEY || '';
let AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';
let thinkingMode = false; // toggle: deepseek-chat vs deepseek-reasoner

const DEEPSEEK_MODELS = {
  chat: { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'سريع ودقيق — للأسئلة العادية' },
  reasoner: { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', description: 'تفكير عميق — للأسئلة المعقدة' },
};

console.log(`🤖 AI Provider: ${AI_PROVIDER}`);
console.log(`📦 Model: ${AI_MODEL}`);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// استيراد دوال MCP من src/index.js
const RESEARCH_DIR = path.join(__dirname, 'research');
await fs.mkdir(RESEARCH_DIR, { recursive: true });

// نسخ الدوال من src/index.js
const HTTP_TIMEOUT = 25000;
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function makeHeaders(referer = 'https://www.google.com/') {
  return {
    'User-Agent': randomUA(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    Referer: referer,
  };
}

async function fetchWithRetry(url, opts = {}, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await axios.get(url, {
        headers: makeHeaders(opts.referer),
        timeout: HTTP_TIMEOUT,
        maxRedirects: 5,
        validateStatus: (s) => s < 500,
      });
      if (resp.status === 200) return resp;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

async function ddgSearch(query, limit = 5) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=ar-ar`;
  const resp = await fetchWithRetry(searchUrl);
  const $ = cheerio.load(resp.data);
  const results = [];

  $('.result, .web-result').each((i, el) => {
    if (results.length >= limit) return false;
    const titleEl = $(el).find('.result__title a, .result__a, h2 a').first();
    const title = titleEl.text().trim();
    let href = titleEl.attr('href') || '';
    
    if (href.includes('/l/?')) {
      try {
        const u = new URL('https://duckduckgo.com' + href);
        href = decodeURIComponent(u.searchParams.get('uddg') || u.searchParams.get('u') || href);
      } catch {}
    }
    
    const snippet = $(el).find('.result__snippet').text().trim();
    if (title && href && href.startsWith('http')) {
      results.push({ title, url: href, snippet });
    }
  });
  return results;
}

async function searchIslamicMulti(query, limit = 6) {
  const sites = ['islamweb.net', 'dorar.net', 'islamqa.info', 'binbaz.org.sa', 'islamstory.com', 'nabulsi.com'];
  const siteFilter = sites.map(s => `site:${s}`).join(' OR ');
  let results = await ddgSearch(`(${siteFilter}) ${query}`, limit);
  
  if (!results.length) {
    results = await ddgSearch(`${query} إسلام فتوى حديث`, limit);
  }
  
  return results;
}

// دالة استدعاء AI
async function callAI(systemPrompt, userPrompt) {
  if (!AI_API_KEY) {
    throw new Error('AI_API_KEY not configured');
  }

  if (AI_PROVIDER === 'deepseek') {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.choices[0].message.content;
  } 
  else if (AI_PROVIDER === 'gemini') {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${AI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data.candidates[0].content.parts[0].text;
  }
  
  throw new Error('Unknown AI provider');
}

// ═══════════════════════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// MCP Client Connection
let mcpClient = null;
let mcpTools = [];

async function initMCPClient() {
  try {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    
    const transport = new StdioClientTransport({
      command: 'node',
      args: [path.join(__dirname, 'src', 'index.js')],
    });

    mcpClient = new Client({ name: 'islamic-scholar-web', version: '1.0.0' });
    await mcpClient.connect(transport);
    
    const { tools } = await mcpClient.listTools();
    mcpTools = tools;
    
    console.log(`✅ MCP Client connected with ${tools.length} tools`);
  } catch (error) {
    console.error('❌ Failed to connect MCP Client:', error.message);
  }
}

// Initialize MCP on startup
initMCPClient();

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mcp: mcpClient ? 'connected' : 'disconnected',
    tools: mcpTools.length,
    timestamp: new Date().toISOString()
  });
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    name: 'Islamic Scholar API',
    version: '3.0.0',
    endpoints: {
      '/': 'GET - الصفحة الرئيسية',
      '/api/ask': 'POST - اسأل سؤال شرعي (بدون MCP)',
      '/api/ask-with-tools': 'POST - اسأل سؤال شرعي (مع MCP + Streaming)',
      '/api/search': 'POST - بحث في المواقع الإسلامية',
      '/api/fatwa': 'POST - جلب فتوى من رابط',
      '/health': 'GET - حالة السيرفر'
    }
  });
});

// البحث الشامل مع AI + MCP Tools (مع Streaming)
app.post('/api/ask-with-tools', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ 
        success: false, 
        error: 'السؤال مطلوب' 
      });
    }

    if (!mcpClient) {
      return res.status(503).json({
        success: false,
        error: 'MCP Client غير متصل'
      });
    }

    if (!AI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'AI_API_KEY غير مُعرّف'
      });
    }

    console.log(`📝 Question with MCP: ${question}`);

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // System prompt
    const systemPrompt = await fs.readFile(
      path.join(__dirname, 'prompts', 'system-prompt.md'),
      'utf-8'
    );

    // Convert MCP tools to DeepSeek format
    const tools = mcpTools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema
      }
    }));

    const messages = [
      { role: 'user', content: question }
    ];

    let iterationCount = 0;
    let toolCallCount = 0;
    const MAX_ITERATIONS = 8;
    const MAX_TOOL_CALLS = 4; // ⚡ حد أقصى 4 مجموعات أدوات

    // Agent loop
    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      // ⚡ بعد 3 iterations أو 4 tool calls → أجبر الـ AI على الإجابة
      const forceAnswer = toolCallCount >= MAX_TOOL_CALLS || iterationCount > 3;
      const currentToolChoice = forceAnswer ? 'none' : 'auto';

      if (forceAnswer && toolCallCount > 0) {
        console.log(`⚡ Forcing final answer (${toolCallCount} tool batches used)`);
      }

      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt + (forceAnswer ? '\n\n⚠️ تعليمات إلزامية: لديك معلومات كافية. اكتب إجابتك النهائية الآن بدون استخدام أي أدوات إضافية.' : '') },
          ...messages
        ],
        tools: forceAnswer ? undefined : tools,
        tool_choice: forceAnswer ? undefined : 'auto'
      }, {
        headers: {
          'Authorization': `Bearer ${AI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const assistantMessage = response.data.choices[0].message;
      messages.push(assistantMessage);

      // Check if done (no more tool calls)
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        // Final answer
        const finalAnswer = assistantMessage.content || 'تم الانتهاء من البحث';
        
        // If answer is too short, force one more iteration to summarize
        if (finalAnswer.length < 100 && iterationCount < MAX_ITERATIONS) {
          messages.push({
            role: 'user',
            content: 'الآن اجمع كل المعلومات التي حصلت عليها من الأدوات واكتب إجابة شاملة ومفصلة على السؤال الأصلي بالعربية الفصحى مع ذكر الأدلة.'
          });
          continue;
        }
        
        sendEvent({
          type: 'answer',
          content: finalAnswer
        });
        break;
      }

      // Execute tools
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Send tool use event
        sendEvent({
          type: 'tool_use',
          id: toolCall.id,
          name: toolName,
          input: toolArgs
        });

        try {
          // Call MCP tool
          const result = await mcpClient.callTool({
            name: toolName,
            arguments: toolArgs
          });

          let resultText = result.content[0]?.text || '';

          // ⚡ Truncate long results to save context
          if (resultText.length > 3000) {
            resultText = resultText.slice(0, 3000) + '\n... (تم اختصار النتيجة)';
          }

          // Send tool result event
          sendEvent({
            type: 'tool_result',
            id: toolCall.id,
            content: resultText
          });

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultText
          });

        } catch (error) {
          console.error(`Tool error (${toolName}):`, error.message);
          
          sendEvent({
            type: 'tool_result',
            id: toolCall.id,
            content: `خطأ: ${error.message}`
          });

          toolResults.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `خطأ: ${error.message}`
          });
        }
      }

      // Add tool results to messages
      messages.push(...toolResults);
      toolCallCount++; // ⚡ عداد مجموعات الأدوات
    }

    // If we exited loop without final answer, force one
    if (iterationCount >= MAX_ITERATIONS) {
      console.log('⚠️ Max iterations reached, forcing final answer...');
      
      // Force final answer by calling AI one more time without tools
      try {
        const finalResponse = await axios.post('https://api.deepseek.com/v1/chat/completions', {
          model: AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
            {
              role: 'user',
              content: 'الآن اجمع كل المعلومات التي حصلت عليها من الأدوات السابقة واكتب إجابة شاملة ومفصلة على السؤال الأصلي بالعربية الفصحى مع ذكر الأدلة من القرآن والسنة وأقوال العلماء.'
            }
          ]
        }, {
          headers: {
            'Authorization': `Bearer ${AI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        const finalAnswer = finalResponse.data.choices[0].message.content;
        
        sendEvent({
          type: 'answer',
          content: finalAnswer || 'تم الانتهاء من البحث'
        });
      } catch (error) {
        console.error('Error getting final answer:', error.message);
        sendEvent({
          type: 'error',
          message: 'تم جمع المعلومات ولكن حدث خطأ في صياغة الإجابة النهائية'
        });
      }
    }

    res.end();

  } catch (error) {
    console.error('Error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } else {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error.message
      })}\n\n`);
      res.end();
    }
  }
});

// البحث الشامل مع AI (الأساسي - بدون MCP)
app.post('/api/ask', async (req, res) => {
  try {
    const { question, limit = 6, useAI = true } = req.body;

    if (!question) {
      return res.status(400).json({ 
        success: false, 
        error: 'السؤال مطلوب' 
      });
    }

    console.log(`📝 Question: ${question}`);

    // 1. البحث في المصادر الإسلامية
    const results = await searchIslamicMulti(question, limit);
    
    let sourcesText = results.map((r, i) => 
      `${i + 1}. ${r.title}\n   🔗 ${r.url}\n   📝 ${r.snippet}`
    ).join('\n\n');

    if (!sourcesText) {
      sourcesText = 'لم يتم العثور على مصادر';
    }

    // 2. إذا AI مفعل، نرسل للـ AI
    let answer = sourcesText;
    
    if (useAI && AI_API_KEY) {
      const systemPrompt = `أنت عالم إسلامي متخصص. مهمتك الإجابة على الأسئلة الشرعية بناءً على المصادر الموثوقة المرفقة فقط.

قواعد الإجابة:
1. أجب بالعربية الفصحى
2. استشهد بالمصادر المرفقة
3. إذا لم تجد إجابة في المصادر، قل "لم أجد إجابة واضحة في المصادر المتاحة"
4. لا تفتي من عندك
5. اذكر رقم المصدر عند الاستشهاد`;

      const userPrompt = `السؤال: ${question}

المصادر المتاحة:
${sourcesText}

الإجابة:`;

      try {
        answer = await callAI(systemPrompt, userPrompt);
      } catch (aiError) {
        console.error('AI Error:', aiError.message);
        // إذا AI فشل، نرجع المصادر فقط
        answer = `⚠️ تعذر الاتصال بالـ AI\n\n${sourcesText}`;
      }
    }

    res.json({
      success: true,
      question: question,
      answer: answer,
      sources: results,
      aiUsed: useAI && AI_API_KEY ? true : false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// بحث في إسلام ويب
app.post('/api/search/islamweb', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query مطلوب' 
      });
    }

    const results = await ddgSearch(`site:islamweb.net/ar/fatwa ${query}`, limit);

    res.json({
      success: true,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// جلب فتوى من رابط
app.post('/api/fatwa', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL مطلوب' 
      });
    }

    const resp = await fetchWithRetry(url);
    const $ = cheerio.load(resp.data);
    $('script,style,nav,footer,header,.ads').remove();
    
    const title = $('h1').first().text().trim();
    const content = $('article,main,.content,body').first().text()
      .replace(/\s+/g, ' ').trim().slice(0, 5000);

    res.json({
      success: true,
      title: title,
      content: content,
      url: url,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// بحث في الدرر السنية
app.post('/api/search/dorar', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query مطلوب' 
      });
    }

    const results = await ddgSearch(`site:dorar.net/hadith ${query}`, limit);

    res.json({
      success: true,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  MODEL SWITCHING API
// ═══════════════════════════════════════════════════════════════

// Get available models
app.get('/api/models', (req, res) => {
  res.json({
    current: AI_MODEL,
    thinking: thinkingMode,
    models: DEEPSEEK_MODELS,
  });
});

// Switch model (thinking toggle)
app.post('/api/models/toggle', (req, res) => {
  thinkingMode = !thinkingMode;
  AI_MODEL = thinkingMode ? DEEPSEEK_MODELS.reasoner.id : DEEPSEEK_MODELS.chat.id;
  console.log(`🔄 Model switched to: ${AI_MODEL} (thinking: ${thinkingMode})`);
  res.json({
    success: true,
    current: AI_MODEL,
    thinking: thinkingMode,
    description: thinkingMode ? DEEPSEEK_MODELS.reasoner.description : DEEPSEEK_MODELS.chat.description,
  });
});

// Set specific model
app.post('/api/models/set', (req, res) => {
  const { model } = req.body;
  if (model && (model === 'deepseek-chat' || model === 'deepseek-reasoner')) {
    AI_MODEL = model;
    thinkingMode = model === 'deepseek-reasoner';
    console.log(`🔄 Model set to: ${AI_MODEL}`);
    res.json({ success: true, current: AI_MODEL, thinking: thinkingMode });
  } else {
    res.status(400).json({ success: false, error: 'Model must be deepseek-chat or deepseek-reasoner' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Islamic Scholar MCP v4 Server           ║');
  console.log(`║  Running on: http://localhost:${PORT}     ║`);
  console.log(`║  AI Provider: ${AI_PROVIDER.padEnd(26)}║`);
  console.log(`║  Model: ${AI_MODEL.padEnd(32)}║`);
  console.log('║  Tools: 20                               ║');
  console.log('╚══════════════════════════════════════════╝');
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (mcpClient) {
    try {
      await mcpClient.close();
    } catch (e) {}
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  if (mcpClient) {
    try {
      await mcpClient.close();
    } catch (e) {}
  }
  process.exit(0);
});
