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
//  QURAN.COM API v4 (مجاني بدون key)
// ═══════════════════════════════════════════════════════════════
const QURAN_API = 'https://api.quran.com/api/v4';

async function quranSearch(query, limit = 5) {
  try {
    const resp = await axios.get(`${QURAN_API}/search`, {
      params: { q: query, size: limit, page: 0, language: 'ar' },
      timeout: 15000,
    });
    return resp.data?.search?.results || [];
  } catch (err) {
    console.error(`Quran API search error: ${err.message}`);
    return [];
  }
}

async function quranGetAyah(surah, ayah) {
  try {
    const resp = await axios.get(
      `${QURAN_API}/verses/by_key/${surah}:${ayah}`,
      { params: { language: 'ar', words: false, translations: '20,203', fields: 'text_uthmani' }, timeout: 15000 }
    );
    return resp.data?.verse || null;
  } catch (err) {
    console.error(`Quran API ayah error: ${err.message}`);
    return null;
  }
}

const TAFSIR_SLUGS = {
  'ibn-kathir': { id: 14, name: 'تفسير ابن كثير', slug: 'ar-tafsir-ibn-kathir' },
  'tabari': { id: 15, name: 'تفسير الطبري', slug: 'ar-tafsir-al-tabari' },
  'qurtubi': { id: 90, name: 'تفسير القرطبي', slug: 'ar-tafseer-al-qurtubi' },
  'saadi': { id: 91, name: 'تفسير السعدي', slug: 'ar-tafseer-al-saddi' },
  'baghawi': { id: 94, name: 'تفسير البغوي', slug: 'ar-tafsir-al-baghawi' },
  'muyassar': { id: 16, name: 'التفسير الميسر', slug: 'ar-tafsir-muyassar' },
};

async function quranGetTafsir(surah, ayah, tafsirKey = 'ibn-kathir') {
  const tafsir = TAFSIR_SLUGS[tafsirKey] || TAFSIR_SLUGS['ibn-kathir'];
  try {
    const resp = await axios.get(
      `${QURAN_API}/quran/tafsirs/${tafsir.id}`,
      { params: { verse_key: `${surah}:${ayah}` }, timeout: 15000 }
    );
    return { name: tafsir.name, tafsirs: resp.data?.tafsirs || [] };
  } catch (err) {
    console.error(`Quran tafsir error: ${err.message}`);
    return { name: tafsir.name, tafsirs: [] };
  }
}

async function quranGetSurahInfo(surahNumber) {
  try {
    const resp = await axios.get(`${QURAN_API}/chapters/${surahNumber}`, {
      params: { language: 'ar' }, timeout: 15000,
    });
    return resp.data?.chapter || null;
  } catch (err) {
    console.error(`Quran surah info error: ${err.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
//  HADITH API (fawazahmed0 CDN - مجاني)
// ═══════════════════════════════════════════════════════════════
const HADITH_CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';
const HADITH_BOOKS = {
  bukhari: { ar: 'ara-bukhari1', en: 'eng-bukhari', name: 'صحيح البخاري' },
  muslim: { ar: 'ara-muslim1', en: 'eng-muslim', name: 'صحيح مسلم' },
  abudawud: { ar: 'ara-abudawud1', en: 'eng-abudawud', name: 'سنن أبو داود' },
  nasai: { ar: 'ara-nasai1', en: 'eng-nasai', name: 'سنن النسائي' },
  ibnmajah: { ar: 'ara-ibnmajah1', en: 'eng-ibnmajah', name: 'سنن ابن ماجه' },
  malik: { ar: 'ara-malik1', en: 'eng-malik', name: 'موطأ مالك' },
  tirmidhi: { ar: 'ara-tirmidhi1', en: 'eng-tirmidhi', name: 'سنن الترمذي' },
};

// Cache for loaded hadith data
const hadithCache = {};

async function loadHadithBook(editionName) {
  if (hadithCache[editionName]) return hadithCache[editionName];
  try {
    console.error(`  📥 Loading hadith: ${editionName}...`);
    const resp = await axios.get(`${HADITH_CDN}/editions/${editionName}.min.json`, { timeout: 30000 });
    hadithCache[editionName] = resp.data;
    return resp.data;
  } catch (err) {
    console.error(`Hadith load error (${editionName}): ${err.message}`);
    return null;
  }
}

async function searchHadithInBook(query, bookKey, lang = 'ar', limit = 5) {
  const book = HADITH_BOOKS[bookKey];
  if (!book) return [];
  const edName = lang === 'en' ? book.en : book.ar;
  const data = await loadHadithBook(edName);
  if (!data?.hadiths) return [];

  const q = query.toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '');
  const results = [];
  for (const h of data.hadiths) {
    if (results.length >= limit) break;
    const text = (h.text || '').toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '');
    if (text.includes(q)) {
      results.push({ number: h.hadithnumber, text: h.text, book: book.name });
    }
  }
  return results;
}

async function searchHadithAll(query, lang = 'ar', limit = 5) {
  const results = [];
  // ⚡ بحث في البخاري ومسلم أولاً (أهم الكتب) — بالتوازي
  const [buk, mus] = await Promise.all([
    searchHadithInBook(query, 'bukhari', lang, limit),
    searchHadithInBook(query, 'muslim', lang, limit),
  ]);
  results.push(...buk, ...mus);
  if (results.length >= limit) return results.slice(0, limit);

  // لو مش كفاية، ابحث في الباقي واحد واحد
  for (const bookKey of ['tirmidhi', 'abudawud', 'nasai', 'ibnmajah', 'malik']) {
    if (results.length >= limit) break;
    const found = await searchHadithInBook(query, bookKey, lang, limit - results.length);
    results.push(...found);
  }
  return results.slice(0, limit);
}

async function getHadithByNumber(bookKey, number) {
  const book = HADITH_BOOKS[bookKey];
  if (!book) return null;
  const data = await loadHadithBook(book.ar);
  if (!data?.hadiths) return null;
  return data.hadiths.find(h => h.hadithnumber == number) || null;
}

// ═══════════════════════════════════════════════════════════════
//  SEERAH / SAHABA / GHAZAWAT DDG WRAPPERS
// ═══════════════════════════════════════════════════════════════
async function ddgSeerahSearch(query, limit = 5) {
  const sites = ['islamweb.net', 'islamstory.com', 'nabulsi.com', 'islamway.net'];
  const siteFilter = sites.map(s => `site:${s}`).join(' OR ');
  let r = await ddgSearch(`(${siteFilter}) سيرة نبوية ${query}`, limit);
  if (!r.length) r = await ddgSearch(`السيرة النبوية ${query} حياة الرسول`, limit);
  return r;
}

async function ddgSahabaSearch(query, limit = 5) {
  const sites = ['islamweb.net', 'islamstory.com', 'nabulsi.com'];
  const siteFilter = sites.map(s => `site:${s}`).join(' OR ');
  let r = await ddgSearch(`(${siteFilter}) صحابة ${query}`, limit);
  if (!r.length) r = await ddgSearch(`صحابي ${query} سيرة مناقب رضي الله عنه`, limit);
  return r;
}

async function ddgGhazawatSearch(query, limit = 5) {
  const sites = ['islamweb.net', 'islamstory.com'];
  const siteFilter = sites.map(s => `site:${s}`).join(' OR ');
  let r = await ddgSearch(`(${siteFilter}) غزوة ${query}`, limit);
  if (!r.length) r = await ddgSearch(`غزوة ${query} غزوات الرسول معركة`, limit);
  return r;
}

async function ddgProphetLifeSearch(query, limit = 5) {
  const sites = ['islamweb.net', 'islamstory.com', 'nabulsi.com', 'islamway.net', 'alukah.net'];
  const siteFilter = sites.map(s => `site:${s}`).join(' OR ');
  let r = await ddgSearch(`(${siteFilter}) الرسول محمد ${query}`, limit);
  if (!r.length) r = await ddgSearch(`النبي محمد صلى الله عليه وسلم ${query}`, limit);
  return r;
}

// ─── English DDG wrappers ─────────────────────────────────────
async function ddgIslamQAEnglish(query, limit) {
  let r = await ddgSearch(`site:islamqa.info/en ${query}`, limit);
  if (!r.length) r = await ddgSearch(`islamqa.info english ${query}`, limit);
  return r;
}

async function ddgSunnahCom(query, limit) {
  let r = await ddgSearch(`site:sunnah.com ${query} hadith`, limit);
  if (!r.length) r = await ddgSearch(`sunnah.com ${query}`, limit);
  return r;
}

// ═══════════════════════════════════════════════════════════════
//  MCP SERVER
// ═══════════════════════════════════════════════════════════════
const server = new Server(
  { name: 'islamic-scholar-mcp', version: '4.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ═══ 📖 القرآن الكريم (API مباشر) ═══
    {
      name: 'search_quran',
      description: 'بحث في آيات القرآن الكريم عبر API مباشر. استخدمه عند السؤال عن آية أو كلمة في القرآن.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'كلمة أو عبارة للبحث في القرآن' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_quran_ayah',
      description: 'جلب آية محددة بالنص العربي والترجمة. استخدم format: سورة:آية (مثال: 2:255 لآية الكرسي).',
      inputSchema: {
        type: 'object',
        properties: {
          surah: { type: 'number', description: 'رقم السورة (1-114)' },
          ayah: { type: 'number', description: 'رقم الآية' },
        },
        required: ['surah', 'ayah'],
      },
    },
    {
      name: 'get_quran_tafsir',
      description: 'تفسير آية من 6 تفاسير: ibn-kathir, tabari, qurtubi, saadi, baghawi, muyassar.',
      inputSchema: {
        type: 'object',
        properties: {
          surah: { type: 'number' },
          ayah: { type: 'number' },
          tafsir: { type: 'string', default: 'ibn-kathir', description: 'اسم التفسير: ibn-kathir, tabari, qurtubi, saadi, baghawi, muyassar' },
        },
        required: ['surah', 'ayah'],
      },
    },
    {
      name: 'get_surah_info',
      description: 'معلومات عن سورة: اسمها، عدد آياتها، مكية/مدنية.',
      inputSchema: {
        type: 'object',
        properties: { surah_number: { type: 'number', description: 'رقم السورة (1-114)' } },
        required: ['surah_number'],
      },
    },
    // ═══ 📿 الحديث الشريف (API مباشر) ═══
    {
      name: 'search_hadith',
      description: 'بحث مباشر في الكتب السبعة (بخاري/مسلم/ترمذي/أبو داود/النسائي/ابن ماجه/مالك). أسرع من DDG.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'نص الحديث أو كلمة للبحث' },
          book: { type: 'string', description: 'كتاب محدد: bukhari, muslim, tirmidhi, abudawud, nasai, ibnmajah, malik. اتركه فارغ للبحث في الكل' },
          lang: { type: 'string', default: 'ar', description: 'ar أو en' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_hadith_by_number',
      description: 'جلب حديث برقمه من كتاب معين.',
      inputSchema: {
        type: 'object',
        properties: {
          book: { type: 'string', description: 'bukhari, muslim, tirmidhi, abudawud, nasai, ibnmajah, malik' },
          number: { type: 'number', description: 'رقم الحديث' },
        },
        required: ['book', 'number'],
      },
    },
    {
      name: 'search_dorar_hadiths',
      description: 'بحث في الدرر السنية عن أحاديث مع تخريج ودرجة الحديث. استخدمه لتحقق صحة حديث.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'موضوع أو نص الحديث' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    // ═══ 🕌 السيرة النبوية والصحابة والغزوات ═══
    {
      name: 'search_seerah',
      description: 'بحث في السيرة النبوية: مولد النبي ﷺ، البعثة، الهجرة، شمائله، معجزاته، أزواجه.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'الموضوع في السيرة النبوية' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'search_sahaba',
      description: 'بحث عن الصحابة رضي الله عنهم: سيرهم، مناقبهم، قصصهم، العشرة المبشرين بالجنة.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'اسم الصحابي أو موضوع (مثل: أبو بكر الصديق)' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'search_ghazawat',
      description: 'بحث عن غزوات الرسول ﷺ والسرايا: بدر، أحد، الخندق، خيبر، فتح مكة، حنين، تبوك...',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'اسم الغزوة أو موضوع' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'search_prophet_life',
      description: 'بحث عام عن حياة الرسول ﷺ: أخلاقه، معاملاته، عبادته، قيادته، دعوته، رسائله.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'أي موضوع عن حياة الرسول ﷺ' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    // ═══ ⚖️ الفتاوى ═══
    {
      name: 'search_fatwas',
      description: 'بحث شامل في الفتاوى من إسلام ويب + ابن باز + IslamQA + الإفتاء.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'السؤال الشرعي' },
          limit: { type: 'number', default: 6 },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch_fatwa_page',
      description: 'قراءة فتوى أو صفحة كاملة من أي موقع إسلامي معتمد.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
    // ═══ 🇬🇧 مصادر إنجليزية ═══
    {
      name: 'search_islamqa_english',
      description: 'Search IslamQA.info in English for fatwas and Islamic rulings.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'English search query' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    {
      name: 'search_sunnah_com',
      description: 'Search Sunnah.com for hadith in English.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Hadith topic in English' },
          limit: { type: 'number', default: 5 },
        },
        required: ['query'],
      },
    },
    // ═══ 🔍 بحث عام ═══
    {
      name: 'search_islamic_multi',
      description: 'بحث شامل في مواقع إسلامية متعددة. استخدمه للأسئلة العامة أو المعقدة.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 6 },
        },
        required: ['query'],
      },
    },
    {
      name: 'fetch_islamic_page',
      description: 'قراءة أي صفحة من المواقع الإسلامية المعتمدة.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
    {
      name: 'fetch_any_url',
      description: 'قراءة أي رابط من الإنترنت. استخدمه كملاذ أخير.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'الرابط الكامل' } },
        required: ['url'],
      },
    },
    // ═══ 📂 إدارة البحث ═══
    {
      name: 'write_research_step',
      description: 'حفظ نتائج خطوة بحث في ملف. للأسئلة المعقدة فقط.',
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
      description: 'قراءة ملف البحث كاملاً قبل الإجابة النهائية.',
      inputSchema: {
        type: 'object',
        properties: { session_id: { type: 'string' } },
        required: ['session_id'],
      },
    },
  ],

}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      // 📖 القرآن
      case 'search_quran':
        return await toolSearchQuran(args.query, args.limit ?? 5);
      case 'get_quran_ayah':
        return await toolGetQuranAyah(args.surah, args.ayah);
      case 'get_quran_tafsir':
        return await toolGetQuranTafsir(args.surah, args.ayah, args.tafsir ?? 'ibn-kathir');
      case 'get_surah_info':
        return await toolGetSurahInfo(args.surah_number);
      // 📿 الحديث
      case 'search_hadith':
        return await toolSearchHadith(args.query, args.book, args.lang ?? 'ar', args.limit ?? 5);
      case 'get_hadith_by_number':
        return await toolGetHadithByNumber(args.book, args.number);
      case 'search_dorar_hadiths':
        return await toolSearchDorarHadiths(args.query, args.limit ?? 5);
      // 🕌 السيرة والصحابة والغزوات
      case 'search_seerah':
        return await toolSearchSeerah(args.query, args.limit ?? 5);
      case 'search_sahaba':
        return await toolSearchSahaba(args.query, args.limit ?? 5);
      case 'search_ghazawat':
        return await toolSearchGhazawat(args.query, args.limit ?? 5);
      case 'search_prophet_life':
        return await toolSearchProphetLife(args.query, args.limit ?? 5);
      // ⚖️ الفتاوى
      case 'search_fatwas':
        return await toolSearchFatwas(args.query, args.limit ?? 6);
      case 'fetch_fatwa_page':
        return await toolFetchIslamicPage(args.url);
      // 🇬🇧 إنجليزي
      case 'search_islamqa_english':
        return await toolSearchIslamQAEnglish(args.query, args.limit ?? 5);
      case 'search_sunnah_com':
        return await toolSearchSunnahCom(args.query, args.limit ?? 5);
      // 🔍 عام
      case 'search_islamic_multi':
        return await toolSearchIslamicMulti(args.query, args.limit ?? 6);
      case 'fetch_islamic_page':
        return await toolFetchIslamicPage(args.url);
      case 'fetch_any_url':
        return await toolFetchAnyUrl(args.url);
      // 📂 إدارة البحث
      case 'write_research_step':
        return await writeResearchStep(args.session_id, args.step_name, args.content);
      case 'read_research_file':
        return await readResearchFile(args.session_id);
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

// 📖 القرآن
async function toolSearchQuran(query, limit) {
  console.error(`🔍 quran search: "${query}"`);
  const results = await quranSearch(query, limit);
  if (!results.length) return txt(`⚠️ لا نتائج في القرآن عن "${query}". جرب كلمات أخرى.`);
  return txt([
    `📖 نتائج البحث في القرآن — "${query}"`,
    `══════════════════════════════════`,
    '', ...results.map((r, i) => {
      const t = r.translations?.map(t => t.text?.replace(/<[^>]*>/g, '')).join(' | ') || '';
      return `${i+1}. 📌 ${r.verse_key}\n   📜 ${r.text?.slice(0, 200)}\n   📝 ${t.slice(0, 200)}`;
    }), '', `✅ ${results.length} آية — استخدم get_quran_ayah أو get_quran_tafsir لمزيد من التفاصيل`
  ].join('\n'));
}

async function toolGetQuranAyah(surah, ayah) {
  console.error(`📖 get ayah: ${surah}:${ayah}`);
  const verse = await quranGetAyah(surah, ayah);
  if (!verse) return txt(`⚠️ لم يتم العثور على الآية ${surah}:${ayah}`);
  const translations = verse.translations?.map(t => `• ${t.resource_name}: ${t.text?.replace(/<[^>]*>/g, '')}`).join('\n') || '';
  return txt([
    `📖 ══════ ${surah}:${ayah} ══════`,
    `📜 ${verse.text_uthmani || verse.text || ''}`,
    '', translations ? `📝 الترجمات:\n${translations}` : '',
    `══════════════════════════════════`,
  ].filter(Boolean).join('\n'));
}

async function toolGetQuranTafsir(surah, ayah, tafsirKey) {
  console.error(`📖 tafsir: ${surah}:${ayah} (${tafsirKey})`);
  const result = await quranGetTafsir(surah, ayah, tafsirKey);
  if (!result.tafsirs?.length) return txt(`⚠️ لا تفسير متاح للآية ${surah}:${ayah} من ${result.name}`);
  const text = result.tafsirs[0]?.text?.replace(/<[^>]*>/g, '') || '';
  return txt([
    `📖 ══════ تفسير ${surah}:${ayah} ══════`,
    `📚 ${result.name}`, '',
    text.slice(0, 4000), '',
    `══════════════════════════════════`,
  ].join('\n'));
}

async function toolGetSurahInfo(surahNumber) {
  console.error(`📖 surah info: ${surahNumber}`);
  const ch = await quranGetSurahInfo(surahNumber);
  if (!ch) return txt(`⚠️ لم يتم العثور على السورة رقم ${surahNumber}`);
  return txt([
    `📖 ══════ معلومات السورة ══════`,
    `📌 ${ch.name_arabic || ch.name_simple}`,
    `🔢 رقم السورة: ${ch.id}`,
    `📝 عدد الآيات: ${ch.verses_count}`,
    `🕌 ${ch.revelation_place === 'makkah' ? 'مكية' : 'مدنية'}`,
    ch.translated_name ? `📋 المعنى: ${ch.translated_name.name}` : null,
    `══════════════════════════════════`,
  ].filter(Boolean).join('\n'));
}

// 📿 الحديث
async function toolSearchHadith(query, book, lang, limit) {
  console.error(`📿 hadith search: "${query}" book=${book || 'all'} lang=${lang}`);
  let results;
  if (book) {
    results = await searchHadithInBook(query, book, lang, limit);
  } else {
    results = await searchHadithAll(query, lang, limit);
  }
  if (!results.length) return txt(`⚠️ لا نتائج عن "${query}" في كتب الحديث. جرب search_dorar_hadiths للبحث في الدرر السنية.`);
  return txt([
    `📿 نتائج البحث في الحديث — "${query}"`,
    `══════════════════════════════════`,
    '', ...results.map((r, i) =>
      `${i+1}. 📜 [${r.book} - حديث رقم ${r.number}]\n   ${r.text?.slice(0, 350)}`
    ), '', `✅ ${results.length} حديث`
  ].join('\n'));
}

async function toolGetHadithByNumber(bookKey, number) {
  console.error(`📿 hadith by number: ${bookKey} #${number}`);
  const h = await getHadithByNumber(bookKey, number);
  const book = HADITH_BOOKS[bookKey];
  if (!h) return txt(`⚠️ لم يتم العثور على الحديث رقم ${number} في ${book?.name || bookKey}`);
  return txt([
    `📿 ══════ ${book.name} - حديث ${number} ══════`,
    '', h.text || '', '',
    `══════════════════════════════════`,
  ].join('\n'));
}

async function toolSearchDorarHadiths(query, limit) {
  console.error(`🔍 dorar hadiths: "${query}"`);
  const results = await ddgDorarHadiths(query, limit);
  if (!results.length) return txt(`⚠️ لا نتائج في الدرر السنية عن "${query}".`);
  return txt([
    `📿 الدرر السنية — "${query}"`, `══════════════════════════════════`, '',
    ...results.map((r, i) => `${i+1}. 📜 ${r.title}\n   🔗 ${r.url}` + (r.snippet ? `\n   📝 ${r.snippet.slice(0, 260)}` : '')),
    '', `✅ ${results.length} نتيجة — استخدم fetch_fatwa_page لقراءة أي صفحة`
  ].join('\n'));
}

// 🕌 السيرة والصحابة والغزوات
function formatDDGResults(title, emoji, query, results) {
  if (!results.length) return txt(`⚠️ لا نتائج عن "${query}".`);
  return txt([
    `${emoji} ${title} — "${query}"`, `══════════════════════════════════`, '',
    ...results.map((r, i) => `${i+1}. ${r.title}\n   🔗 ${r.url}` + (r.snippet ? `\n   📝 ${r.snippet.slice(0, 250)}` : '')),
    '', `✅ ${results.length} نتيجة — استخدم fetch_fatwa_page لقراءة أي صفحة`
  ].join('\n'));
}

async function toolSearchSeerah(query, limit) {
  console.error(`🕌 seerah: "${query}"`);
  return formatDDGResults('السيرة النبوية', '🕌', query, await ddgSeerahSearch(query, limit));
}
async function toolSearchSahaba(query, limit) {
  console.error(`👥 sahaba: "${query}"`);
  return formatDDGResults('الصحابة', '👥', query, await ddgSahabaSearch(query, limit));
}
async function toolSearchGhazawat(query, limit) {
  console.error(`⚔️ ghazawat: "${query}"`);
  return formatDDGResults('الغزوات', '⚔️', query, await ddgGhazawatSearch(query, limit));
}
async function toolSearchProphetLife(query, limit) {
  console.error(`🌟 prophet life: "${query}"`);
  return formatDDGResults('حياة الرسول ﷺ', '🌟', query, await ddgProphetLifeSearch(query, limit));
}

// ⚖️ الفتاوى
async function toolSearchFatwas(query, limit) {
  console.error(`⚖️ fatwas: "${query}"`);
  const sites = ['islamweb.net', 'islamqa.info', 'binbaz.org.sa', 'alifta.gov.sa'];
  const siteFilter = sites.map(s => `site:${s}`).join(' OR ');
  let results = await ddgSearch(`(${siteFilter}) ${query} فتوى حكم`, limit);
  if (!results.length) results = await ddgSearch(`${query} فتوى حكم شرعي`, limit);
  return formatDDGResults('فتاوى شرعية', '⚖️', query, results);
}

// 🇬🇧 إنجليزي
async function toolSearchIslamQAEnglish(query, limit) {
  console.error(`🇬🇧 islamqa english: "${query}"`);
  return formatDDGResults('IslamQA English', '🇬🇧', query, await ddgIslamQAEnglish(query, limit));
}
async function toolSearchSunnahCom(query, limit) {
  console.error(`🇬🇧 sunnah.com: "${query}"`);
  return formatDDGResults('Sunnah.com', '📿', query, await ddgSunnahCom(query, limit));
}

// 🔍 بحث عام
async function toolSearchIslamicMulti(query, limit) {
  console.error(`🔍 multi-site: "${query}"`);
  const sites = ['islamweb.net', 'dorar.net', 'islamqa.info', 'binbaz.org.sa', 'islamway.net', 'islamstory.com', 'nabulsi.com'];
  const siteFilter = sites.map(s => `site:${s}`).join(' OR ');
  let results = await ddgSearch(`(${siteFilter}) ${query}`, limit);
  if (!results.length) results = await ddgSearch(`${query} إسلام فتوى حديث`, limit);
  return formatDDGResults('بحث شامل', '🌐', query, results);
}

async function toolFetchIslamicPage(url) {
  const ALLOWED = [
    'islamweb.net', 'dorar.net', 'islamway.net', 'ar.islamway.net',
    'saaid.net', 'islamhouse.com', 'alifta.gov.sa', 'dar-alifta.org',
    'sunnah.com', 'quran.com', 'alukah.net', 'islamqa.info',
    'binbaz.org.sa', 'ibnothaimeen.com', 'islamport.com', 'al-eman.com',
    'islamstory.com', 'nabulsi.com',
  ];
  let domain;
  try { domain = new URL(url).hostname.replace('www.', ''); }
  catch { return txt(`⚠️ رابط غير صحيح: ${url}`); }
  if (!ALLOWED.some(d => domain.includes(d))) {
    return txt(`⚠️ "${domain}" غير معتمد. استخدم fetch_any_url بدلاً منه.`);
  }
  let content;
  if (url.includes('islamweb.net')) content = await scrapeIslamwebFatwa(url);
  else if (url.includes('dorar.net')) content = await scrapeDorarPage(url);
  else content = await scrapeGenericPage(url);
  return txt(content);
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
console.error('║  Islamic Scholar MCP v4 — 20 Tools 🕌    ║');
console.error('║  القرآن + الحديث + السيرة + الصحابة     ║');
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
