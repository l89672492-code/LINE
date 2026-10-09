import "./globals.css";
import { VENUE } from "@/lib/venue";

export const metadata = {
  title: `${VENUE.name} 租場地`,
  description: `${VENUE.name} LINE 租場地機器人`,
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
