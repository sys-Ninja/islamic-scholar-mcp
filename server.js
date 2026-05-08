#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *   Islamic Scholar MCP Server - HTTP Transport
 *   يشغل MCP عبر HTTP بدل stdio
 *   للاستخدام مع Claude Desktop/Kiro عبر الإنترنت
 * ═══════════════════════════════════════════════════════════════
 */

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek'; // deepseek or gemini
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

console.log(`🤖 AI Provider: ${AI_PROVIDER}`);
console.log(`📦 Model: ${AI_MODEL}`);

// Middleware
app.use(cors());
app.use(express.json());

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
  const sites = ['islamweb.net', 'dorar.net', 'islamqa.info', 'binbaz.org.sa'];
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

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({
    name: 'Islamic Scholar API',
    version: '1.0.0',
    endpoints: {
      '/api/ask': 'POST - اسأل سؤال شرعي',
      '/api/search': 'POST - بحث في المواقع الإسلامية',
      '/api/fatwa': 'POST - جلب فتوى من رابط',
      '/health': 'GET - حالة السيرفر'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mcp: mcpProcess ? 'running' : 'stopped',
    timestamp: new Date().toISOString()
  });
});

// البحث الشامل مع AI (الأساسي)
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
//  START SERVER
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Islamic Scholar MCP Server              ║');
  console.log(`║  Running on: http://localhost:${PORT}     ║`);
  console.log(`║  AI Provider: ${AI_PROVIDER.padEnd(26)}║`);
  console.log(`║  Model: ${AI_MODEL.padEnd(32)}║`);
  console.log('╚══════════════════════════════════════════╝');
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (mcpProcess) {
    mcpProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  if (mcpProcess) {
    mcpProcess.kill();
  }
  process.exit(0);
});
