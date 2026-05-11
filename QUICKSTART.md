# 🚀 تشغيل سريع - 3 خطوات فقط!

## 1️⃣ احصل على DeepSeek API Key

```bash
# افتح المتصفح على:
https://platform.deepseek.com/

# سجل حساب جديد
# اذهب إلى API Keys
# انشئ key جديد
# انسخ الـ key
```

---

## 2️⃣ ضع الـ API Key في ملف .env

```bash
# افتح ملف .env
nano .env

# غيّر السطر:
AI_API_KEY=your_deepseek_api_key_here

# إلى:
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# احفظ: Ctrl+O ثم Enter ثم Ctrl+X
```

---

## 3️⃣ شغّل الموقع!

```bash
npm start
```

**أو استخدم:**

```bash
./START.sh
```

---

## ✅ افتح المتصفح

```
http://localhost:3000
```

---

## 🌍 شارك الموقع مع الجميع

### استخدم ngrok (الأسهل):

```bash
# ثبت ngrok
sudo snap install ngrok

# سجل على ngrok.com واحصل على token
ngrok config add-authtoken YOUR_TOKEN

# شغل ngrok
ngrok http 3000
```

سيعطيك رابط عام مثل:
```
https://abc123.ngrok.io
```

شارك هذا الرابط مع أي حد في العالم! 🌍

---

## 💡 نصائح

- **التكلفة:** $0.14 لكل مليون token (رخيص جداً!)
- **السرعة:** DeepSeek سريع جداً
- **الدقة:** يستخدم 11 أداة بحث إسلامية

---

## ❓ مشاكل؟

### "AI_API_KEY not configured"
✅ تأكد من ملف .env

### "MCP Client غير متصل"
✅ أعد تشغيل السيرفر: `npm start`

### "Port 3000 already in use"
✅ غيّر البورت في .env:
```
PORT=3001
```

---

**جاهز! استمتع بالموقع 🎉**
