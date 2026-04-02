import "./globals.css";

export const metadata = {
  title: "وقتي",
  description: "منصة عربية لإدارة اليوم والمهام والأذكار والمسبحة.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
