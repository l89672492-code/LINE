# 🏸 勁丰羽球館 LINE 零打報名機器人

- 場館：勁丰羽球館
- 地址：新北市鶯歌區環河路60-1號
- 官方 LINE：@213nkfpk

## 使用技術

| 項目 | 用途 |
| --- | --- |
| Next.js | 網站及 API 程式（管理後台、接收 LINE 訊息） |
| Supabase | 儲存報名資料的資料庫 |
| LINE Messaging API | 接收和回覆 LINE 訊息 |
| Claude API（可選） | 辨識比較口語的報名文字 |
| Vercel | 把程式放到網路上（部署） |

## 開發進度

- [x] 第一步：建立專案
- [ ] 第二步：建立 Supabase 資料庫
- [ ] 第三步：完成報名及取消功能
- [ ] 第四步：完成簡單管理後台
- [ ] 第五步：串接 LINE 自動接收訊息及回覆
- [ ] 第六步：部署到 Vercel

## 專案資料夾說明

```
app/
  layout.js          網站共用外框
  page.js            首頁（目前顯示場館資料與進度）
  globals.css        網站樣式
  api/health/        健康檢查網址 /api/health
lib/
  venue.js           場館基本資料（名稱、地址、官方 LINE）
.env.example         金鑰設定範本（之後步驟會教你填）
package.json         專案使用的套件清單
```

## 在自己電腦上執行（可選）

不在自己電腦上跑也沒關係，最後部署到 Vercel 就能使用。若想先在電腦看看：

1. 到 https://nodejs.org 下載並安裝「LTS」版本。
2. 打開「終端機」（Mac）或「命令提示字元」（Windows），進入這個資料夾。
3. 輸入 `npm install`（第一次才需要），等它跑完。
4. 輸入 `npm run dev`。
5. 用瀏覽器打開 http://localhost:3000 ，看到「勁丰羽球館」就成功了。
