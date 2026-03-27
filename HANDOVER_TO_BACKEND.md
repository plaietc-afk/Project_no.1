# Handover: Multi-Provider Support (Frontend -> Backend)

## 📌 ภาพรวมงานที่ทำเสร็จแล้ว (Frontend)
1. **หน้าจัดการ API Keys (`/` หรือ `page.tsx`)**
   - เพิ่ม Dropdown ให้เลือกระบุ Provider (`OpenAI` หรือ `Gemini`) ตอนสร้าง Key ใหม่เรียบร้อยแล้ว
   - การแสดงผลในตารางจะโชว์ Badge บอกว่าแต่ละ Key เป็นของ Provider ไหน

2. **หน้า Dashboard (`/` หรือ `page.tsx`)**
   - ปรับ UI กราฟสถิติ Token Usage รองรับการแสดงผลแยกตาม Provider (สีเขียว = OpenAI, สีฟ้า = Gemini)
   - เพิ่ม Filter Dropdown ให้ผู้ใช้เลือกดู Token แบบรวม (All), เฉพาะ OpenAI, หรือเฉพาะ Gemini ได้

3. **State / Mock Data**
   - กำหนดให้ Mock Data มีฟิลด์ `provider` แนบไว้ด้วย 

---

## 🚀 ส่วนที่ฝั่ง Backend ต้องมารับช่วงต่อ

**1. API: สร้าง Key ใหม่ (`POST /api/keys`)**
- ทาง Frontend จะทำการส่ง Payload ไปให้ดังนี้:
  ```json
  {
    "name": "My App Production",
    "provider": "OpenAI" // หรือ "Gemini"
  }
  ```
- สิ่งที่ Backend ต้องทำ: รับค่า `provider` และบันทึกลง Database ให้ผูกกับ Key นั้นๆ

**2. API: ดึงรายการ Key ทั้งหมด (`GET /api/keys`)**
- ทาง Backend ควร Return ข้อมูลโดยมีโครงสร้างประมาณนี้:
  ```json
  [
    {
      "id": 1,
      "name": "Prod Key",
      "provider": "OpenAI",
      "prefix": "sk-...",
      "created": "2026-03-20"
    }
  ]
  ```

**3. API: ดึงสถิติการใช้งาน (`GET /api/stats/token-usage`)**
- Frontend ต้องการโครงสร้างข้อมูลสำหรับพล็อตกราฟแยกตาม Provider รบกวน Backend ส่งแบบ Series หรือ Group by Date/Provider มาให้ครับ ตัวอย่าง:
  ```json
  {
    "OpenAI": [1200, 1500, 1800, 2200, 900, 2400, 3100],
    "Gemini": [800, 900, 1100, 1400, 1600, 2000, 2300]
  }
  ```
  *(หรือจะส่งเป็น Array of Objects ที่บอก Date, Provider, TokensUsed ก็ได้ เดี๋ยว Frontend ไป Map ข้อมูลเองได้ครับ)*

---
**พร้อมให้ Backend ลุยต่อได้เลยครับ!** 🛠️
