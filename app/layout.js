import "./globals.css";
import { VENUE } from "@/lib/venue";

export const metadata = {
  title: `${VENUE.name} 零打報名`,
  description: `${VENUE.name} LINE 零打報名機器人`,
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
