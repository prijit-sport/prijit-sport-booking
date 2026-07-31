// ============================================================
// app-config.js — Shared Business Constants (Centralized)
// ============================================================
// ไฟล์นี้เก็บค่าคงที่ทางธุรกิจที่ใช้ร่วมกันระหว่าง app.js และ
// staff-panel.html เพื่อให้ปรับเปลี่ยนที่เดียวแล้วทุกฝั่งใช้ค่า
// เดียวกัน ไม่เกิดปัญหา DEPOSIT_PERCENTAGE ไม่ตรงกันอีก
//
// ทุกหน้าต้องโหลด app-config.js ก่อนไฟล์ script หลักที่จะใช้ค่า
// เหล่านี้ (firebase-init.js → app-config.js → app.js / script หลัก)
//
// หมายเหตุ: ไฟล์นี้ไม่มี secret/copyright sensitive ใด ๆ
// จึงไม่จำเป็นต้อง .gitignore (ต่างจาก config.js ที่เก็บ API Key)
// ============================================================
 
const APP_CONFIG = {
  // เปอร์เซ็นต์มัดจำ (0.3 = 30%)
  DEPOSIT_PERCENTAGE: 0.3,
 
  // จำนวนวันสูงสุดที่สามารถจองล่วงหน้าได้
  MAX_BOOKING_DAYS: 30,
 
  // ขนาดไฟล์สูงสุดที่อัปโหลดได้ (หน่วย MB)
  MAX_FILE_SIZE_MB: 5,
 
  // ระยะเวลาสำรองที่นั่งก่อนชำระเงิน (หน่วย นาที)
  PAYMENT_TIMEOUT_MINUTES: 15,
 
  // จำนวนวันที่เก็บ booking ที่สถานะ "completed" ไว้ในฐานข้อมูล
  // ก่อนจะถูกลบออกอัตโนมัติ (auto-delete) — เดิมตั้งไว้แค่ 1 วัน (24 ชม.)
  // ปรับเป็น 30 วัน เพื่อให้ดูรายงานสรุปผลย้อนหลังได้นานขึ้น
  // ใช้ใน staff-panel.html: markCompleted() และ autoCompleteBooking()
  // คำนวณเป็น milliseconds ผ่าน: APP_CONFIG.BOOKING_RETENTION_DAYS * 24 * 60 * 60 * 1000
  BOOKING_RETENTION_DAYS: 30
};
 