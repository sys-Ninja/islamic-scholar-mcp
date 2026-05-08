#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *   Islamic Scholar MCP Server v2 - الشيخ الرقمي
 *
 *   المشكلة القديمة: إسلام ويب بيبلوك الـ scraping المباشر → 403/ECONNRESET
 *   الحل الجديد:
 *     1. DuckDuckGo يبحث داخل المواقع الإسلامية (مجاني، ما بيتبلوكش)
 *     2. يجيب الروابط الفعلية
 *     3. يفتح الروابط ويقرأ المحتوى مع Retry تلقائي
 *
 *   مجاني 100% - لا يحتاج API Key
 * ═══════════════════════════════════════════════════════════════
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// تفعيل Stealth Plugin
puppeteer.use(StealthPlugin());

// ─── Setup ────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESEARCH_DIR = path.join(__dirname, '..', 'research');
await fs.mkdir(RESEARCH_DIR, { recursive: true });

const HTTP_TIMEOUT = 25000;

// ─── Rotating User Agents ─────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function makeHeaders(referer = 'https://www.google.com/') {
  return {
    'User-Agent': randomUA(),
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ar,ar-SA;q=0.9,en-US;q=0.7,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    Referer: referer,
    DNT: '1',
  };
}

// ─── Smart Fetch with Retry + Puppeteer Fallback ─────────────
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
  }
  return browserInstance;
}

async function fetchWithPuppeteer(url) {
  console.error(`  🤖 استخدام Puppeteer للتجاوز...`);
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  await page.setUserAgent(randomUA());
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  });
  
  try {
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // انتظار صغير للتأكد من تحميل المحتوى
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    await page.close();
    return { data: content, status: 200 };
  } catch (err) {
    await page.close();
    throw err;
  }
}

async function fetchWithRetry(url, opts = {}, maxRetries = 3) {
  const delays = [1200, 3000, 6000];
  let use403Fallback = false;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(delays[attempt - 1]);
        console.error(`  🔄 retry ${attempt}/${maxRetries - 1}: ${url.slice(0, 60)}...`);
      }

      // إذا واجهنا 403 قبل كده، نستخدم Puppeteer مباشرة
      if (use403Fallback && attempt > 0) {
        return await fetchWithPuppeteer(url);
      }

      const resp = await axios.get(url, {
        headers: makeHeaders(opts.referer),
        timeout: HTTP_TIMEOUT,
        maxRedirects: 5,
        validateStatus: (s) => s < 500,
        ...opts.axiosOpts,
      });

      if (resp.status === 404) throw new Error(`404: الصفحة غير موجودة - ${url}`);
      
      if (resp.status === 403) {
        use403Fallback = true;
        // على 403، نجرب Puppeteer في المحاولة القادمة
        if (attempt < maxRetries - 1) {
          console.error(`  ⚠️ 403 محجوب - سنجرب Puppeteer...`);
          continue;
        }
        // آخر محاولة: نستخدم Puppeteer
        return await fetchWithPuppeteer(url);
      }

      return resp;
    } catch (err) {
      const isLast = attempt === maxRetries - 1;
      const retryable =
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ENOTFOUND' ||
        (err.response?.status >= 429 && err.response?.status < 500);

      // في آخر محاولة مع 403، نجرب Puppeteer
      if (isLast && (err.response?.status === 403 || use403Fallback)) {
        try {
          return await fetchWithPuppeteer(url);
        } catch (puppeteerErr) {
          throw new Error(`فشل الاتصال (${err.response?.status || err.code}): ${err.message}`);
        }
      }

      if (isLast || !retryable) throw err;
      console.error(`  ⚠️ attempt ${attempt + 1} failed: ${err.message}`);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════════
//  CORE ENGINE: DuckDuckGo Search
//  الفكرة: نستخدم DDG يبحث "site:islamweb.net/ar/fatwa QUERY"
//  DDG مجاني ومفتوح ولا يحتاج API
// ═══════════════════════════════════════════════════════════════
async function ddgSearch(query, limit = 5) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=ar-ar`;

  const resp = await fetchWithRetry(searchUrl, {
    referer: 'https://duckduckgo.com/',
  });

  const $ = cheerio.load(resp.data);
  const results = [];

  $('.result, .web-result').each((i, el) => {
    if (results.length >= limit) return false;

    const titleEl = $(el).find('.result__title a, .result__a, h2 a').first();
    const title = titleEl.text().trim();

    let href = titleEl.attr('href') || '';

    // DDG بيحط الـ URL الحقيقي في uddg parameter
    if (href.includes('/l/?')) {
      try {
        const u = new URL('https://duckduckgo.com' + href);
        href =
          decodeURIComponent(u.searchParams.get('uddg') || u.searchParams.get('u') || href);
      } catch {
        const match = href.match(/uddg=([^&]+)/);
        if (match) href = decodeURIComponent(match[1]);
      }
    }

    const snippet = $(el).find('.result__snippet').text().trim();

    if (title && href && !href.includes('duckduckgo.com') && href.startsWith('http')) {
      results.push({ title, url: href, snippet });
    }
  });

  return results;
}

// ─── DDG wrappers per source ──────────────────────────────────
async function ddgIslamwebFatwas(query, limit) {
  // جرب قسم الفتاوى أولاً
  let r = await ddgSearch(`site:islamweb.net/ar/fatwa ${query}`, limit);
  if (r.length === 0) r = await ddgSearch(`site:islamweb.net ${query} فتوى حكم`, limit);
  return r;
}

async function ddgDorarHadiths(query, limit) {
  let r = await ddgSearch(`site:dorar.net/hadith ${query}`, limit);
  if (r.length === 0) r = await ddgSearch(`"الدرر السنية" حديث ${query}`, limit);
  return r;
}

// ═══════════════════════════════════════════════════════════════
//  SCRAPERS - قراءة محتوى الصفحات
// ═══════════════════════════════════════════════════════════════
async function scrapeIslamwebFatwa(url) {
  const resp = await fetchWithRetry(url, { referer: 'https://www.islamweb.net/' });
  const $ = cheerio.load(resp.data);
  $('script,style,nav,footer,header,.ads,.ad,[class*="advert"],.sidebar,.social').remove();

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    'فتوى';

  const fatwaNum = $('[class*="fatwa-num"], .fatwa-number, span:contains("رقم الفتوى")')
    .first()
    .text()
    .replace(/[^0-9]/g, '');

  const question =
    ['.question-content', '.fatwa-question', '[class*="question"]', 'h2']
      .map((s) => $(s).first().text().trim())
      .find((t) => t.length > 20) || '';

  const answer =
    ['.fatwa-answer', '.answer-content', '[class*="answer"]', '.fatwa-text', 'article', 'main']
      .map((s) => $(s).first().text().trim())
      .find((t) => t.length > 50) ||
    $('body').text().replace(/\s+/g, ' ').trim().slice(300, 4500);

  return [
    `📋 ══════ فتوى: إسلام ويب ══════`,
    `📌 ${title}`,
    fatwaNum ? `🔢 رقم الفتوى: ${fatwaNum}` : null,
    ``,
    question ? `❓ السؤال:\n${question.slice(0, 700)}` : null,
    ``,
    `✅ الجواب:\n${answer.slice(0, 3500)}`,
    ``,
    `🔗 ${url}`,
    `══════════════════════════════════`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function scrapeDorarPage(url) {
  const resp = await fetchWithRetry(url, { referer: 'https://www.dorar.net/' });
  const $ = cheerio.load(resp.data);
  $('script,style,nav,footer,.ads').remove();

  const title = $('h1,h2').first().text().trim();
  const content = $('article,.content,main,.hadith-text,body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);

  return [
    `📿 ══════ الدرر السنية ══════`,
    title ? `📌 ${title}` : null,
    ``,
    content,
    ``,
    `🔗 ${url}`,
    `══════════════════════════════════`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function scrapeGenericPage(url) {
  const resp = await fetchWithRetry(url, { referer: 'https://www.google.com/' });
  const $ = cheerio.load(resp.data);
  $('script,style,nav,footer,header,.ads,.sidebar,.menu,.comments').remove();

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content') ||
    '';

  const content = $('article,main,.content,.post-content,.entry-content,body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000);

  return [title ? `📄 ${title}` : null, ``, content, ``, `🔗 ${url}`]
    .filter(Boolean)
    .join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  MCP SERVER
// ═══════════════════════════════════════════════════════════════
const server = new Server(
  { name: 'islamic-scholar-mcp', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_islamweb_fatwas',
      description:
        'الخطوة 1: البحث في إسلام ويب عن فتاوى عبر DuckDuckGo. يرجع روابط الفتاوى.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'الموضوع الشرعي بالعربية' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch_islamweb_fatwa',
      description: 'قراءة فتوى كاملة من إسلام ويب بالرابط (سؤال + جواب).',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
    {
      name: 'search_dorar_hadiths',
      description:
        'الخطوة 2: البحث في الدرر السنية عن أحاديث نبوية موثقة عبر DuckDuckGo.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'موضوع الحديث' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch_dorar_page',
      description: 'قراءة صفحة كاملة من الدرر السنية.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
    {
      name: 'search_islamic_multi',
      description:
        'بحث شامل في مواقع إسلامية متعددة: إسلام ويب + الدرر + الإفتاء + إسلام Q&A + ابن باز + ابن عثيمين.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          sites: {
            type: 'array',
            items: { type: 'string' },
            description: 'مواقع للتضمين. افتراضي: المواقع الكبرى',
          },
          limit: { type: 'number', default: 6 },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch_islamic_page',
      description:
        'قراءة أي صفحة من المواقع الإسلامية المعتمدة (islamweb, dorar, islamqa, binbaz, islamway, alifta, alukah...).',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
    {
      name: 'search_quran_tafsir',
      description: 'البحث في تفسير القرآن من مواقع إسلامية موثوقة.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
    {
      name: 'write_research_step',
      description: 'حفظ نتائج خطوة بحث في ملف الدراسة.',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          step_name: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['session_id', 'step_name', 'content'],
      },
    },
    {
      name: 'read_research_file',
      description: 'قراءة ملف الدراسة كاملاً قبل الإجابة النهائية.',
      inputSchema: {
        type: 'object',
        properties: { session_id: { type: 'string' } },
        required: ['session_id'],
      },
    },
    {
      name: 'clear_research_file',
      description: 'مسح ملف الدراسة لجلسة جديدة.',
      inputSchema: {
        type: 'object',
        properties: { session_id: { type: 'string' } },
        required: ['session_id'],
      },
    },
    {
      name: 'fetch_any_url',
      description: 'قراءة أي رابط من الإنترنت (غير مقيد بالمواقع الإسلامية). استخدمه عندما لا تجد نتائج في المواقع المعتمدة، أو للبحث في مواقع أخرى.',
      inputSchema: {
        type: 'object',
        properties: { 
          url: { 
            type: 'string',
            description: 'الرابط الكامل للصفحة المراد قراءتها'
          } 
        },
        required: ['url'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case 'search_islamweb_fatwas':
        return await toolSearchIslamwebFatwas(args.query, args.limit ?? 5);
      case 'fetch_islamweb_fatwa':
        return await toolFetchIslamwebFatwa(args.url);
      case 'search_dorar_hadiths':
        return await toolSearchDorarHadiths(args.query, args.limit ?? 5);
      case 'fetch_dorar_page':
        return txt(await scrapeDorarPage(args.url));
      case 'search_islamic_multi':
        return await toolSearchIslamicMulti(
          args.query,
          args.sites ?? [
            'islamweb.net',
            'dorar.net',
            'islamqa.info',
            'binbaz.org.sa',
            'islamway.net',
            'alifta.gov.sa',
          ],
          args.limit ?? 6
        );
      case 'fetch_islamic_page':
        return await toolFetchIslamicPage(args.url);
      case 'search_quran_tafsir':
        return await toolSearchQuranTafsir(args.query);
      case 'write_research_step':
        return await writeResearchStep(args.session_id, args.step_name, args.content);
      case 'read_research_file':
        return await readResearchFile(args.session_id);
      case 'clear_research_file':
        return await clearResearchFile(args.session_id);
      case 'fetch_any_url':
        return await toolFetchAnyUrl(args.url);
      default:
        throw new Error(`أداة غير معروفة: ${name}`);
    }
  } catch (err) {
    const msg = err?.response?.status
      ? `فشل (${err.response.status}): ${err.message}`
      : `خطأ: ${err.message}`;
    return { content: [{ type: 'text', text: msg }], isError: true };
  }
});

// ─── Tool implementations ─────────────────────────────────────

async function toolSearchIslamwebFatwas(query, limit) {
  console.error(`🔍 islamweb fatwas: "${query}"`);
  const results = await ddgIslamwebFatwas(query, limit);

  if (!results.length) {
    return txt(
      `⚠️ لا نتائج في إسلام ويب عن "${query}".\n💡 جرب search_islamic_multi للبحث في مواقع أخرى`
    );
  }

  return txt(
    [
      `📚 إسلام ويب — "${query}"`,
      `══════════════════════════════════`,
      '',
      ...results.map(
        (r, i) =>
          `${i + 1}. 📋 ${r.title}\n   🔗 ${r.url}` +
          (r.snippet ? `\n   📝 ${r.snippet.slice(0, 220)}` : '')
      ),
      '',
      `✅ ${results.length} نتيجة — استخدم fetch_islamweb_fatwa لقراءة أي فتوى`,
    ].join('\n')
  );
}

async function toolFetchIslamwebFatwa(url) {
  if (!url.includes('islamweb.net')) {
    return txt('⚠️ هذه الأداة لروابط إسلام ويب فقط — استخدم fetch_islamic_page لغيرها');
  }
  return txt(await scrapeIslamwebFatwa(url));
}

async function toolSearchDorarHadiths(query, limit) {
  console.error(`🔍 dorar hadiths: "${query}"`);
  const results = await ddgDorarHadiths(query, limit);

  if (!results.length) {
    return txt(
      `⚠️ لا نتائج في الدرر السنية عن "${query}".\n💡 جرب search_islamic_multi`
    );
  }

  return txt(
    [
      `📿 الدرر السنية — "${query}"`,
      `══════════════════════════════════`,
      '',
      ...results.map(
        (r, i) =>
          `${i + 1}. 📜 ${r.title}\n   🔗 ${r.url}` +
          (r.snippet ? `\n   📝 ${r.snippet.slice(0, 260)}` : '')
      ),
      '',
      `✅ ${results.length} نتيجة — استخدم fetch_dorar_page لقراءة أي صفحة`,
    ].join('\n')
  );
}

async function toolSearchIslamicMulti(query, sites, limit) {
  console.error(`🔍 multi-site: "${query}"`);
  const siteFilter = sites.map((s) => `site:${s}`).join(' OR ');
  let results = await ddgSearch(`(${siteFilter}) ${query}`, limit);

  if (!results.length) {
    results = await ddgSearch(`${query} إسلام فتوى حديث`, limit);
  }

  if (!results.length) {
    return txt(`⚠️ لا نتائج عن "${query}" في هذه المواقع.`);
  }

  return txt(
    [
      `🌐 بحث شامل — "${query}"`,
      `المواقع: ${sites.join(' | ')}`,
      `══════════════════════════════════`,
      '',
      ...results.map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   🔗 ${r.url}` +
          (r.snippet ? `\n   📝 ${r.snippet.slice(0, 220)}` : '')
      ),
      '',
      `✅ ${results.length} نتيجة — استخدم fetch_islamic_page لقراءة أي صفحة`,
    ].join('\n')
  );
}

async function toolFetchIslamicPage(url) {
  const ALLOWED = [
    'islamweb.net', 'dorar.net', 'islamway.net', 'ar.islamway.net',
    'saaid.net', 'islamhouse.com', 'alifta.gov.sa', 'dar-alifta.org',
    'sunnah.com', 'quran.com', 'alukah.net', 'islamqa.info',
    'binbaz.org.sa', 'ibnothaimeen.com', 'islamport.com', 'al-eman.com',
  ];

  let domain;
  try { domain = new URL(url).hostname.replace('www.', ''); }
  catch { return txt(`⚠️ رابط غير صحيح: ${url}`); }

  if (!ALLOWED.some((d) => domain.includes(d))) {
    return txt(
      `⚠️ "${domain}" غير معتمد.\nالمتاح:\n${ALLOWED.map((d) => `• ${d}`).join('\n')}`
    );
  }

  let content;
  if (url.includes('islamweb.net')) content = await scrapeIslamwebFatwa(url);
  else if (url.includes('dorar.net')) content = await scrapeDorarPage(url);
  else content = await scrapeGenericPage(url);

  return txt(content);
}

async function toolSearchQuranTafsir(query) {
  const results = await ddgSearch(
    `site:islamweb.net تفسير ${query} OR site:islamqa.info ${query} تفسير قرآن`,
    5
  );

  if (!results.length) return txt(`⚠️ لا نتائج تفسيرية عن "${query}"`);

  return txt(
    [
      `📖 تفسير القرآن — "${query}"`,
      `══════════════════════════════════`,
      '',
      ...results.map(
        (r, i) =>
          `${i + 1}. 🕌 ${r.title}\n   🔗 ${r.url}` +
          (r.snippet ? `\n   📝 ${r.snippet.slice(0, 220)}` : '')
      ),
      '',
      `✅ استخدم fetch_islamic_page لقراءة التفسير كاملاً`,
    ].join('\n')
  );
}

async function toolFetchAnyUrl(url) {
  console.error(`🌐 fetching any URL: ${url}`);
  
  // التحقق من صحة الرابط
  try {
    new URL(url);
  } catch {
    return txt(`⚠️ رابط غير صحيح: ${url}`);
  }

  try {
    const resp = await fetchWithRetry(url, { referer: 'https://www.google.com/' });
    const $ = cheerio.load(resp.data);
    
    // إزالة العناصر غير المرغوبة
    $('script,style,nav,footer,header,.ads,.ad,[class*="advert"],.sidebar,.menu,.comments,iframe,noscript').remove();

    const title =
      $('h1').first().text().trim() ||
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      '';

    const description = 
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    // محاولة استخراج المحتوى الرئيسي
    const content = $('article,main,.content,.post-content,.entry-content,.article-content,[role="main"],body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);

    if (!content || content.length < 100) {
      return txt(
        [
          `⚠️ لم نتمكن من استخراج محتوى كافٍ من الصفحة`,
          ``,
          `🔗 ${url}`,
          ``,
          `💡 قد تكون الصفحة محمية أو تحتاج JavaScript. جرب رابطاً آخر.`,
        ].join('\n')
      );
    }

    return txt(
      [
        `🌐 ══════ محتوى من الويب ══════`,
        title ? `📌 ${title}` : null,
        description ? `📝 ${description.slice(0, 300)}` : null,
        ``,
        `📄 المحتوى:`,
        content,
        ``,
        `🔗 ${url}`,
        `══════════════════════════════════`,
      ]
        .filter(Boolean)
        .join('\n')
    );
  } catch (err) {
    const msg = err?.response?.status
      ? `فشل الاتصال (${err.response.status}): ${err.message}`
      : `خطأ: ${err.message}`;
    
    return txt(
      [
        `❌ فشل في قراءة الرابط`,
        ``,
        `🔗 ${url}`,
        ``,
        `⚠️ ${msg}`,
        ``,
        `💡 جرب رابطاً آخر أو استخدم fetch_islamic_page للمواقع الإسلامية المعتمدة.`,
      ].join('\n')
    );
  }
}

// ─── File Ops ─────────────────────────────────────────────────
async function writeResearchStep(sessionId, stepName, content) {
  const safe = sessionId.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_').slice(0, 60);
  const fp = path.join(RESEARCH_DIR, `${safe}.md`);
  const ts = new Date().toLocaleString('ar-EG');
  await fs.appendFile(fp, `\n\n## 📌 ${stepName}\n### ⏰ ${ts}\n\n${content}\n\n---`, 'utf-8');
  return txt(`✅ حُفظ "${stepName}" في ملف الدراسة`);
}

async function readResearchFile(sessionId) {
  const safe = sessionId.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_').slice(0, 60);
  const fp = path.join(RESEARCH_DIR, `${safe}.md`);
  try {
    const c = await fs.readFile(fp, 'utf-8');
    if (!c.trim()) return txt('📂 ملف الدراسة فارغ');
    return txt(`📂 ════ ملف الدراسة ════\n\n${c}\n\n════ نهاية الملف ════`);
  } catch {
    return txt(`📂 لا يوجد ملف للجلسة "${sessionId}"`);
  }
}

async function clearResearchFile(sessionId) {
  const safe = sessionId.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_').slice(0, 60);
  await fs.writeFile(path.join(RESEARCH_DIR, `${safe}.md`), '', 'utf-8');
  return txt(`🗑️ تم مسح ملف الدراسة "${sessionId}"`);
}

function txt(text) {
  return { content: [{ type: 'text', text }] };
}

// ─── Start ────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('╔══════════════════════════════════════════╗');
console.error('║  Islamic Scholar MCP v3 — Stealth Mode   ║');
console.error('║  الشيخ الرقمي + Puppeteer Stealth 🤖   ║');
console.error('╚══════════════════════════════════════════╝');

// Cleanup on exit
process.on('SIGINT', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});
