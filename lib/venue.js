// 場館基本資料：機器人回覆會用到這裡的資料，想改字直接改這裡
export const VENUE = {
  name: "勁丰羽球館",
  address: "新北市鶯歌區環河路60-1號",
  phone: "0928-890-559",
  lineId: "@301jueln",
  // 時區固定為台灣，計算「今天」、「週五」時使用
  timeZone: "Asia/Taipei",

  // 訂場網站（jingfeng-booking）
  bookingSite: "https://jingfeng-booking.vercel.app",
  // 訂場網站的資料庫：只用「公開金鑰」查空場和價格，跟網站上任何人看到的一樣，不能改資料
  bookingApi: "https://myhdhihqcqffqbfgjmut.supabase.co/rest/v1",
  bookingPublicKey: "sb_publishable_47qKKnYpp2MRLJErb9ODNw_cjIOsQG8",
};
