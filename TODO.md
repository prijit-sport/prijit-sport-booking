# TODO - Prijit Sport (แก้เฉพาะจุดที่ยังไม่ได้แก้)

- [x] index.html: ข้อ 4 แก้ข้อความราคาใน `.price-list .price-item`

  - [ ] "ก่อน 6 โมง" → "07.00 - 18.00 น."
  - [ ] "หลัง 6 โมง" → "18.01 - 20.00 น."

- [x] index.html: ข้อ 7 ปรับ Rules section

  - [ ] ทำให้แต่ละ `.rule-item` มี `<strong>...</strong>` เป็นหัวข้อ
  - [ ] เพิ่ม rule-item สีแดง ตัวหนาท้ายสุด: ⚠️ หากมาไม่ตรงตามเวลาไม่สามารถขอค่ามัดจำคืนได้

- [x] staff-panel.html: Admin 1 เปลี่ยน h1 เป็น `🏟️ PRIJIT SPORT - ระบบ Admin`


- [x] staff-panel.html: Admin 2 renderBookings() ใส่ running number ก่อน loop

  - [ ] เปลี่ยน `booking.id.substring(0,8)` เป็น `${String(runNo++).padStart(2,'0')}`

- [x] staff-panel.html: Admin 5+6 renderBookings() เพิ่มคอลัมน์ “ค่าคงค้าง”

  - [ ] เปลี่ยนหัวคอลัมน์ “ผู้จอง” → “ชื่อ-นามสกุล”
  - [ ] เพิ่ม `<th>ค่าคงค้าง</th>` ต่อจาก `<th>มัดจำ</th>`
  - [ ] เพิ่ม td ด้วย `remaining = Math.max((booking.totalPrice||0)-depositVal,0)` สีแดง

- [x] staff-panel.html: Admin 7+8 แก้ค่าคงที่เวลาเปิด/ปิด

  - [ ] `SCHEDULE_START_HOUR = 7`
  - [ ] `SCHEDULE_END_HOUR = 19`

- [x] staff-panel.html: Admin 10 refundModal

  - [ ] ลบ form-group label `เหตุผล:`
  - [ ] ใน saveRefund() เอา reason ออก และตั้ง `reason: 'ยกเลิกการจอง'`

- [x] staff-panel.html: Admin 11 เพิ่ม Tab Report

  - [ ] เพิ่มปุ่มใน tab-navigation
  - [ ] เพิ่ม tab-content id `reportTab` (ตามที่กำหนด)
  - [ ] เพิ่มฟังก์ชัน `setReportRange(days)` และ `renderReport()`
  - [ ] เพิ่มเงื่อนไขใน `switchTab()` เพื่อเรียก `renderReport()`

