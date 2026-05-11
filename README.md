# 🕌 Islamic Scholar MCP Server v3 - الشيخ الرقمي

> **MCP Server متقدم** يعمل كعالم إسلامي متخصص: يبحث في إسلام ويب + الدرر السنية، يكتب في ملف، ويجاوب بأدلة موثقة.
> 
> **✨ الجديد في v3:** Puppeteer Stealth لتجاوز حماية المواقع (403/Cloudflare) تلقائيًا!
> 
> **مجاني 100% - لا يحتاج أي API Key**

---

## 🚀 التثبيت السريع

### الطريقة 1: عبر npm (الأسهل)

```bash
npm install -g @islamic-scholar/mcp-server
```

ثم أضف في `mcp.json`:

```json
{
  "mcpServers": {
    "islamic-scholar": {
      "command": "npx",
      "args": ["-y", "@islamic-scholar/mcp-server"]
    }
  }
}
```

### الطريقة 2: من المصدر

```bash
# 1. استنسخ المشروع
git clone https://github.com/sys-Ninja/islamic-scholar-mcp
cd islamic-scholar-mcp

# 2. ثبّت المكتبات
npm install

# 3. اختبر
npm start
```

ثم أضف في `mcp.json`:

```json
{
  "mcpServers": {
    "islamic-scholar": {
      "command": "node",
      "args": ["/path/to/islamic-scholar-mcp/src/index.js"]
    }
  }
}
```

---

## ⚙️ إعداد Claude Desktop / Kiro

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Kiro:** `~/.kiro/settings/mcp.json`

```json
{
  "mcpServers": {
    "islamic-scholar": {
      "command": "node",
      "args": ["/home/user/islamic-scholar-mcp/src/index.js"],
      "disabled": false,
      "autoApprove": [
        "search_islamweb_fatwas",
        "fetch_islamweb_fatwa",
        "search_dorar_hadiths",
        "fetch_dorar_page",
        "search_islamic_multi",
        "fetch_islamic_page",
        "search_quran_tafsir",
        "write_research_step",
        "read_research_file",
        "clear_research_file",
        "fetch_any_url"
      ]
    }
  }
}
```

---

## 🛠️ الأدوات المتاحة (11 Tools)

### 🔍 أدوات البحث

1. **`search_islamweb_fatwas`** - البحث في إسلام ويب عن فتاوى
2. **`search_dorar_hadiths`** - البحث في الدرر السنية عن أحاديث
3. **`search_islamic_multi`** - بحث شامل في 6+ مواقع إسلامية
4. **`search_quran_tafsir`** - البحث في تفسير القرآن

### 📖 أدوات القراءة

5. **`fetch_islamweb_fatwa`** - قراءة فتوى كاملة من إسلام ويب
6. **`fetch_dorar_page`** - قراءة صفحة من الدرر السنية
7. **`fetch_islamic_page`** - قراءة أي صفحة من 16 موقع معتمد
8. **`fetch_any_url`** - 🆕 قراءة أي رابط من الإنترنت (غير مقيد)

### 💾 أدوات إدارة البحث

9. **`write_research_step`** - حفظ نتائج خطوة بحث
10. **`read_research_file`** - قراءة ملف الدراسة كاملاً
11. **`clear_research_file`** - مسح ملف الدراسة

---

## 🎯 مثال استخدام

```javascript
// 1. ابحث عن فتاوى
await search_islamweb_fatwas({ query: "حكم الصلاة في البيت", limit: 5 })

// 2. اقرأ فتوى محددة
await fetch_islamweb_fatwa({ url: "https://islamweb.net/ar/fatwa/..." })

// 3. بحث شامل
await search_islamic_multi({ query: "زكاة الذهب", limit: 6 })

// 4. احفظ النتائج
await write_research_step({
  session_id: "zakat_research",
  step_name: "islamweb_fatwas",
  content: "نتائج البحث..."
})

// 5. اقرأ كل البحث
await read_research_file({ session_id: "zakat_research" })

// 6. إذا لم تجد نتائج، استخدم fetch_any_url
await fetch_any_url({ url: "https://example.com/article" })
```

---

## 🔥 المميزات الجديدة (v3)

### ✅ **Puppeteer Stealth Mode**
- يتجاوز حماية Cloudflare تلقائيًا
- يحل مشكلة 403 Forbidden
- 17 تقنية تخفي متقدمة
- Fallback ذكي: axios أولاً (سريع) → Puppeteer عند الحاجة (قوي)

### ✅ **محرك بحث DuckDuckGo**
- مجاني 100%
- لا يحتاج API Key
- يبحث داخل المواقع الإسلامية مباشرة

### ✅ **16 موقع إسلامي معتمد**
- إسلام ويب | الدرر السنية | إسلام Q&A
- موقع ابن باز | موقع ابن عثيمين
- دار الإفتاء | الإسلام واي | صيد الفوائد
- وغيرها...

---

## 🔧 متطلبات النظام

- **Node.js:** >= 18.0.0
- **Chrome/Chromium:** يُثبت تلقائيًا مع Puppeteer
- **نظام التشغيل:** Windows, macOS, Linux

### تثبيت Chrome يدويًا (اختياري)

إذا واجهت مشاكل في تحميل Chrome:

```bash
# Linux
sudo apt-get install chromium-browser

# Mac
brew install chromium

# ثم حدد المسار
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

## 📚 منهجية البحث الموصى بها

عند سؤال ديني، اتبع هذه الخطوات:

```
1. clear_research_file → مسح البحث السابق
2. search_islamweb_fatwas → البحث عن فتاوى
3. fetch_islamweb_fatwa → قراءة الفتاوى المناسبة
4. write_research_step → حفظ النتائج
5. search_dorar_hadiths → البحث عن أحاديث
6. write_research_step → حفظ الأحاديث
7. search_quran_tafsir → البحث عن آيات وتفسير
8. write_research_step → حفظ التفسير
9. read_research_file → قراءة كل البحث
10. تقديم إجابة شاملة بالأدلة
```

---

## 🐛 استكشاف الأخطاء

### خطأ: "Failed to launch Chrome"

```bash
# حل 1: تخطي تحميل Chrome
PUPPETEER_SKIP_DOWNLOAD=true npm install

# حل 2: استخدام Chrome النظام
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
```

### خطأ: "403 Forbidden"

✅ **تم الحل تلقائيًا في v3!** Puppeteer Stealth يتعامل مع هذا.

### خطأ: "No results found"

- جرب `search_islamic_multi` بدلاً من أدوات البحث المحددة
- استخدم كلمات مفتاحية مختلفة
- بعض المواقع قد تكون بطيئة - انتظر قليلاً

---

## 🔌 ربطه بأي API نموذج

### مثال: Anthropic API

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['./src/index.js'],
});

const mcpClient = new Client({ name: 'app', version: '1.0.0' });
await mcpClient.connect(transport);

const { tools } = await mcpClient.listTools();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// استخدم الأدوات مع Claude
const response = await anthropic.messages.create({
  model: 'claude-opus-4',
  tools: tools,
  messages: [{ role: 'user', content: 'ما حكم الصلاة في البيت؟' }]
});
```

---

## 📝 الترخيص

MIT License - استخدمه بحرية!

---

## 🤝 المساهمة

نرحب بالمساهمات! افتح Issue أو Pull Request.

---

## 📧 الدعم

- **GitHub Issues:** [Report a bug](https://github.com/sys-Ninja/islamic-scholar-mcp/issues)
- **Discussions:** [Ask questions](https://github.com/sys-Ninja/islamic-scholar-mcp/discussions)

---

## 🌟 إذا أعجبك المشروع

⭐ **Star** المشروع على GitHub!

---

**صُنع بـ ❤️ للمسلمين في كل مكان**
