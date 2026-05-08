# 📦 دليل النشر على npm

## الخطوات السريعة

### 1. تسجيل حساب npm (إذا لم يكن لديك)
```bash
npm adduser
# أدخل: username, password, email
```

### 2. تسجيل الدخول
```bash
npm login
```

### 3. اختبار المشروع
```bash
# تأكد من عمل كل شيء
npm start

# اختبر الأدوات
# (استخدم MCP client للاختبار)
```

### 4. تحديث الإصدار
```bash
# للتحديثات الصغيرة (3.0.0 → 3.0.1)
npm version patch

# للميزات الجديدة (3.0.0 → 3.1.0)
npm version minor

# للتغييرات الكبيرة (3.0.0 → 4.0.0)
npm version major
```

### 5. النشر
```bash
# نشر عادي
npm publish --access public

# أو للنشر تحت scope
npm publish --access public
```

### 6. التحقق
```bash
# تحقق من النشر
npm view @islamic-scholar/mcp-server

# جرب التثبيت
npx @islamic-scholar/mcp-server
```

---

## ملاحظات مهمة

### قبل النشر
- ✅ تأكد من تحديث `CHANGELOG.md`
- ✅ تأكد من تحديث `README.md`
- ✅ اختبر كل الأدوات
- ✅ تأكد من عدم وجود أخطاء في الكود
- ✅ تأكد من `.npmignore` صحيح

### بعد النشر
- ✅ اختبر التثبيت: `npm install -g @islamic-scholar/mcp-server`
- ✅ اختبر التشغيل: `islamic-scholar-mcp`
- ✅ حدّث GitHub repo
- ✅ أنشئ GitHub Release
- ✅ شارك المشروع!

---

## إلغاء النشر (إذا احتجت)

```bash
# إلغاء نشر إصدار معين (خلال 72 ساعة فقط)
npm unpublish @islamic-scholar/mcp-server@3.0.0

# إلغاء نشر كل الإصدارات (خطير!)
npm unpublish @islamic-scholar/mcp-server --force
```

⚠️ **تحذير**: لا يمكن إعادة نشر نفس الإصدار بعد إلغائه!

---

## تحديث بعد النشر

```bash
# 1. عدّل الكود
# 2. اختبر
# 3. حدّث الإصدار
npm version patch

# 4. انشر
npm publish --access public

# 5. حدّث GitHub
git push && git push --tags
```

---

## روابط مفيدة

- npm Registry: https://www.npmjs.com/
- npm Docs: https://docs.npmjs.com/
- Semantic Versioning: https://semver.org/

---

**بالتوفيق! 🚀**
