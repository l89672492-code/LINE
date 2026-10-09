# 🏸 勁丰羽球館 LINE 租場地機器人

- 場館：勁丰羽球館
- 地址：新北市鶯歌區環河路60-1號
- 官方 LINE：@301jueln
- 訂場網站：https://jingfeng-booking.vercel.app （另一個專案 `jingfeng-booking`）

客人在 LINE 問空場、價格，機器人即時查訂場網站的資料回覆；要預約時，給客人訂場網站的連結。
機器人只用訂場網站的「公開金鑰」讀取資料，不會新增或修改任何預約。

## 使用技術

| 項目 | 用途 |
| --- | --- |
| Next.js | 接收 LINE 訊息的程式 |
| LINE Messaging API | 接收和回覆 LINE 訊息 |
| 訂場網站的資料庫（Supabase） | 查詢空場、價格（只讀） |
| Vercel | 把程式放到網路上（部署） |

## 機器人會回什麼

| 客人傳 | 機器人回 |
| --- | --- |
| 明天空場、週六晚上有場嗎、10/15 | 當天各時段還有幾面場、每小時價格 |
| 10/15 7點到9點 | 這段時間哪幾面場整段都空著、每面多少錢，加上當天空場狀況 |
| 價格、多少錢 | 平日／假日價格表 |
| 查詢預約、取消 | 查詢／取消預約的網址 |
| 我想租場地（沒說日期） | 詢問日期，附上訂場網址 |
| 說明 | 使用方式 |
| 其他閒聊 | 不回覆 |

價格、休館日、營業時間都在**訂場網站後台**修改，機器人會自動跟著變。

## 專案資料夾說明

```
app/
  page.js            首頁
  api/health/        健康檢查 /api/health（確認查得到訂場網站資料）
  api/line/webhook/  接收 LINE 訊息的網址
lib/
  venue.js           場館資料、訂場網站網址
  booking.js         向訂場網站查空場、價格
  rental.js          機器人的回覆內容
  parser.js          看懂日期、時間（今天、週五、7點到9點…）
  dates.js           日期換算（台灣時間）
  line.js            LINE 簽章驗證、回覆訊息
test/                自動測試（npm test）
```

## Vercel 環境變數

| 名稱 | 哪裡拿 |
| --- | --- |
| `LINE_CHANNEL_SECRET` | LINE Developers → Messaging API 頻道 → Basic settings → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers → Messaging API 頻道 → Messaging API → Channel access token |

改了環境變數之後，一定要到 Deployments 按 **Redeploy** 才會生效。
