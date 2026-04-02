# وقتي

مشروع Next.js + Firebase جاهز للنشر على Vercel.

## التشغيل محليًا

1. انسخ `.env.example` إلى `.env.local`
2. نفّذ:

```bash
npm install
npm run dev
```

## النشر على Vercel

1. ارفع هذا المشروع إلى GitHub أو ارفعه مباشرة على Vercel.
2. في إعدادات المشروع على Vercel أضف متغيرات البيئة الموجودة في `.env.example`.
3. اضغط Deploy.

## إعدادات Firebase المطلوبة

- Authentication > Google = Enabled
- Firestore Database = Enabled
- Firestore Rules:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Authorized domains

بعد نشر الموقع على Vercel، أضف دومين Vercel داخل:
Authentication > Settings > Authorized domains
