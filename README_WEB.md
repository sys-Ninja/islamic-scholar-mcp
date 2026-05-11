# 🕌 الشيخ الرقمي - Islamic Scholar Web UI

> **موقع ويب رهيب** يستخدم MCP + DeepSeek AI للبحث في المواقع الإسلامية والإجابة بأدلة موثقة

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![AI](https://img.shields.io/badge/AI-DeepSeek-purple)

---

## 🎯 ما هذا؟

موقع ويب تفاعلي يستخدم:
- ✅ **MCP (Model Context Protocol)** - 11 أداة بحث إسلامية
- ✅ **DeepSeek AI** - ذكاء اصطناعي قوي ورخيص ($0.14/مليون token)
- ✅ **Puppeteer Stealth** - تجاوز حماية المواقع تلقائياً
- ✅ **Real-time Streaming** - شاهد الأدوات تعمل live
- ✅ **UI حديث وجميل** - تجربة مستخدم رائعة

---

## 🚀 تشغيل سريع (3 خطوات)

### 1️⃣ احصل على DeepSeek API Key

```bash
# افتح: https://platform.deepseek.com/
# سجل حساب → API Keys → انشئ key جديد
```

### 2️⃣ ضع الـ Key

```bash
nano .env

# غيّر:
AI_API_KEY=your_deepseek_api_key_here

# إلى:
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 3️⃣ شغّل!

```bash
npm start
```

**افتح المتصفح:** http://localhost:3000

---

## 🌍 مشاركة عالمية (أي حد يدخل)

### الطريقة الأسهل: localtunnel

```bash
# ثبت
npm install -g localtunnel

# شغل السيرفر
npm start &

# شغل localtunnel
lt --port 3000
```

سيعطيك رابط مثل: `https://funny-cat-123.loca.lt`

**شارك الرابط مع أي حد في العالم!** 🌍

---

## ✨ المميزات

### 🎨 UI رهيب
- تصميم حديث بـ gradients جميلة
- animations سلسة
- responsive (يشتغل على الموبايل)

### 🛠️ عرض الأدوات Live
- شاهد كل أداة تُستخدم في الوقت الفعلي
- عرض الـ arguments والنتائج
- إحصائيات (عدد الأدوات + المصادر)

### ⚡ Streaming
- النتائج تظهر فوراً
- لا انتظار طويل
- تجربة سلسة

### 🔍 11 أداة بحث
1. `search_islamweb_fatwas` - البحث في إسلام ويب
2. `fetch_islamweb_fatwa` - قراءة فتوى كاملة
3. `search_dorar_hadiths` - البحث في الدرر السنية
4. `fetch_dorar_page` - قراءة صفحة الدرر
5. `search_islamic_multi` - بحث شامل في 6+ مواقع
6. `fetch_islamic_page` - قراءة أي صفحة إسلامية
7. `search_quran_tafsir` - البحث في التفسير
8. `write_research_step` - حفظ نتائج البحث
9. `read_research_file` - قراءة ملف البحث
10. `clear_research_file` - مسح ملف البحث
11. `fetch_any_url` - قراءة أي رابط

---

## 📊 التكلفة

| الخدمة | التكلفة |
|--------|---------|
| **DeepSeek API** | $0.14 لكل مليون token |
| **localtunnel** | مجاني 100% |
| **الاستضافة** | مجاني (على جهازك) |
| **المجموع** | **$1-3/شهر** |

---

## 🎯 أمثلة أسئلة

```
ما حكم الصلاة في البيت؟
حكم زكاة الذهب
تفسير آية الكرسي
حكم صيام يوم الجمعة منفرداً
ما صحة حديث "من صلى الفجر في جماعة"؟
```

---

## 📁 هيكل المشروع

```
islamic-scholar-mcp/
├── public/
│   ├── index.html          # الصفحة الرئيسية (UI رهيب!)
│   └── demo.html           # صفحة Demo
├── src/
│   └── index.js            # MCP Server (11 tools)
├── prompts/
│   └── system-prompt.md    # System prompt للـ AI
├── server.js               # HTTP Server + MCP Client
├── .env                    # إعدادات (API Key)
├── package.json
├── START.sh                # سكريبت تشغيل سريع
├── QUICKSTART.md           # تعليمات سريعة
├── WEB_SETUP.md            # تعليمات مفصلة
└── SHARE_GLOBALLY.md       # طرق المشاركة العالمية
```

---

## 🔧 API Endpoints

| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/` | GET | الصفحة الرئيسية |
| `/demo.html` | GET | صفحة Demo |
| `/api/ask-with-tools` | POST | السؤال مع MCP (Streaming) |
| `/api/ask` | POST | السؤال بدون MCP |
| `/health` | GET | حالة السيرفر |

---

## 🛠️ التقنيات المستخدمة

- **Backend:** Node.js + Express
- **MCP:** @modelcontextprotocol/sdk
- **AI:** DeepSeek API
- **Scraping:** Puppeteer + Cheerio
- **Frontend:** HTML + CSS + Vanilla JS
- **Streaming:** Server-Sent Events (SSE)

---

## 🐛 استكشاف الأخطاء

### "AI_API_KEY not configured"
```bash
# تأكد من ملف .env
cat .env | grep AI_API_KEY
```

### "MCP Client غير متصل"
```bash
# أعد تشغيل السيرفر
npm start
```

### "Port 3000 already in use"
```bash
# غيّر البورت في .env
echo "PORT=3001" >> .env
```

### "Failed to launch Chrome"
```bash
# ثبت Chromium
sudo apt-get install chromium-browser

# أو تخطى Puppeteer
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

---

## 📚 ملفات التعليمات

- **QUICKSTART.md** - تشغيل سريع (3 خطوات)
- **WEB_SETUP.md** - تعليمات مفصلة
- **SHARE_GLOBALLY.md** - طرق المشاركة العالمية
- **README_API.md** - توثيق الـ API

---

## 🌟 Screenshots

### الصفحة الرئيسية
![Home](https://via.placeholder.com/800x400?text=Islamic+Scholar+Web+UI)

### عرض الأدوات Live
![Tools](https://via.placeholder.com/800x400?text=Live+Tools+Display)

### الإجابة النهائية
![Answer](https://via.placeholder.com/800x400?text=Final+Answer)

---

## 🤝 المساهمة

نرحب بالمساهمات! افتح Issue أو Pull Request.

---

## 📝 الترخيص

MIT License - استخدمه بحرية!

---

## 📧 الدعم

- **GitHub Issues:** [Report a bug](https://github.com/sys-Ninja/islamic-scholar-mcp/issues)
- **Discussions:** [Ask questions](https://github.com/sys-Ninja/islamic-scholar-mcp/discussions)

---

## 🎉 جاهز!

```bash
# شغّل الموقع
npm start

# افتح المتصفح
http://localhost:3000

# استمتع! 🚀
```

---

**صُنع بـ ❤️ للمسلمين في كل مكان**
