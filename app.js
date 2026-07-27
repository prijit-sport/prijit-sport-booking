console.log('🚀 [PRIJIT SPORT] Script starting...', new Date().toISOString());
 
const DEBUG_MODE = false;
function debugLog(...args) {
  if (DEBUG_MODE) console.log(...args);
}
console.log("🐛 Debug mode:", DEBUG_MODE ? "ON" : "OFF");
 
const CONFIG = {
  DEBUG_MODE: false,
  FIREBASE_RETRY_MAX: 50,
  FIREBASE_RETRY_INTERVAL: 100,
  AVAILABILITY_CHECK_TIMEOUT: 10000,
  TOAST_DURATION: 3000,
  DEBOUNCE_DELAY: 150,
  SLIDER_INTERVAL: 4000
};
 
(function() {
  try { localStorage.clear(); } catch(e) {}
  try { sessionStorage.clear(); } catch(e) {}
})();
 
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    showLoginInModal();
  }
}
 
function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }
}
 
function showLoginInModal() {
  document.getElementById('modalLoginForm').style.display = 'block';
  document.getElementById('modalRegisterForm').style.display = 'none';
}
 
function showRegisterInModal() {
  const loginForm = document.getElementById('modalLoginForm');
  const registerForm = document.getElementById('modalRegisterForm');
  if (!loginForm || !registerForm) return;
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
  registerForm.style.pointerEvents = 'auto';
  registerForm.style.opacity = '1';
  setTimeout(() => {
    const firstinput = registerForm.querySelector('input');
    if (firstinput) firstinput.focus();
  }, 300);
}
 
let auth, database, currentUser = null;
let isCancelling = false;
 
function initNavigation() {
  const desktopNavItems = document.querySelectorAll('#desktopNav .nav-item');
  desktopNavItems.forEach(item => {
    item.addEventListener('click', function() {
      scrollToSection(this.getAttribute('data-section'));
    });
  });
  const mobileNavItems = document.querySelectorAll('#mobileNav .nav-item');
  mobileNavItems.forEach(item => {
    item.addEventListener('click', function() {
      scrollToSection(this.getAttribute('data-section'));
      closeMobileMenu();
    });
  });
  const hamburger = document.getElementById('hamburgerBtn');
  if (hamburger) hamburger.addEventListener('click', toggleMobileMenu);
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  const loginBtn = document.getElementById('loginNavBtn');
  if (loginBtn) loginBtn.addEventListener('click', openLoginModal);
}
 
function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
 
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}
 
function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = '🙈';
  } else {
    input.type = 'password';
    button.textContent = '👁️';
  }
}
 
function toggleMobileMenu() {
  const overlay = document.getElementById('menuOverlay');
  const hamburger = document.getElementById('hamburgerBtn');
  if (!overlay || !hamburger) return;
  if (overlay.classList.contains('active')) {
    closeMobileMenu();
  } else {
    overlay.classList.add('active');
    hamburger.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}
 
function closeMobileMenu() {
  const overlay = document.getElementById('menuOverlay');
  const hamburger = document.getElementById('hamburgerBtn');
  if (overlay) overlay.classList.remove('active');
  if (hamburger) hamburger.classList.remove('active');
  document.body.style.overflow = '';
}
 
let selectedTimeSlot = null;
let currentBookingData = null;
let uploadedSlipFile = null;
let currentAvailabilityCheck = null;
let lastMenuToggleTime = 0;
const MENU_TOGGLE_DELAY = 300;
let lastNavigationTime = 0;
const NAVIGATION_DELAY = 300;
let currentSlideIndex = 0;
let slideInterval = null;
const galleryImages = ['f11.jpg', 'f8.jpg', 'f9.jpg', 'f1.jpg', 'f10.jpg', '2.jpg', 'f3.jpg'];
let currentGalleryIndex = 0;
let paymentTimer = null;
// หมายเหตุ: ค่านี้ต้องตรงกับ DEPOSIT_PERCENTAGE ใน staff-panel.html เสมอ (ปัจจุบัน = 0.30
// เท่ากัน) เพราะแยกไฟล์กันคนละที่ ไม่ได้ใช้ config กลางร่วมกัน — ถ้าจะปรับ % มัดจำ
// ต้องแก้ทั้ง 2 ไฟล์พร้อมกันเสมอ ไม่งั้นยอดมัดจำฝั่งลูกค้ากับฝั่งพนักงานจะไม่ตรงกัน
const DEPOSIT_PERCENTAGE = 0.3;
const MAX_BOOKING_DAYS = 30;
const MAX_FILE_SIZE_MB = 5;
const PAYMENT_TIMEOUT_MINUTES = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
 
const SecurityUtils = {
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  sanitizeInput(input, options = {}) {
    if (typeof input !== 'string') return '';
    const defaults = { maxLength: 500, allowSpaces: true, allowNumbers: true, allowThai: true, allowEnglish: true, allowSpecialChars: false };
    const opts = { ...defaults, ...options };
    let sanitized = input.trim().replace(/[<>"'`]/g, '').substring(0, opts.maxLength);
    let pattern = '';
    if (opts.allowThai) pattern += 'ก-๙';
    if (opts.allowEnglish) pattern += 'a-zA-Z';
    if (opts.allowNumbers) pattern += '0-9';
    if (opts.allowSpaces) pattern += '\\s';
    if (opts.allowSpecialChars) pattern += '._-';
    if (pattern) sanitized = sanitized.replace(new RegExp(`[^${pattern}]`, 'g'), '');
    return sanitized;
  },
  sanitizePhone(phone) {
    if (typeof phone !== 'string') return '';
    return phone.replace(/[^0-9]/g, '').substring(0, 10);
  },
  sanitizeUsername(username) {
    if (typeof username !== 'string') return '';
    return username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 50);
  }
};
 
const Validator = {
  username(value) {
    if (!value || value.trim().length < 3) return 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร';
    if (value.trim().length > 50) return 'ชื่อผู้ใช้ยาวเกินไป (ไม่เกิน 50 ตัวอักษร)';
    if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) return 'ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษร A-Z, ตัวเลข 0-9 และ _ เท่านั้น';
    if (/^[0-9]/.test(value.trim())) return 'ชื่อผู้ใช้ต้องขึ้นต้นด้วยตัวอักษร';
    return null;
  },
  fullname(value) {
    if (!value || value.trim().length < 2) return 'กรุณากรอกชื่อ-นามสกุล (อย่างน้อย 2 ตัวอักษร)';
    if (value.trim().length > 100) return 'ชื่อ-นามสกุลยาวเกินไป (ไม่เกิน 100 ตัวอักษร)';
    if (!/[ก-๙a-zA-Z]{2,}/.test(value)) return 'ชื่อ-นามสกุลต้องมีตัวอักษรอย่างน้อย 2 ตัว';
    return null;
  },
  name(value) { return this.fullname(value); },
  phone(value) {
    if (!value) return 'กรุณากรอกเบอร์โทรศัพท์';
    const cleaned = value.replace(/[\s-]/g, '');
    if (!/^0[0-9]{9}$/.test(cleaned)) return 'เบอร์โทรไม่ถูกต้อง (ต้องขึ้นต้นด้วย 0 และมี 10 หลัก)';
    const validPrefixes = ['08','09','06','02','03','04','05','07'];
    if (!validPrefixes.includes(cleaned.substring(0,2))) return 'เบอร์โทรไม่ถูกต้อง (prefix ไม่ถูกต้อง)';
    return null;
  },
  email(value) {
    if (!value) return 'กรุณากรอกอีเมล';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'รูปแบบอีเมลไม่ถูกต้อง';
    return null;
  },
  password(value) {
    if (!value) return 'กรุณากรอกรหัสผ่าน';
    if (value.length < 6) return 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
    if (value.length > 128) return 'รหัสผ่านยาวเกินไป (ไม่เกิน 128 ตัวอักษร)';
    return null;
  },
  field(value) { return value ? null : 'กรุณาเลือกสนาม'; },
  date(value) {
    if (!value) return 'กรุณาเลือกวันที่';
    // FIX (timezone bug): parse แบบ local time เหมือนจุดอื่น ๆ (ดูรายละเอียดใน confirmBooking())
    const selectedDate = new Date(value + 'T00:00:00');
    const today = new Date(); today.setHours(0,0,0,0);
    if (selectedDate < today) return 'ไม่สามารถเลือกวันที่ในอดีตได้';
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 30);
    if (selectedDate > maxDate) return 'สามารถจองล่วงหน้าได้ไม่เกิน 30 วัน';
    return null;
  },
  time(value) { return value ? null : 'กรุณาเลือกเวลา'; },
  file(file, maxSizeMB = 5) {
    if (!file) return 'กรุณาเลือกไฟล์';
    if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) return 'รองรับเฉพาะไฟล์ JPG และ PNG เท่านั้น';
    if (file.size > maxSizeMB * 1024 * 1024) return `ไฟล์ใหญ่เกินไป (ไม่เกิน ${maxSizeMB} MB)`;
    return null;
  },
  form(data) {
    const errors = {};
    Object.keys(data).forEach(field => {
      if (this[field]) { const e = this[field](data[field]); if (e) errors[field] = e; }
    });
    return Object.keys(errors).length > 0 ? errors : null;
  }
};
 
function validateAllFields(data) {
  const errors = {};
  Object.keys(data).forEach(field => {
    const validator = Validator[field];
    if (validator && typeof validator === 'function') {
      const error = validator(data[field]);
      if (error) errors[field] = error;
    }
  });
  return Object.keys(errors).length > 0 ? errors : null;
}
 
function showValidationErrors(errors, formId = null) {
  if (!errors) return;
  const messages = Object.entries(errors).map(([field, msg]) => `• ${getFieldDisplayName(field)}: ${msg}`).join('\n');
  showToast('❌ กรุณาแก้ไขข้อมูล:\n' + messages, 'error', 5000);
  Object.keys(errors).forEach(field => {
    const input = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
    if (input) {
      input.classList.add('error');
      input.addEventListener('focus', function() { this.classList.remove('error'); }, { once: true });
      if (Object.keys(errors)[0] === field) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => input.focus(), 500);
      }
    }
  });
}
 
function getFieldDisplayName(field) {
  const names = { username:'ชื่อผู้ใช้', fullname:'ชื่อ-นามสกุล', phone:'เบอร์โทร', password:'รหัสผ่าน', field:'สนาม', date:'วันที่', time:'เวลา' };
  return names[field] || field;
}
 
// ========== SLIDER ==========
function startSlider() { slideInterval = setInterval(() => changeSlide(1), 4000); }
function stopSlider() { clearInterval(slideInterval); }
function showSlide(index) {
  const slides = document.querySelectorAll(".slide");
  const dots = document.querySelectorAll(".dot");
  if (index >= slides.length) currentSlideIndex = 0;
  if (index < 0) currentSlideIndex = slides.length - 1;
  slides.forEach(s => s.classList.remove("active"));
  dots.forEach(d => d.classList.remove("active"));
  slides[currentSlideIndex].classList.add("active");
  dots[currentSlideIndex].classList.add("active");
}
function changeSlide(direction) {
  currentSlideIndex += direction;
  const slides = document.querySelectorAll(".slide");
  if (currentSlideIndex >= slides.length) currentSlideIndex = 0;
  else if (currentSlideIndex < 0) currentSlideIndex = slides.length - 1;
  showSlide(currentSlideIndex);
  stopSlider(); startSlider();
}
function currentSlide(index) { currentSlideIndex = index; showSlide(currentSlideIndex); stopSlider(); startSlider(); }
 
// ========== GALLERY ==========
function changeGalleryImage(direction) {
  currentGalleryIndex += direction;
  if (currentGalleryIndex < 0) currentGalleryIndex = galleryImages.length - 1;
  else if (currentGalleryIndex >= galleryImages.length) currentGalleryIndex = 0;
  updateGalleryDisplay();
}
function selectGalleryImage(index) { currentGalleryIndex = index; updateGalleryDisplay(); }
function updateGalleryDisplay() {
  document.getElementById('galleryMainImage').src = galleryImages[currentGalleryIndex];
  document.getElementById('currentImageNumber').textContent = currentGalleryIndex + 1;
  document.getElementById('totalImages').textContent = galleryImages.length;
  document.querySelectorAll('.gallery-thumbnail').forEach((thumb, index) => {
    thumb.classList.toggle('active', index === currentGalleryIndex);
  });
}
document.addEventListener('keydown', (e) => {
  const g = document.getElementById('gallerySection');
  if (g && isInViewport(g)) {
    if (e.key === 'ArrowLeft') changeGalleryImage(-1);
    else if (e.key === 'ArrowRight') changeGalleryImage(1);
  }
});
function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return rect.top >= 0 && rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth);
}
 
// ========== STAFF MODAL ==========
function openStaffModal(url) {
  const modal = document.getElementById('staffGalleryModal');
  const modalImg = document.getElementById('staffGalleryModalImg');
  if (!modal || !modalImg) return;
  const img = new Image();
  img.onload = function() { modalImg.src = url; };
  img.onerror = function() { modalImg.src = url; };
  img.src = url;
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeStaffModal() {
  const modal = document.getElementById('staffGalleryModal');
  if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
}
 
// ========== TIME SLOTS ==========
function initializeTimeSlots() {
  const timeSlots = document.querySelectorAll('.time-slot-btn');
  timeSlots.forEach(btn => {
    let touchHandled = false;
    btn.addEventListener('touchend', function(e) {
      e.preventDefault(); e.stopPropagation();
      if (this.classList.contains('booked')) { alert('❌ ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น'); return; }
      touchHandled = true; selectTime(this);
      setTimeout(() => { touchHandled = false; }, 300);
    }, { passive: false });
    btn.addEventListener('click', function(e) {
      if (touchHandled) { e.preventDefault(); return; }
      if (this.classList.contains('booked')) { alert('❌ ช่วงเวลานี้ถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น'); return; }
      selectTime(this);
    });
  });
}
function selectTime(element) {
  if (element.classList.contains('booked')) return;
  document.querySelectorAll(".time-slot-btn").forEach(s => s.classList.remove("selected"));
  element.classList.add("selected");
  selectedTimeSlot = element.getAttribute('data-time');
}
function resetTimeSlots() {
  document.querySelectorAll('.time-slot-btn').forEach(btn => {
    btn.classList.remove('available', 'booked', 'selected');
    btn.disabled = false;
    const badge = btn.querySelector('.status-badge');
    if (badge) badge.remove();
  });
}
function checkAvailability() {
  if (currentAvailabilityCheck && typeof currentAvailabilityCheck.off === 'function') currentAvailabilityCheck.off();
  currentAvailabilityCheck = null;
  const field = document.getElementById('fieldSelect').value;
  const date = document.getElementById('dateSelect').value;
  if (!field || !date) { resetTimeSlots(); return; }
  const statusDiv = document.getElementById('availabilityStatus');
  statusDiv.style.display = 'block';
  statusDiv.className = 'availability-notice checking';
  statusDiv.innerHTML = '<strong>⏳ กำลังตรวจสอบสถานะสนาม...</strong>';
  const timeoutId = setTimeout(() => {
    statusDiv.innerHTML = '<strong style="color:#ef4444;">⚠️ การเชื่อมต่อล่าช้า กรุณาลองใหม่อีกครั้ง</strong>';
  }, 10000);
  // FIX (privacy/High): เดิมจุดนี้ query ทั้ง node 'bookings' โดย field
  // ซึ่งดึงข้อมูลส่วนตัวลูกค้าทุกคนกลับมาด้วย (ชื่อ, เบอร์โทร, สลิปมัดจำ)
  // ทำให้ลูกค้าคนไหนก็ตามที่ login อยู่เห็นข้อมูลของคนอื่นได้ทั้งหมด
  // เปลี่ยนมา query node 'availability/{field}/{date}' แทน ซึ่งเก็บแค่
  // "เวลาไหนถูกจองแล้วบ้าง" ไม่มีข้อมูลส่วนตัวใด ๆ ปนอยู่เลย
  const ref = database.ref('availability/' + field + '/' + date);
  currentAvailabilityCheck = ref;
  ref.once('value').then((snapshot) => {
    clearTimeout(timeoutId);
    if (currentAvailabilityCheck !== ref) return;
    const bookedTimes = snapshot.exists() ? Object.keys(snapshot.val()) : [];
    updateTimeSlotAvailability(bookedTimes);
    statusDiv.style.display = 'none';
    currentAvailabilityCheck = null;
  }).catch((error) => {
    clearTimeout(timeoutId);
    if (currentAvailabilityCheck !== ref) return;
    statusDiv.className = 'availability-notice';
    statusDiv.style.display = 'block';
    currentAvailabilityCheck = null;
  });
}
 
// Helper: ตำแหน่งอ้างอิงของ node 'availability' ที่ mirror มาจาก bookings
// เก็บแค่ field/date/time ที่ถูกจองแล้ว ไม่มีข้อมูลส่วนตัวใด ๆ — ใช้แทนการ
// query 'bookings' โดยตรงในทุกจุดที่แค่ต้องการรู้ว่า "ช่วงเวลานี้ว่างไหม"
function availabilityRef(field, date, time) {
  return database.ref('availability/' + field + '/' + date + '/' + time);
}
function updateTimeSlotAvailability(bookedTimes) {
  const timeSlots = document.querySelectorAll('.time-slot-btn');
  const bookedTimesSet = new Set(bookedTimes);
  const selectedDate = document.getElementById('dateSelect').value;
  if (!selectedDate) { resetTimeSlots(); return; }
  const today = new Date(); today.setHours(0,0,0,0);
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const isPastDate = selectedDateObj < today;
  const isToday = selectedDateObj.getTime() === today.getTime();
  const isFutureDate = selectedDateObj > today;
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  timeSlots.forEach(btn => {
    const time = btn.getAttribute('data-time');
    btn.classList.remove('available','booked','selected','past-time');
    const existingBadge = btn.querySelector('.status-badge');
    if (existingBadge) existingBadge.remove();
    btn.style.opacity = '1';
    let shouldDisable = false, badgeText = 'ว่าง', badgeColor = '', statusClass = 'available';
    if (isPastDate) {
      shouldDisable = true; badgeText = 'ผ่านแล้ว'; badgeColor = '#ef4444'; statusClass = 'booked past-time'; btn.style.opacity = '0.5';
    } else if (isToday) {
      const [startHour, startMinute] = time.split(' - ')[0].split(':').map(Number);
      const isPastTime = startHour < currentHour || (startHour === currentHour && startMinute <= currentMinute);
      if (isPastTime) { shouldDisable = true; badgeText = 'ผ่านแล้ว'; badgeColor = '#ef4444'; statusClass = 'booked past-time'; btn.style.opacity = '0.5'; }
      else if (bookedTimesSet.has(time)) { shouldDisable = true; badgeText = 'ไม่ว่าง'; statusClass = 'booked'; }
    } else if (isFutureDate) {
      if (bookedTimesSet.has(time)) { shouldDisable = true; badgeText = 'ไม่ว่าง'; statusClass = 'booked'; }
    }
    btn.classList.add(...statusClass.split(' '));
    btn.disabled = shouldDisable;
    const badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.textContent = badgeText;
    if (badgeColor) badge.style.background = badgeColor;
    btn.appendChild(badge);
  });
}
function resetBookingForm() {
  document.getElementById('fieldSelect').value = '';
  document.getElementById('dateSelect').value = '';
  selectedTimeSlot = null;
  resetTimeSlots();
}
 
// ========== AUTH ==========
async function handleLogin(e) {
  e.preventDefault();
  const loginBtn = e.target.querySelector('button[type="submit"]');
  const originalText = loginBtn.textContent;
  try {
    const username = document.getElementById("modalLoginUsername").value;
    const password = document.getElementById("modalLoginPassword").value;
    const errors = {};
    const usernameError = Validator.username(username);
    if (usernameError) errors.modalLoginUsername = usernameError;
    const passwordError = Validator.password(password);
    if (passwordError) errors.modalLoginPassword = passwordError;
    if (Object.keys(errors).length > 0) { showValidationErrors(errors); return; }
    const sanitizedUsername = SecurityUtils.sanitizeUsername(username);
    if (!sanitizedUsername || sanitizedUsername.length < 3) {
      showToast('❌ ชื่อผู้ใช้มีตัวอักษรที่ไม่ถูกต้อง', 'error');
      document.getElementById("modalLoginUsername").focus();
      return;
    }
    loginBtn.disabled = true;
    loginBtn.innerHTML = '⏳ กำลังเข้าสู่ระบบ...';
    const email = sanitizedUsername + "@prijitsport.com";
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const snapshot = await database.ref('users/' + userCredential.user.uid).once('value');
    const userData = snapshot.val();
    currentUser = {
      uid: auth.currentUser.uid,
      username: SecurityUtils.escapeHtml(userData.username || ''),
      fullname: SecurityUtils.escapeHtml(userData.fullname || ''),
      phone: SecurityUtils.sanitizePhone(userData.phone || ''),
      createdAt: userData.createdAt
    };
    document.getElementById("currentUser").textContent = currentUser.fullname;
    document.getElementById("loginNavBtn").style.display = "none";
    document.getElementById("userInfo").style.display = "flex";
    closeLoginModal();
    showToast("✅ เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับ " + currentUser.fullname, 'success');
    e.target.reset();
    updateBookingList();
  } catch (error) {
    let msg = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    if (error.code === 'auth/user-not-found') msg = 'ไม่พบชื่อผู้ใช้นี้ในระบบ';
    else if (error.code === 'auth/wrong-password') msg = 'รหัสผ่านไม่ถูกต้อง';
    else if (error.code === 'auth/too-many-requests') msg = 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่';
    else if (error.code === 'auth/network-request-failed') msg = 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ';
    showToast("❌ " + msg, 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = originalText;
  }
}
 
async function handleRegister(e) {
  e.preventDefault();
  const registerBtn = e.target.querySelector('button[type="submit"]');
  const originalText = registerBtn.textContent;
  try {
    const username = document.getElementById("modalRegUsername").value;
    const fullname = document.getElementById("modalRegFullname").value;
    const phone = document.getElementById("modalRegPhone").value;
    const password = document.getElementById("modalRegPassword").value;
    const errors = validateAllFields({ username, fullname, phone, password });
    if (errors) { showValidationErrors(errors); return; }
    const sanitizedData = {
      username: SecurityUtils.sanitizeUsername(username),
      fullname: SecurityUtils.sanitizeInput(fullname, { allowThai:true, allowEnglish:true, allowSpaces:true, maxLength:100 }),
      phone: SecurityUtils.sanitizePhone(phone)
    };
    if (!sanitizedData.username || sanitizedData.username.length < 3) { showToast('❌ ชื่อผู้ใช้มีตัวอักษรที่ไม่ถูกต้อง', 'error'); return; }
    if (!sanitizedData.fullname || sanitizedData.fullname.length < 2) { showToast('❌ ชื่อ-นามสกุลมีตัวอักษรที่ไม่ถูกต้อง', 'error'); return; }
    if (!sanitizedData.phone || sanitizedData.phone.length !== 10) { showToast('❌ เบอร์โทรไม่ถูกต้อง', 'error'); return; }
    registerBtn.disabled = true;
    registerBtn.innerHTML = '⏳ กำลังสมัครสมาชิก...';
    const email = sanitizedData.username + "@prijitsport.com";
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    await database.ref('users/' + userCredential.user.uid).set({
      username: sanitizedData.username,
      fullname: sanitizedData.fullname,
      phone: sanitizedData.phone,
      createdAt: new Date().toISOString()
    });
    showToast("✅ สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ", 'success', 4000);
    e.target.reset();
    setTimeout(() => showLoginInModal(), 500);
  } catch (error) {
    let msg = 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
    if (error.code === 'auth/email-already-in-use') msg = 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น';
    else if (error.code === 'auth/weak-password') msg = 'รหัสผ่านไม่ปลอดภัยพอ กรุณาใช้รหัสผ่านที่แข็งแรงขึ้น';
    else if (error.code === 'auth/network-request-failed') msg = 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ';
    showToast("❌ " + msg, 'error', 5000);
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = originalText;
  }
}
 
async function handleLogout() {
  if (!confirm("ต้องการออกจากระบบใช่หรือไม่?")) return;
  try {
    showLoading('กำลังออกจากระบบ...');
    await auth.signOut();
    currentUser = null;
    document.getElementById("loginNavBtn").style.display = "inline-block";
    document.getElementById("userInfo").style.display = "none";
    const bookingListDiv = document.getElementById('bookingList');
    if (bookingListDiv) {
      bookingListDiv.innerHTML = `<div style="text-align:center;padding:40px;"><p style="color:#6b7280;font-size:1.1em;margin-bottom:20px;">กรุณา Login เพื่อดูรายการจอง</p><button onclick="openLoginModal()" style="background:#22c55e;color:white;padding:12px 24px;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:1em;">🔐 เข้าสู่ระบบ</button></div>`;
    }
    hideLoading();
    showToast("✅ ออกจากระบบเรียบร้อย", 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    hideLoading();
    showToast("❌ ออกจากระบบไม่สำเร็จ กรุณาลองใหม่", 'error');
  }
}
 
// ========== FORMAT DATE (DD/MM/YYYY พ.ศ.) ==========
function formatDateThai(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year  = d.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  } catch(e) { return '-'; }
}
 
// ========== BOOKING ==========
function confirmBooking() {
  if (!currentUser) {
    showToast('กรุณา Login ก่อนจองสนาม', 'warning', 4000);
    setTimeout(() => openLoginModal(), 500);
    return;
  }
  const field = document.getElementById("fieldSelect").value;
  const date = document.getElementById("dateSelect").value;
  if (!field || !date || !selectedTimeSlot) {
    showToast("❌ กรุณากรอกข้อมูลให้ครบถ้วน", 'error');
    return;
  }
  // FIX (timezone bug): เดิมใช้ `new Date(date)` ตรง ๆ กับ string วันที่ล้วน ๆ
  // (เช่น "2026-07-27") ซึ่ง JavaScript จะตีความเป็นเวลา UTC เที่ยงคืนเสมอ ไม่ใช่
  // เวลาท้องถิ่น ขณะที่ `today` คำนวณจากเวลาท้องถิ่น ในโซนเวลาไทย (UTC+7) ทำให้
  // selectedDate (UTC เที่ยงคืน) มีค่ามากกว่า today (เวลาไทยเที่ยงคืน) อยู่ 7 ชม.
  // เสมอ ผลคือแม้เลือก "วันนี้" พอดี โค้ดก็เข้าใจผิดว่าเป็นวันในอนาคต ทำให้ข้าม
  // การเช็ค "เวลาที่เลือกผ่านไปแล้วหรือยัง" ไปเลย จองเวลาที่เลยมาแล้วของวันนี้ได้
  // แก้โดย parse แบบเดียวกับจุดอื่น ๆ ในไฟล์ (เช่น updateTimeSlotAvailability())
  // คือต่อ 'T00:00:00' ต่อท้าย ซึ่งบังคับให้ JavaScript ตีความเป็นเวลาท้องถิ่น
  const selectedDate = new Date(date + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  if (selectedDate.getTime() === today.getTime()) {
    const now = new Date();
    const [startHour, startMinute] = selectedTimeSlot.split(' - ')[0].split(':').map(Number);
    if (startHour < now.getHours() || (startHour === now.getHours() && startMinute <= now.getMinutes())) {
      showToast("❌ ไม่สามารถจองย้อนหลังได้ กรุณาเลือกช่วงเวลาอื่น", 'error');
      return;
    }
  }
  if (selectedDate < today) { alert("❌ ไม่สามารถจองย้อนหลังได้"); return; }
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 30);
  if (selectedDate > maxDate) { alert("❌ สามารถจองได้สูงสุด 30 วันล่วงหน้าเท่านั้น"); return; }
 
  let totalPrice = 0;
  const hour = parseInt(selectedTimeSlot.split(":")[0]);
  if (field.includes("สนาม 1") || field.includes("สนาม 2") || field.includes("สนาม 3")) totalPrice = hour >= 18 ? 1200 : 1000;
  else if (field.includes("สนาม 4")) totalPrice = hour >= 18 ? 1300 : 1100;
  else if (field.includes("สนาม 5")) totalPrice = hour >= 18 ? 1100 : 900;
  else if (field.includes("สนาม 6")) totalPrice = hour >= 18 ? 900 : 700;
 
  const depositAmount = Math.round(totalPrice * DEPOSIT_PERCENTAGE);
  const remainingAmount = totalPrice - depositAmount;
  currentBookingData = { field, date, time: selectedTimeSlot, totalPrice, depositAmount, remainingAmount };
 
  const displayDate = formatDateThai(date);
 
  // ใช้ custom modal แทน confirm() เพื่อแสดงข้อความได้ครบ
  const modalHtml = `
    <div id="confirmBookingModal" style="
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:rgba(0,0,0,0.7);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="
        background:white;border-radius:16px;padding:28px;
        max-width:420px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);
        max-height:90vh;overflow-y:auto;">
 
        <h3 style="color:#065f46;font-size:1.15em;margin-bottom:16px;text-align:center;">
          📋 ตรวจสอบข้อมูลการจอง
        </h3>
 
        <div style="background:#f0fdf4;border-radius:10px;padding:14px;margin-bottom:14px;font-size:0.95em;font-weight:400;line-height:1.8;">
          <div>📍 สนาม: ${field}</div>
          <div>📅 วันที่: ${displayDate}</div>
          <div>⏰ เวลา: ${selectedTimeSlot}</div>
        </div>
 
        <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px;font-size:0.95em;font-weight:400;line-height:1.8;">
          <div>💰 ราคาเต็ม: ${totalPrice.toLocaleString()} บาท</div>
          <div>💵 มัดจำ 30%: <span style="color:#10b981;">${depositAmount.toLocaleString()} บาท</span></div>
          <div>💸 คงเหลือจ่ายที่สนาม: <span style="color:#ef4444;">${remainingAmount.toLocaleString()} บาท</span></div>
        </div>
 
        <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px;font-size:0.95em;font-weight:400;line-height:1.8;">
          <div>👤 ผู้จอง: ${currentUser.fullname}</div>
          <div>📞 เบอร์: ${currentUser.phone}</div>
        </div>
 
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px;margin-bottom:20px;font-size:0.95em;font-weight:400;line-height:1.8;">
          <div style="color:#1d4ed8;margin-bottom:8px;">💡 สรุปการชำระเงิน</div>
          <div style="color:#000;">1. ชำระค่ามัดจำ ${depositAmount.toLocaleString()} บาท ผ่าน QR Code ตอนนี้</div>
          <div style="color:#000;margin-top:6px;">2. มาตามนัด: จ่ายเพิ่มเพียง ${remainingAmount.toLocaleString()} บาท ที่สนาม เพราะมัดจำ ${depositAmount.toLocaleString()} บาท หักจ่ายไปแล้ว</div>
          <div style="color:#000;margin-top:6px;">3. ไม่มาตามที่จอง: โดนหักเก็บค่ามัดจำ ${depositAmount.toLocaleString()} บาท ทันที</div>
        </div>
 
        <div style="display:flex;gap:12px;">
          <button onclick="document.getElementById('confirmBookingModal').remove()"
            style="flex:1;padding:12px;border:2px solid #e5e7eb;background:white;border-radius:10px;font-size:0.95em;font-weight:400;cursor:pointer;font-family:inherit;color:#666;">
            ยกเลิก
          </button>
          <button onclick="document.getElementById('confirmBookingModal').remove(); showPaymentModal();"
            style="flex:2;padding:12px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:10px;font-size:0.95em;font-weight:400;cursor:pointer;font-family:inherit;">
            ✅ ยืนยันการจอง
          </button>
        </div>
      </div>
    </div>`;
 
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}
 
function showPaymentModal() {
  const data = currentBookingData;
  const displayDate = formatDateThai(data.date);
  const modalHTML = `
    <div id="paymentModal" class="payment-modal active">
      <div class="payment-content">
        <div class="payment-header">
          <h2>💳 ชำระค่ามัดจำ</h2>
          <p>จองสนาม ${data.field}</p>
        </div>
        <div class="payment-summary">
          <div class="summary-row">
            <span class="summary-label">💵 ค่าบริการทั้งหมด</span>
            <span class="summary-value">${data.totalPrice.toLocaleString()} บาท</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">📍 ค่ามัดจำ 30%</span>
            <span class="summary-value">${data.depositAmount.toLocaleString()} บาท</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">💸 ค่าบริการคงเหลือจ่ายที่สนาม</span>
            <span class="summary-value" style="color:#ef4444;font-weight:400;">${data.remainingAmount.toLocaleString()} บาท</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">💰 ต้องชำระตอนนี้</span>
            <span class="summary-value" style="color:#22c55e;font-weight:400;">${data.depositAmount.toLocaleString()} บาท</span>
          </div>
        </div>
        <div class="deposit-highlight">
          <p style="font-weight:400;">📱 สแกน QR Code เพื่อชำระค่ามัดจำ</p>
        </div>
        <div class="qr-code-container">
          <div class="qr-code-image" style="position:relative;min-height:300px;">
            <div id="qrLoading" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#6b7280;">
              <div style="width:40px;height:40px;border:3px solid #f3f4f6;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 10px;"></div>
              <p style="font-size:0.9em;">กำลังโหลด QR Code...</p>
            </div>
            <img id="qrCodeCanvas" src="qr-promptpay.png" alt="QR Code PromptPay"
              style="width:100%;height:100%;object-fit:contain;display:none;"
              onload="this.style.display='block';var l=document.getElementById('qrLoading');if(l)l.remove();"
              onerror="handleQRError(this)">
          </div>
        </div>
        <div class="payment-info" style="font-weight:400;">
          <p style="font-weight:400;">💰 ยอดชำระ: ${data.depositAmount.toLocaleString()} บาท</p>
          <p style="font-weight:400;">📱 เลขพร้อมเพย์: 1103100835163</p>
          <p style="font-weight:400;">🏢 ชื่อบัญชี: นาย พัสกร ราชชมภู</p>
        </div>
        <div class="upload-section">
          <label class="upload-label">📤 อัพโหลดสลิปการโอนเงิน</label>
          <div class="upload-area" id="uploadArea" onclick="document.getElementById('slipInput').click()">
            <p>📎 คลิกเพื่ออัพโหลดรูปสลิป</p>
            <p style="font-size:0.9em;color:#6b7280;margin-top:10px;">หรือลากไฟล์มาวางที่นี่<br>รองรับ: JPG, PNG</p>
          </div>
          <input type="file" id="slipInput" accept="image/*" style="display:none;" onchange="handleSlipUpload(event)">
          <img id="slipPreview" style="display:none;">
        </div>
        <div class="payment-terms">
          <h4 style="font-weight:400;">💡 สรุปการชำระเงิน</h4>
          <ol style="list-style:none;padding-left:0;color:#000;font-size:1em;">
            <li style="color:#000;font-weight:400;">1. ✅ มาตามนัด: จ่ายเพิ่มเพียง ${data.remainingAmount.toLocaleString()} บาท ที่สนาม</li>
            <li style="color:#000;font-weight:400;">2. ❌ ไม่มาตามที่จอง: โดนหักเก็บค่ามัดจำ ${data.depositAmount.toLocaleString()} บาท ทันที ไม่มีการคืนเงิน</li>
            <li style="color:#000;font-weight:400;">3. ⚠️ ค่ามัดจำจะคืนเฉพาะกรณียกเลิกการจองหรือถูกปฏิเสธเท่านั้น</li>
            <li style="color:#000;font-weight:400;">4. 📌 กรุณามาถึงก่อนเวลา 15 นาที</li>
          </ol>
        </div>                   
        <div class="payment-buttons">
          <button class="cancel-payment-btn" onclick="closePaymentModal()">❌ ยกเลิก</button>
          <button class="upload-slip-btn" id="confirmPaymentBtn" disabled onclick="submitPayment()">⬆️ อัพโหลดสลิป</button>
        </div>
        <div class="timer-warning" id="paymentTimer">⏰ กรุณาชำระภายใน 15 นาที</div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  generateQRCode(data);
  startPaymentTimer();
  setupDragDrop();
}
 
function generateQRCode(data) { console.log('✅ QR Code loaded for deposit:', data.depositAmount, 'บาท'); }
function handleQRError(img) {
  img.style.display = 'none';
  img.parentElement.innerHTML = `<div style="padding:20px;text-align:center;color:#ef4444;"><p style="font-size:1.2em;margin-bottom:10px;">⚠️ ไม่พบ QR Code</p><p style="font-size:0.9em;color:#6b7280;">กรุณาโอนเงินไปที่:<br><strong style="color:#1f2937;">เลขพร้อมเพย์: 1103100835163</strong><br><strong style="color:#1f2937;">ชื่อบัญชี: นาย พัสกร ราชชมภู</strong></p></div>`;
}
 
function handleSlipUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) { alert('❌ กรุณาอัพโหลดไฟล์ภาพเท่านั้น (JPG, PNG)'); event.target.value = ''; return; }
  if (file.size > MAX_FILE_SIZE_BYTES) { alert('❌ ไฟล์ใหญ่เกินไป! กรุณาเลือกไฟล์ขนาดไม่เกิน ' + MAX_FILE_SIZE_MB + ' MB'); event.target.value = ''; return; }
  uploadedSlipFile = file;
  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('slipPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('confirmPaymentBtn').disabled = false;
  };
  reader.readAsDataURL(file);
}
 
function setupDragDrop() {
  const uploadArea = document.getElementById('uploadArea');
  const handleDragOver = (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); };
  const handleDragLeave = () => uploadArea.classList.remove('dragover');
  const handleDrop = (e) => {
    e.preventDefault(); uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const input = document.getElementById('slipInput');
      const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
      handleSlipUpload({ target: input });
    }
  };
  uploadArea.addEventListener('dragover', handleDragOver, { passive: false });
  uploadArea.addEventListener('dragleave', handleDragLeave, { passive: true });
  uploadArea.addEventListener('drop', handleDrop, { passive: false });
  uploadArea._dragHandlers = { handleDragOver, handleDragLeave, handleDrop };
}
 
function startPaymentTimer() {
  let timeLeft = PAYMENT_TIMEOUT_MINUTES * 60;
  const timerDiv = document.getElementById('paymentTimer');
  paymentTimer = setInterval(() => {
    timeLeft--;
    const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
    timerDiv.textContent = `⏰ เหลือเวลา ${m}:${s.toString().padStart(2,'0')} นาที`;
    if (timeLeft <= 0) { clearInterval(paymentTimer); alert('❌ หมดเวลาชำระเงิน กรุณาทำการจองใหม่อีกครั้ง'); closePaymentModal(); }
  }, 1000);
}
 
function closePaymentModal() {
  clearInterval(paymentTimer);
  cleanupBookingLock();
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea && uploadArea._dragHandlers) {
    uploadArea.removeEventListener('dragover', uploadArea._dragHandlers.handleDragOver);
    uploadArea.removeEventListener('dragleave', uploadArea._dragHandlers.handleDragLeave);
    uploadArea.removeEventListener('drop', uploadArea._dragHandlers.handleDrop);
    delete uploadArea._dragHandlers;
  }
 
  const modal = document.getElementById('paymentModal');
  if (modal) modal.remove();
 
  currentBookingData = null;
  uploadedSlipFile = null;
 
  // safety: ensure global booking modal/lock overlay isn't left behind
  try {
    const overlay = document.getElementById('global-loading');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  } catch (e) {}
}
 
 
function cleanupBookingLock() {
  if (currentBookingData) {
    const uniqueKey = `${currentBookingData.field}_${currentBookingData.date}_${currentBookingData.time}`;
    database.ref('booking_locks/' + uniqueKey).remove();
  }
}
 
function submitPayment() {
  if (!uploadedSlipFile) { alert('❌ กรุณาอัพโหลดสลิปการโอนเงิน'); return; }
  const btn = document.getElementById('confirmPaymentBtn');
  btn.disabled = true;
  btn.innerHTML = '⏳ กำลังอัพโหลด... <span class="spinner"></span>';
  uploadSlipAndCreateBooking();
}
 
function uploadSlipAndCreateBooking() {
  const data = currentBookingData;
  const reader = new FileReader();
  reader.onload = function(e) {
    const slipBase64 = e.target.result;
    const bookingRef = database.ref('bookings').push();
    const uniqueKey = `${data.field}_${data.date}_${data.time}`;
    const bookingData = {
      userId: currentUser.uid,
      username: currentUser.fullname,
      fullname: currentUser.fullname,
      phone: currentUser.phone,
      field: data.field,
      date: data.date,
      time: data.time,
      totalPrice: data.totalPrice,
      depositAmount: data.depositAmount,
      remainingAmount: data.remainingAmount,
      depositStatus: 'pending',
      depositSlipUrl: slipBase64,
      depositPaidAt: new Date().toISOString(),
      remainingStatus: 'unpaid',
      remainingPaidAt: null,
      bookingStatus: 'pending_payment',
      checkedInAt: null,
      completedAt: null,
      depositRefunded: false,
      depositRefundedAt: null,
      depositForfeited: false,
      depositForfeitedAt: null,
      field_date_time: uniqueKey,
      createdAt: new Date().toISOString()
    };
    // FIX: เพิ่ม userId เข้าไปใน lock object ตอนสร้าง เพื่อให้ Firebase Rules
    // ที่เช็ค data.child('userId').val() === auth.uid ตอนลบ/แก้ lock ทำงานได้ถูกต้อง
    // (เดิมไม่มี userId เลย ทำให้ cleanupBookingLock()/beforeunload ลบ lock ตัวเองไม่ได้
    // ถ้าใช้คู่กับ rules ใหม่ที่ล็อกสิทธิ์ตาม owner)
    database.ref('booking_locks/' + uniqueKey).transaction((currentData) => {
      if (currentData === null) return { locked: true, timestamp: Date.now(), userId: currentUser.uid };
      else return undefined;
    }, (error, committed, snapshot) => {
      if (error) {
        alert('❌ ' + error.message);
        document.getElementById('confirmPaymentBtn').disabled = false;
        document.getElementById('confirmPaymentBtn').textContent = '⬆️ อัพโหลดสลิป';
      } else if (!committed) {
        alert('❌ ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกช่วงเวลาอื่น');
        closePaymentModal(); checkAvailability();
      } else {
        // FIX (privacy/High): เปลี่ยนจาก bookingRef.set(bookingData) เดี่ยว ๆ
        // เป็น multi-path update() เขียน bookings/{id} และ availability/{field}/{date}/{time}
        // พร้อมกันแบบ atomic (Firebase RTDB รับประกันว่า multi-path update()
        // เดียวจะสำเร็จหรือล้มเหลวพร้อมกันทั้งหมด) เพื่อให้ node availability ที่ใช้
        // แสดงผล "ว่าง/ไม่ว่าง" กับลูกค้าคนอื่นไม่มีข้อมูลส่วนตัวปนอยู่เลย
        const updates = {};
        updates['bookings/' + bookingRef.key] = bookingData;
        updates['availability/' + data.field + '/' + data.date + '/' + data.time] = true;
        updates['user_bookings/' + currentUser.uid + '/' + bookingRef.key] = true;
        database.ref().update(updates).then(() => {
          clearInterval(paymentTimer);
          const displayDate = formatDateThai(data.date);
          alert(`✅ อัพโหลดสลิปสำเร็จ!\n\n📋 เลขที่การจอง: #${bookingRef.key.substr(-6).toUpperCase()}\n\nระบบจะตรวจสอบการชำระเงินภายใน 5 นาที\n\n📍 สนาม: ${data.field}\n📅 วันที่: ${displayDate}\n⏰ เวลา: ${data.time}\n💰 มัดจำ: ${data.depositAmount.toLocaleString()} บาท ✅\n💸 ค่าบริการคงเหลือ: ${data.remainingAmount.toLocaleString()} บาท\n\n⚠️ ค่ามัดจำจะคืนเฉพาะกรณียกเลิกการจองหรือถูกปฏิเสธเท่านั้น`);
          closePaymentModal(); resetBookingForm();
          document.location.href = '#checkBookingSection';
          updateBookingList();
        }).catch((error) => {
          database.ref('booking_locks/' + uniqueKey).remove();
          alert('❌ ' + error.message);
          document.getElementById('confirmPaymentBtn').disabled = false;
          document.getElementById('confirmPaymentBtn').textContent = '⬆️ อัพโหลดสลิป';
        });
      }
    });
  };
  reader.readAsDataURL(uploadedSlipFile);
}
 
function updateBookingList() {
  const bookingListDiv = document.getElementById('bookingList');
  if (!bookingListDiv) return;
  const user = auth.currentUser;
  if (!user) {
    bookingListDiv.innerHTML = `<div style="text-align:center;padding:40px;"><p style="color:#6b7280;font-size:1.1em;margin-bottom:20px;">กรุณา Login เพื่อดูรายการจอง</p><button onclick="openLoginModal()" style="background:#22c55e;color:white;padding:12px 24px;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:1em;">🔐 เข้าสู่ระบบ</button></div>`;
    return;
  }
  bookingListDiv.innerHTML = '<p style="text-align:center;color:#666;">⏳ กำลังโหลดข้อมูล...</p>';
  // FIX (privacy/High): เดิมจุดนี้ query 'bookings' ทั้ง node ด้วย orderByChild('userId')
  // ตรง ๆ ซึ่ง Firebase Rules ไม่รองรับ "กรองสิทธิ์อ่านตามผลลัพธ์ query" ได้ — สิทธิ์อ่าน
  // ต้องอนุญาตทั้ง node 'bookings' แบบกว้าง ๆ ถึงจะ query ได้ ทำให้ข้อมูลส่วนตัวของ
  // ทุกคนรั่วไหลออกไปเหมือนปัญหาที่แก้ใน checkAvailability() เปลี่ยนมาใช้ดัชนี
  // 'user_bookings/{uid}' (เขียนคู่กันไปทุกครั้งที่สร้าง/ลบ booking) เก็บแค่ bookingId
  // ของตัวเอง แล้วค่อยไปอ่าน 'bookings/{id}' ทีละรายการ ซึ่งอนุญาตเฉพาะเจ้าของ/staff
  database.ref('user_bookings/' + user.uid).once('value').then((idsSnapshot) => {
    if (!idsSnapshot.exists()) {
      bookingListDiv.innerHTML = `<div style="text-align:center;padding:40px;"><p style="color:#6b7280;font-size:1.1em;">⚽ ยังไม่มีรายการจอง</p><p style="color:#9ca3af;margin-top:10px;">เริ่มจองสนามได้เลย!</p></div>`;
      return;
    }
    const ids = Object.keys(idsSnapshot.val());
    // FIX (permission_denied ทำทั้งหน้าพัง): เดิมใช้ Promise.all() อ่านทุก booking ตาม index
    // พร้อมกัน — ถ้ามี booking ใดถูกลบไปแล้วแต่ index ที่ user_bookings/{uid} ยังไม่ถูกลบตาม
    // (orphan reference จากฝั่ง staff-panel ที่ลบ/reject booking โดยไม่เคลียร์ index คู่กัน)
    // การอ่าน path ที่ไม่มีข้อมูลจะทำให้กฎ data.child('userId').val() === auth.uid กลายเป็น
    // null === uid (false) แล้ว Firebase คืน permission_denied แทนค่าว่าง ทำให้ Promise.all()
    // reject ทั้งก้อนและทั้งหน้าพัง เปลี่ยนมาให้แต่ละรายการจับ error ของตัวเอง ถ้าอ่านไม่ได้
    // ให้ถือว่าเป็น orphan แล้วลบ index ทิ้งเงียบ ๆ (ผู้ใช้มีสิทธิ์เขียน user_bookings/{ตัวเอง} อยู่แล้ว)
    return Promise.all(ids.map(id =>
      database.ref('bookings/' + id).once('value')
        .then(snap => ({ id, snap }))
        .catch(() => {
          database.ref('user_bookings/' + user.uid + '/' + id).remove().catch(() => {});
          return { id, snap: null };
        })
    )).then((results) => {
      const bookings = [];
      results.forEach(({ id, snap }) => {
        const booking = snap ? snap.val() : null;
        // booking อาจเป็น null ได้ถ้าถูกลบไปแล้ว (เช่น auto-delete หลัง completed 24 ชม.
        // หรือ orphan index ที่เพิ่งเคลียร์ไปด้านบน) — ข้ามรายการที่หายไปแบบเงียบ ๆ
        if (!booking) return;
        booking.id = id;
        if (booking.bookingStatus !== 'rejected') bookings.push(booking);
      });
      if (bookings.length === 0) { bookingListDiv.innerHTML = '<p style="text-align:center;color:#666;">ยังไม่มีรายการจอง</p>'; return; }
      bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      bookingListDiv.innerHTML = bookings.map(booking => generateBookingCard(booking)).join('');
      initializeBookingCardEvents();
    });
  }).catch((error) => {
    bookingListDiv.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444;"><p>❌ โหลดข้อมูลไม่สำเร็จ</p><p style="color:#6b7280;font-size:0.9em;">${error.message}</p><button onclick="updateBookingList()" style="margin-top:20px;background:#22c55e;color:white;padding:10px 20px;border:none;border-radius:8px;cursor:pointer;">🔄 ลองใหม่</button></div>`;
  });
}
 
function generateBookingCard(booking) {
  const safeBooking = {
    id: booking.id,
    field: SecurityUtils.escapeHtml(booking.field || 'ไม่ระบุสนาม'),
    date: booking.date,
    time: SecurityUtils.escapeHtml(booking.time || '-'),
    username: SecurityUtils.escapeHtml(booking.fullname || booking.username || ''),
    phone: SecurityUtils.sanitizePhone(booking.phone || ''),
    totalPrice: parseInt(booking.totalPrice) || 0,
    depositAmount: parseInt(booking.depositAmount) || 0,
    remainingAmount: parseInt(booking.remainingAmount) || 0,
    bookingStatus: booking.bookingStatus || 'pending',
    depositStatus: booking.depositStatus,
    remainingStatus: booking.remainingStatus,
    createdAt: booking.createdAt
  };
 
  let statusColor = '#f59e0b', statusText = 'รอตรวจสอบ', statusBg = '#fef3c7';
  if (safeBooking.bookingStatus === 'approved') { statusColor = '#10b981'; statusText = 'อนุมัติแล้ว ✅'; statusBg = '#d1fae5'; }
  else if (safeBooking.bookingStatus === 'remaining_payment_pending') { statusColor = '#f97316'; statusText = 'รอยืนยันการชำระ 💸'; statusBg = '#fff7ed'; }
  else if (safeBooking.bookingStatus === 'playing') { statusColor = '#7c3aed'; statusText = '⚽ กำลังใช้สนาม'; statusBg = '#f5f3ff'; }
  else if (safeBooking.bookingStatus === 'completed') { statusColor = '#6b7280'; statusText = 'เล่นเสร็จแล้ว ✔️'; statusBg = '#f3f4f6'; }
  else if (['pending_payment','pending'].includes(safeBooking.bookingStatus)) { statusColor = '#f59e0b'; statusText = 'รอตรวจสอบ ⏳'; statusBg = '#fef3c7'; }
  else if (safeBooking.bookingStatus === 'cancelled') { statusColor = '#6b7280'; statusText = 'ยกเลิกแล้ว'; statusBg = '#f3f4f6'; }
 
  const fmtDate = (ds) => {
    if (!ds) return '-';
    try {
      const d = new Date(ds);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2,'0');
      const month = String(d.getMonth()+1).padStart(2,'0');
      const year = d.getFullYear() + 543;
      return `${day}/${month}/${year}`;
    } catch(e) { return '-'; }
  };
 
  const fmtDateTime = (ds) => {
    if (!ds) return '-';
    try {
      const d = new Date(ds);
      if (isNaN(d.getTime())) return '-';
      return fmtDate(ds) + ' ' + d.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
    } catch(e) { return '-'; }
  };
 
  // ปุ่มต่อเวลา — เดิมแสดงทันทีเมื่อ bookingStatus เป็น 'approved' และเป็นวันนี้
  // โดยไม่สนเวลาเริ่มเล่นหรือสถานะจ่ายค่าคงเหลือเลย ทำให้กดต่อเวลาได้ตั้งแต่ยัง
  // ไม่ถึงเวลาเล่นและยังไม่จ่ายค่าคงเหลือ (ไม่สมเหตุสมผล เพราะยังไม่ได้ใช้สนามจริง)
  // ตอนนี้ต้องเข้าเงื่อนไขใดเงื่อนไขหนึ่งต่อไปนี้ก่อนถึงจะแสดงปุ่ม:
  //  1) จ่ายค่าสนามคงเหลือครบแล้ว (remainingStatus === 'paid', ปกติคู่กับ bookingStatus
  //     ที่เปลี่ยนเป็น 'playing' ผ่าน doConfirmRemaining() ในหน้า staff-panel) หรือ
  //  2) ถึงเวลาเริ่มเล่นตามที่จองไว้แล้วจริง ๆ (เทียบเวลาปัจจุบันกับเวลาเริ่มของ booking)
  // ยังคงจำกัดสถานะที่เกี่ยวข้องกับการเล่นอยู่จริงเท่านั้น (ตัด pending/completed/
  // cancelled/rejected ออกเหมือนเดิม) และยังคงเงื่อนไข "ต้องเป็นวันนี้เท่านั้น" ไว้
  let extensionButton = '';
  if (['approved', 'remaining_payment_pending', 'playing'].includes(safeBooking.bookingStatus)) {
    try {
      const bookingDateStr = safeBooking.date;
      const todayStr = new Date().toISOString().split('T')[0];
      if (bookingDateStr === todayStr) {
        const startTimeStr = (safeBooking.time || '').split(' - ')[0];
        let hasPlayStarted = false;
        if (startTimeStr && /^\d{2}:\d{2}$/.test(startTimeStr)) {
          const startDateTime = new Date(`${bookingDateStr}T${startTimeStr}:00`);
          hasPlayStarted = !isNaN(startDateTime.getTime()) && new Date() >= startDateTime;
        }
        const isRemainingPaid = booking.remainingStatus === 'paid';
        if (isRemainingPaid || hasPlayStarted) {
          const bookingDataStr = JSON.stringify(booking).replace(/"/g, '&quot;');
          extensionButton = `<button class="extend-booking-btn" data-booking-id="${safeBooking.id}" data-booking-data="${bookingDataStr}" id="extend-btn-${safeBooking.id}"><span>🔄</span><span>ต่อเวลา 1 ชั่วโมง</span></button><div class="next-slot-info" id="next-slot-${safeBooking.id}">กำลังตรวจสอบช่วงถัดไป...</div>`;
        }
      }
    } catch(e) {}
  }
 
  // ปุ่มจ่ายค่าคงเหลือ — แสดงเมื่อ "ถึงวันที่จองแล้ว" (วันนี้หรือผ่านมาแล้ว) และยังไม่จ่าย
  // ไม่ว่าจะอยู่สถานะ approved, playing, หรือ completed ก็ตาม
  // FIX รอบก่อน: เดิมล็อกไว้เฉพาะ bookingStatus === 'approved' + ต้องเป็นวันนี้ + เหลือ ≤30 นาที
  // ก่อนเริ่มเล่น พอสถานะเปลี่ยนเป็น 'completed' เงื่อนไขไม่จริงอีกต่อไป ปุ่มหายไปทันที
  // ทำให้ลูกค้าที่ยังไม่จ่ายค่าคงเหลือไม่มีทางจ่ายได้อีกเลย ตอนนั้นเลยตัดเงื่อนไขเรื่อง
  // วันที่ออกไปทั้งหมดด้วยความผิดพลาด ทำให้ปุ่มขึ้นแม้กับการจองที่ "ยังไม่ถึงวันเล่น"
  // (เช่น จองไว้ล่วงหน้าวันพรุ่งนี้) ซึ่งไม่ถูกต้อง — ตอนนี้เพิ่มเงื่อนไขวันที่กลับมา:
  // ต้องถึงวันที่จองแล้วเท่านั้น (isDateArrived) แต่ไม่จำกัดสถานะ/เวลาแบบเดิมอีก
  let payRemainingButton = '';
  let isDateArrived = false;
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    isDateArrived = !!safeBooking.date && safeBooking.date <= todayStr;
  } catch(e) {}
  if (isDateArrived
      && ['approved','playing','completed'].includes(safeBooking.bookingStatus)
      && safeBooking.remainingStatus !== 'paid'
      && safeBooking.remainingAmount > 0) {
    payRemainingButton = `
      <div style="background:#fff7ed;border:2px solid #f97316;border-radius:10px;padding:14px;margin-top:10px;">
        <p style="margin:0 0 8px;color:#c2410c;font-weight:700;font-size:14px;">💸 ยังไม่ได้ชำระค่าสนามคงเหลือ!</p>
        <p style="margin:0 0 10px;color:#374151;font-size:13px;">จ่ายเพิ่ม <strong style="color:#dc2626;">${safeBooking.remainingAmount.toLocaleString()} บาท</strong></p>
        <button onclick="openPayRemainingModal('${safeBooking.id}')"
          style="width:100%;padding:10px;background:#f97316;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px;">
          💳 ชำระค่าสนามคงเหลือ ${safeBooking.remainingAmount.toLocaleString()} บาท
        </button>
      </div>`;
  }
 
  // แบนเนอร์กำลังใช้สนาม
  let playingBanner = '';
  if (safeBooking.bookingStatus === 'playing') {
    playingBanner = `
      <div style="background:#f5f3ff;border:2px solid #7c3aed;border-radius:10px;padding:12px;margin-top:10px;text-align:center;">
        <p style="margin:0;color:#7c3aed;font-weight:700;font-size:15px;">⚽ กำลังใช้สนามอยู่</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">Staff จะอัปเดตสถานะเมื่อเล่นเสร็จ</p>
      </div>`;
  }
 
  // แบนเนอร์รอยืนยันการชำระ
  let waitingBanner = '';
  if (safeBooking.bookingStatus === 'remaining_payment_pending') {
    waitingBanner = `
      <div style="background:#fff7ed;border:2px solid #f97316;border-radius:10px;padding:12px;margin-top:10px;text-align:center;">
        <p style="margin:0;color:#f97316;font-weight:700;">⏳ รอ Staff ยืนยันการรับเงิน</p>
        <p style="margin:4px 0 0;color:#6b7280;font-size:12px;">กรุณารอสักครู่ หรือแจ้ง Staff โดยตรง</p>
      </div>`;
  }
 
  let cancelButton = '';
  if (['pending','pending_payment','approved'].includes(safeBooking.bookingStatus)) {
    cancelButton = `<button class="cancel-btn" id="cancel-btn-${safeBooking.id}" data-booking-id="${safeBooking.id}" style="background:#ef4444;color:white;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-top:10px;">❌ ยกเลิกการจอง</button>`;
  }
 
  // ========== ปุ่มแก้ไขการจอง (เปลี่ยนเวลา/เปลี่ยนสนาม) ==========
  // เงื่อนไข: ต้องเป็นสถานะที่ "ยังไม่เริ่มเล่น" (pending_payment / pending / approved)
  // และเวลาที่จองไว้ต้อง "ยังไม่ถึง" เท่านั้น (ป้องกันแก้ไขย้อนหลัง/หลังเริ่มเล่นไปแล้ว)
  // และต้องไม่มีการต่อเวลา (extendedTo) ผูกอยู่กับ booking นี้ เพราะช่วงต่อเวลาอ้างอิง
  // เวลาสิ้นสุดของ booking เดิมอยู่ ถ้าให้แก้ไขต่อจะทำให้ช่วงเวลาไม่ต่อเนื่องกัน
  let editButton = '';
  let bookingHasNotStarted = false;
  try {
    const startTimeStr = (safeBooking.time || '').split(' - ')[0];
    if (safeBooking.date && startTimeStr && /^\d{2}:\d{2}$/.test(startTimeStr)) {
      const startDateTime = new Date(`${safeBooking.date}T${startTimeStr}:00`);
      bookingHasNotStarted = !isNaN(startDateTime.getTime()) && new Date() < startDateTime;
    }
  } catch(e) {}
  const editableStatuses = ['pending_payment', 'pending', 'approved'];
  if (bookingHasNotStarted && editableStatuses.includes(safeBooking.bookingStatus) && !booking.extendedTo) {
    editButton = `<button class="edit-booking-btn" id="edit-btn-${safeBooking.id}" data-booking-id="${safeBooking.id}" style="background:#3b82f6;color:white;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-top:10px;margin-right:8px;">✏️ แก้ไขการจอง (เปลี่ยนเวลา/สนาม)</button>`;
  }
 
  return `
    <div class="booking-card" style="background:white;border-radius:12px;padding:20px;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.1);border-left:4px solid ${statusColor};">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <h3 style="margin:0;color:#1f2937;font-size:18px;">📋 ${safeBooking.field}</h3>
        <span style="background:${statusBg};color:${statusColor};padding:6px 12px;border-radius:20px;font-weight:600;font-size:14px;">${statusText}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:15px;">
        <div><p style="margin:0;color:#6b7280;font-size:13px;">📅 วันที่เล่น</p><p style="margin:5px 0 0 0;color:#1f2937;font-weight:600;">${fmtDate(safeBooking.date)}</p></div>
        <div><p style="margin:0;color:#6b7280;font-size:13px;">⏰ เวลา</p><p style="margin:5px 0 0 0;color:#1f2937;font-weight:600;">${safeBooking.time}</p></div>
        <div><p style="margin:0;color:#6b7280;font-size:13px;">💰 ราคารวม</p><p style="margin:5px 0 0 0;color:#1f2937;font-weight:600;">${safeBooking.totalPrice.toLocaleString()} บาท</p></div>
        <div><p style="margin:0;color:#6b7280;font-size:13px;">📱 เบอร์ติดต่อ</p><p style="margin:5px 0 0 0;color:#1f2937;font-weight:600;">${safeBooking.phone}</p></div>
      </div>
      <div style="background:#f9fafb;padding:12px;border-radius:8px;margin-bottom:15px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#6b7280;font-size:13px;">💵 ค่ามัดจำ 30%</span>
          <span style="font-weight:600;color:${['approved','remaining_payment_pending','playing','completed'].includes(safeBooking.bookingStatus)?'#10b981':'#f59e0b'}">${safeBooking.depositAmount.toLocaleString()} บาท ${['approved','remaining_payment_pending','playing','completed'].includes(safeBooking.bookingStatus)?'✅':'⏳'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#6b7280;font-size:13px;">💸 ค่าบริการคงเหลือจ่ายที่สนาม</span>
          <span style="font-weight:600;color:${safeBooking.remainingStatus==='paid'?'#10b981':'#ef4444'}">${safeBooking.remainingAmount.toLocaleString()} บาท${safeBooking.remainingStatus==='paid'?' ✅':''}</span>
        </div>
      </div>
      ${extensionButton}
      ${payRemainingButton}
      ${waitingBanner}
      ${playingBanner}
      ${editButton}
      ${cancelButton}
      <div style="margin-top:15px;padding-top:15px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">📋 จองเมื่อ: ${fmtDateTime(safeBooking.createdAt)}</p>
      </div>
    </div>`;
}
 
function initializeBookingCardEvents() {
  document.querySelectorAll('.extend-booking-btn').forEach(btn => {
    const bookingId = btn.getAttribute('data-booking-id');
    const bookingDataStr = btn.getAttribute('data-booking-data');
    if (bookingDataStr) {
      try {
        const booking = JSON.parse(bookingDataStr.replace(/&quot;/g, '"'));
        checkNextSlotForBooking(booking);
      } catch(e) {}
    }
    btn.addEventListener('click', function() {
      if (bookingId) requestBookingExtension(bookingId);
    });
  });
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const bookingId = this.getAttribute('data-booking-id');
      if (bookingId) cancelBooking(bookingId);
    });
  });
  document.querySelectorAll('.edit-booking-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const bookingId = this.getAttribute('data-booking-id');
      if (bookingId) openEditBookingModal(bookingId);
    });
  });
}
 
// ========== จ่ายค่าสนามคงเหลือ ==========
function openPayRemainingModal(bookingId) {
  const booking = null; // ดึงจาก Firebase
  database.ref('bookings/' + bookingId).once('value').then(snap => {
    const b = snap.val();
    if (!b) { showToast('❌ ไม่พบข้อมูลการจอง', 'error'); return; }
    const remaining = b.remainingAmount || 0;
    const modalHtml = `
      <div id="payRemainingModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div style="background:white;border-radius:16px;padding:24px;max-width:400px;width:100%;max-height:90vh;overflow-y:auto;">
          <h3 style="color:#c2410c;margin:0 0 16px;text-align:center;">💸 ชำระค่าสนามคงเหลือ</h3>
          <div style="background:#fff7ed;border-radius:10px;padding:12px;margin-bottom:14px;font-size:0.9em;line-height:1.8;">
            <div>📍 <strong>สนาม:</strong> ${b.field}</div>
            <div>⏰ <strong>เวลา:</strong> ${b.time}</div>
            <div>💰 <strong>ยอดที่ต้องชำระ:</strong> <span style="color:#dc2626;font-weight:700;font-size:1.1em;">${remaining.toLocaleString()} บาท</span></div>
          </div>
          <div style="background:#f9fafb;border-radius:10px;padding:12px;margin-bottom:14px;text-align:center;">
            <p style="margin:0 0 8px;font-weight:600;">📱 สแกน QR Code พร้อมเพย์</p>
            <img src="qr-promptpay.png" alt="QR Code" style="max-width:200px;width:100%;border-radius:8px;" onerror="this.parentElement.innerHTML='<p style=color:#ef4444>⚠️ กรุณาโอนที่เลขพร้อมเพย์: <strong>1103100835163</strong></p>'">
            <p style="margin:8px 0 0;font-size:13px;color:#374151;"><strong>ชื่อบัญชี:</strong> นาย พัสกร ราชชมภู</p>
            <p style="margin:4px 0 0;font-size:13px;color:#374151;"><strong>ยอด:</strong> ${remaining.toLocaleString()} บาท</p>
          </div>
          <div style="margin-bottom:14px;">
            <label style="display:block;margin-bottom:8px;font-weight:600;font-size:14px;">📤 แนบสลิปการโอนเงิน</label>
            <div onclick="document.getElementById('remainingSlipInput').click()"
              style="border:2px dashed #f97316;border-radius:10px;padding:20px;text-align:center;cursor:pointer;background:#fff7ed;">
              <p style="margin:0;color:#f97316;">📎 คลิกเพื่ออัพโหลดสลิป</p>
            </div>
            <input type="file" id="remainingSlipInput" accept="image/*" style="display:none;" onchange="previewRemainingSlip(event)">
            <img id="remainingSlipPreview" style="display:none;max-width:100%;border-radius:8px;margin-top:8px;">
          </div>
          <div style="display:flex;gap:10px;">
            <button onclick="document.getElementById('payRemainingModal').remove()"
              style="flex:1;padding:11px;border:2px solid #e5e7eb;background:white;border-radius:10px;cursor:pointer;font-family:inherit;">
              ยกเลิก
            </button>
            <button id="confirmRemainingBtn" onclick="submitRemainingPayment('${bookingId}',${remaining})" disabled
              style="flex:2;padding:11px;background:#f97316;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;">
              ✅ ยืนยันการชำระ
            </button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }).catch(err => showToast('❌ ' + err.message, 'error'));
}
 
function previewRemainingSlip(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/jpeg','image/jpg','image/png'].includes(file.type)) { alert('❌ กรุณาอัพโหลดไฟล์ภาพ JPG หรือ PNG'); return; }
  if (file.size > 5 * 1024 * 1024) { alert('❌ ไฟล์ใหญ่เกินไป (ไม่เกิน 5MB)'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('remainingSlipPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('confirmRemainingBtn').disabled = false;
  };
  reader.readAsDataURL(file);
}
 
function submitRemainingPayment(bookingId, remainingAmount) {
  const slipInput = document.getElementById('remainingSlipInput');
  const file = slipInput ? slipInput.files[0] : null;
  if (!file) { alert('❌ กรุณาแนบสลิปการโอนเงิน'); return; }
  const btn = document.getElementById('confirmRemainingBtn');
  btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...';
  const reader = new FileReader();
  reader.onload = e => {
    database.ref('bookings/' + bookingId).update({
      bookingStatus: 'remaining_payment_pending',
      remainingSlipUrl: e.target.result,
      remainingPaidAt: new Date().toISOString()
    }).then(() => {
      document.getElementById('payRemainingModal').remove();
      showToast('✅ ส่งสลิปแล้ว รอ Staff ยืนยัน', 'success', 4000);
      updateBookingList();
    }).catch(err => {
      btn.disabled = false; btn.textContent = '✅ ยืนยันการชำระ';
      showToast('❌ ' + err.message, 'error');
    });
  };
  reader.readAsDataURL(file);
}
 
function cancelBooking(bookingId) {
  if (isCancelling) return;
  if (!confirm("⚠️ ต้องการยกเลิกการจองนี้ใช่หรือไม่?\n\nข้อมูลการจองจะถูกลบออกจากระบบทันที")) return;
  isCancelling = true;
  const cancelBtn = document.getElementById(`cancel-btn-${bookingId}`);
  const originalButtonText = cancelBtn ? cancelBtn.textContent : '❌ ยกเลิก';
  if (cancelBtn) { cancelBtn.textContent = '⏳ กำลังยกเลิก...'; cancelBtn.disabled = true; }
  database.ref('bookings/' + bookingId).once('value').then((snapshot) => {
    const booking = snapshot.val();
    if (!booking) throw new Error('ไม่พบข้อมูลการจอง');
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) throw new Error('กรุณา Login ก่อนยกเลิกการจอง');
    if (booking.userId !== firebaseUser.uid) throw new Error('คุณไม่มีสิทธิ์ยกเลิกการจองนี้');
    const uniqueKey = `${booking.field}_${booking.date}_${booking.time}`;
    // FIX: บันทึก log การยกเลิกไว้ก่อนลบ booking ทิ้ง เพื่อให้หน้ารายงานฝั่ง staff
    // นับจำนวน "ยกเลิก" ได้ครบ รวมกรณีลูกค้ายกเลิกเอง (ไม่ใช่แค่ staff ปฏิเสธ/ยกเลิก)
    // node นี้เป็นแค่สถิติ ไม่มีผลด้านการเงินใด ๆ — เขียนได้ครั้งเดียว ห้ามแก้ไข/ลบทีหลัง
    // (ดูเงื่อนไขใน Firebase Rules ที่ cancellation_log)
    const logEntry = {
      bookingId,
      userId: firebaseUser.uid,
      field: booking.field || '',
      date: booking.date || '',
      time: booking.time || '',
      reason: 'ลูกค้ายกเลิกเอง',
      createdAt: new Date().toISOString()
    };
    return Promise.all([
      database.ref('cancellation_log').push(logEntry).catch(() => {}), // ไม่ให้การบันทึก log ล้มเหลวขวางการยกเลิกจริง
      // FIX (privacy/High): ลบ availability/{field}/{date}/{time} คู่กันไปด้วย
      // ไม่งั้นช่วงเวลานี้จะค้างเป็น "ไม่ว่าง" ตลอดไปทั้งที่ booking ถูกลบไปแล้ว
      database.ref('availability/' + booking.field + '/' + booking.date + '/' + booking.time).remove(),
      // FIX (privacy/High): ลบ index user_bookings ของตัวเองออกด้วย ไม่งั้น
      // updateBookingList() จะพยายามอ่าน booking ที่ไม่มีอยู่แล้วทุกครั้งที่โหลด
      database.ref('user_bookings/' + firebaseUser.uid + '/' + bookingId).remove(),
      database.ref('bookings/' + bookingId).remove(),
      database.ref('booking_locks/' + uniqueKey).remove()
    ]);
  }).then(() => {
    alert("✅ ยกเลิกการจองเรียบร้อยแล้ว");
    updateBookingList();
  }).catch((error) => {
    alert("❌ " + error.message);
  }).finally(() => {
    isCancelling = false;
    if (cancelBtn) { cancelBtn.textContent = originalButtonText; cancelBtn.disabled = false; }
  });
}
 
// ========== DOM READY ==========
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  startSlider();
  const sliderWrapper = document.querySelector('.slider-container');
  if (sliderWrapper) {
    let stX = 0, etX = 0;
    sliderWrapper.addEventListener('touchstart', e => { stX = e.changedTouches[0].screenX; }, { passive: true });
    sliderWrapper.addEventListener('touchend', e => { etX = e.changedTouches[0].screenX; const d = etX - stX; if (d < -50) changeSlide(1); if (d > 50) changeSlide(-1); }, { passive: true });
  }
  const staffModal = document.getElementById('staffGalleryModal');
  if (staffModal) {
    let tsY = 0;
    staffModal.addEventListener('touchstart', e => { tsY = e.changedTouches[0].screenY; }, { passive: true });
    staffModal.addEventListener('touchend', e => { if (e.changedTouches[0].screenY - tsY > 100) closeStaffModal(); }, { passive: true });
  }
  const loginModal = document.getElementById('loginModal');
  if (loginModal) loginModal.addEventListener('click', e => { if (e.target.id === 'loginModal') closeLoginModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (typeof closeLoginModal === 'function') closeLoginModal();
      const overlay = document.getElementById('menuOverlay');
      if (overlay && overlay.classList.contains('active')) closeMobileMenu();
      const extModal = document.getElementById('extensionModal');
      if (extModal && extModal.classList.contains('show')) closeExtensionModal();
      const editModal = document.getElementById('editBookingModal');
      if (editModal && editModal.classList.contains('show')) closeEditBookingModal();
    }
  });
  window.addEventListener("resize", debounce(() => {
    if (window.innerWidth > 768) {
      const overlay = document.getElementById("menuOverlay");
      const hamburger = document.getElementById("hamburgerBtn");
      if (overlay) overlay.classList.remove("active");
      if (hamburger) hamburger.classList.remove("active");
      document.body.style.overflow = "";
    }
  }, 150));
});
 
// ========== TOAST ==========
const ToastSystem = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
      if (!this.container) { this.container = document.createElement('div'); this.container.id = 'toast-container'; document.body.appendChild(this.container); }
    }
  },
  show(message, type = 'success', duration = 3000) {
    this.init();
    const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
    this.container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, duration);
    return toast;
  }
};
function showToast(message, type = 'success', duration = 3000) { return ToastSystem.show(message, type, duration); }
 
// ========== LOADING ==========
const LoadingSystem = {
  overlay: null, loadingText: null,
  init() {
    if (!this.overlay) {
      this.overlay = document.getElementById('global-loading');
      if (!this.overlay) { this.overlay = document.createElement('div'); this.overlay.id = 'global-loading'; this.overlay.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><p class="loading-text">กำลังโหลด...</p></div>'; document.body.appendChild(this.overlay); }
      this.loadingText = this.overlay.querySelector('.loading-text');
    }
  },
  show(message = 'กำลังโหลด...') { this.init(); if (this.loadingText) this.loadingText.textContent = message; this.overlay.classList.add('active'); document.body.style.overflow = 'hidden'; },
  hide() { if (this.overlay) { this.overlay.classList.remove('active'); document.body.style.overflow = ''; } }
};
function showLoading(message) { LoadingSystem.show(message); }
function hideLoading() { LoadingSystem.hide(); }
 
// ========== STAFF GALLERY + ACTIVITIES ==========
function loadStaffGallery() {
  const container = document.getElementById('staffGalleryContainer');
  if (!container) return;
  container.innerHTML = '<div class="content-loading-state">🔄 กำลังโหลดรูปภาพ...</div>';
  database.ref('gallery').get().then((snapshot) => {
    container.innerHTML = '';
    if (!snapshot.exists()) { container.innerHTML = '<div class="content-loading-state">📷 ยังไม่มีรูปภาพ</div>'; return; }
    const items = [];
    snapshot.forEach(child => { const val = child.val(); if (val && val.url) items.push({ id: child.key, ...val }); });
    items.sort((a, b) => (a.order != null ? Number(a.order) : 9999) - (b.order != null ? Number(b.order) : 9999));
    items.forEach(item => {
      const safeTitle = SecurityUtils.escapeHtml(item.title || 'ไม่มีชื่อ');
      const safeUrl = (item.url || '').replace(/[<>"'`]/g, '');
      const card = document.createElement('div');
      card.className = 'staff-gallery-card';
      card.setAttribute('data-image-url', safeUrl);
      card.addEventListener('click', function() { const url = this.getAttribute('data-image-url'); if (url) openStaffModal(url); });
      card.innerHTML = `<img src="${safeUrl}" alt="${safeTitle}" loading="lazy" onerror="this.src='placeholder.jpg'"><div class="staff-gallery-card-title">${safeTitle}</div>`;
      container.appendChild(card);
    });
    console.log('✅ gallery loaded:', items.length, 'items');
  }).catch(err => {
    console.error('❌ gallery error:', err);
    container.innerHTML = '<div class="content-loading-state">⚠️ โหลดรูปภาพไม่สำเร็จ</div>';
  });
}
 
function loadActivities() {
  const container = document.getElementById('activitiesContainer');
  if (!container) return;
  container.innerHTML = '<div class="content-loading-state">🔄 กำลังโหลดข่าวสาร...</div>';
  database.ref('activities').get().then((snapshot) => {
    container.innerHTML = '';
    if (!snapshot.exists()) { container.innerHTML = '<div class="content-loading-state">📝 ยังไม่มีข่าวสาร</div>'; return; }
    const items = [];
    snapshot.forEach(child => { const val = child.val(); if (val) items.push({ id: child.key, ...val }); });
    items.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    items.forEach(item => {
      const safeTitle = SecurityUtils.escapeHtml(item.title || 'ไม่มีหัวข้อ');
      const safeContent = SecurityUtils.escapeHtml(item.content || '');
      const card = document.createElement('div');
      card.className = 'activity-card';
      card.innerHTML = `<div class="activity-header"><div class="activity-title">${safeTitle}</div><div class="activity-date">${formatDate(item.createdAt)}</div></div><div class="activity-content">${safeContent}</div>`;
      container.appendChild(card);
    });
    console.log('✅ activities loaded:', items.length, 'items');
  }).catch(err => {
    console.error('❌ activities error:', err);
    container.innerHTML = '<div class="content-loading-state">⚠️ โหลดข่าวสารไม่สำเร็จ</div>';
  });
}
 
// formatDate สำหรับ activity (แสดงเวลาด้วย)
function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    const day   = String(d.getDate()).padStart(2,'0');
    const month = String(d.getMonth()+1).padStart(2,'0');
    const year  = d.getFullYear() + 543;
    const time  = d.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
    return `${day}/${month}/${year} ${time}`;
  } catch(e) { return '-'; }
}
 
// ========== FIREBASE INIT ==========
let firebaseInitRetryCount = 0;
const MAX_FIREBASE_RETRIES = 50;
 
function initializeFirebase() {
  firebaseInitRetryCount++;
  if (window.firebaseLoadError) { console.error('❌ Firebase scripts failed to load'); alert('⚠️ ไม่สามารถโหลด Firebase ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'); return; }
  if (typeof firebase === 'undefined') {
    if (firebaseInitRetryCount > MAX_FIREBASE_RETRIES) { alert('⚠️ ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตรวจสอบการเชื่อมต่อ'); return; }
    setTimeout(initializeFirebase, 100);
    return;
  }
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyB6jVc8qcyS9zIJvfi-E1BL7BaxrUorO7w",
      authDomain: "prijit-sport.firebaseapp.com",
      databaseURL: "https://prijit-sport-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "prijit-sport",
      storageBucket: "prijit-sport.firebasestorage.app",
      messagingSenderId: "19782245186",
      appId: "1:19782245186:web:8ff3e2e17a214edc3546db"
    };
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    database = firebase.database();
    console.log("✅ Firebase ready!");
    initializeTimeSlots();
    auth.onAuthStateChanged((user) => {
      if (user) {
        database.ref('users/' + user.uid).once('value').then((snapshot) => {
          // FIX (undefined phone/values in update): เดิมจุดนี้ spread ข้อมูล
          // ทั้งหมดจาก Firebase ตรง ๆ (currentUser = { uid, ...snapshot.val() })
          // ถ้า record ผู้ใช้ขาด field ใด (เช่น 'phone') ค่านั้นจะเป็น undefined
          // ทันที แล้วพอถูกนำไปใช้เขียนใน uploadSlipAndCreateBooking() ผ่าน
          // database.ref().update(...) Firebase RTDB จะปฏิเสธการเขียนทั้งก้อน
          // ทันที (ไม่รับ undefined) ทำให้อัพโหลดสลิปค้างไม่สำเร็จเงียบ ๆ
          // แก้โดย sanitize/กำหนดค่า default ให้ครบทุก field เหมือนที่ handleLogin() ทำ
          const userData = snapshot.val() || {};
          currentUser = {
            uid: user.uid,
            username: SecurityUtils.escapeHtml(userData.username || ''),
            fullname: SecurityUtils.escapeHtml(userData.fullname || ''),
            phone: SecurityUtils.sanitizePhone(userData.phone || ''),
            createdAt: userData.createdAt
          };
          document.getElementById("currentUser").textContent = currentUser.fullname;
          document.getElementById("loginNavBtn").style.display = "none";
          document.getElementById("userInfo").style.display = "flex";
          updateBookingList();
        }).catch(error => console.error("❌ Failed to load user:", error));
      } else {
        currentUser = null;
        document.getElementById("loginNavBtn").style.display = "inline-block";
        document.getElementById("userInfo").style.display = "none";
      }
    });
    const dateInput = document.getElementById('dateSelect');
    if (dateInput) dateInput.setAttribute('min', new Date().toISOString().split('T')[0]);
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        const modal = document.getElementById('staffGalleryModal');
        if (modal && modal.classList.contains('show')) closeStaffModal();
      }
    });
    const modalContent = document.querySelector('.staff-gallery-modal img');
    if (modalContent) modalContent.addEventListener('click', e => e.stopPropagation());
    const closeButton = document.querySelector('.staff-gallery-close');
    if (closeButton) closeButton.addEventListener('click', e => { e.stopPropagation(); closeStaffModal(); });
    loadStaffGallery();
    loadActivities();
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    alert('❌ เชื่อมต่อ Firebase ไม่สำเร็จ: ' + error.message);
  }
}
 
initializeFirebase();
 
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        if (registration.navigationPreload) registration.navigationPreload.disable().catch(() => {});
      });
    }).catch(() => {});
  });
}
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('service worker')) event.preventDefault();
});
 
// ========== EXTENSION SYSTEM ==========
let currentExtensionBooking = null;
let extensionCountdownInterval = null;
 
async function checkNextSlotForBooking(booking) {
  const parts = booking.time.split(' - ');
  if (parts.length < 2) return;
  const endTime = parts[1];
  const nextEndTime = addOneHourToTime(endTime);
  if (nextEndTime === null) {
    const info = document.getElementById(`next-slot-${booking.id}`);
    const btn = document.getElementById(`extend-btn-${booking.id}`);
    if (info) info.innerHTML = '<span style="color:#f59e0b;">⏰ ไม่สามารถต่อเวลาได้ (เกินเวลาทำการ)</span>';
    if (btn) btn.style.display = 'none';
    return;
  }
  try {
    // FIX (privacy/High): เดิม query 'bookings' โดย field_date_time ตรง ๆ
    // ซึ่งจะพังทันทีถ้าเป็น booking ของคนอื่น หลังจากจำกัดสิทธิ์อ่าน 'bookings'
    // ให้เหลือแค่เจ้าของ/staff แล้ว — เปลี่ยนมาเช็คจาก 'availability' แทน
    const nextTimeSlot = `${endTime} - ${nextEndTime}`;
    const snapshot = await availabilityRef(booking.field, booking.date, nextTimeSlot).once('value');
    const info = document.getElementById(`next-slot-${booking.id}`);
    if (!info) return;
    if (snapshot.exists()) {
      info.innerHTML = `<span style="color:#ef4444;">❌ ช่วงถัดไป ${endTime} - ${nextEndTime} ถูกจองแล้ว</span>`;
      const btn = document.getElementById(`extend-btn-${booking.id}`);
      if (btn) btn.disabled = true;
    } else {
      info.innerHTML = `<span style="color:#22c55e;">✓ ช่วงถัดไป ${endTime} - ${nextEndTime} ว่าง</span>`;
    }
  } catch(error) { console.error('Error checking next slot:', error); }
}
 
async function requestBookingExtension(bookingId) {
  try {
    const snapshot = await database.ref(`bookings/${bookingId}`).once('value');
    const booking = snapshot.val();
    if (!booking) { showToast('❌ ไม่พบข้อมูลการจอง', 'error'); return; }
    currentExtensionBooking = { ...booking, id: bookingId };
    const endTime = booking.time.split(' - ')[1];
    const nextEndTime = addOneHourToTime(endTime);
    if (nextEndTime === null) { showToast('⏰ ไม่สามารถต่อเวลาได้ เนื่องจากเกินเวลาทำการสนาม (07:00-20:00)', 'error'); return; }
    // FIX (privacy/High): เปลี่ยนจาก query 'bookings' ของคนอื่นตรง ๆ (จะถูก
    // Firebase Rules ปฏิเสธหลังจำกัดสิทธิ์อ่านแล้ว) มาเช็คจาก 'availability' แทน
    const nextTimeSlot = `${endTime} - ${nextEndTime}`;
    const nextSlotSnapshot = await availabilityRef(booking.field, booking.date, nextTimeSlot).once('value');
    const modal = document.getElementById('extensionModal');
    modal.classList.add('show');
    if (!nextSlotSnapshot.exists()) {
      document.getElementById('availableExtensionSlot').style.display = 'block';
      document.getElementById('bookedExtensionSlot').style.display = 'none';
      document.getElementById('extensionSlotTime').textContent = `${endTime} - ${nextEndTime}`;
      document.getElementById('extensionSlotPrice').textContent = calculateFieldPrice(booking.field, parseInt(endTime.split(':')[0]));
      startExtensionCountdown(300);
    } else {
      document.getElementById('availableExtensionSlot').style.display = 'none';
      document.getElementById('bookedExtensionSlot').style.display = 'block';
      document.getElementById('bookedExtensionSlotTime').textContent = `${endTime} - ${nextEndTime}`;
      await findAlternativeSlots(booking);
    }
  } catch(error) { showToast('❌ ' + error.message, 'error'); }
}
 
function startExtensionCountdown(seconds) {
  let remaining = seconds;
  const countdownDisplay = document.getElementById('extensionCountdown');
  const confirmBtn = document.getElementById('confirmExtensionBtn');
  if (extensionCountdownInterval) clearInterval(extensionCountdownInterval);
  extensionCountdownInterval = setInterval(() => {
    remaining--;
    const m = Math.floor(remaining/60), s = remaining % 60;
    countdownDisplay.textContent = `${m}:${s.toString().padStart(2,'0')}`;
    if (remaining <= 60) countdownDisplay.style.color = '#dc2626';
    if (remaining <= 0) { clearInterval(extensionCountdownInterval); confirmBtn.disabled = true; showToast('⏰ หมดเวลายืนยัน กรุณาลองใหม่อีกครั้ง', 'error'); setTimeout(() => closeExtensionModal(), 2000); }
  }, 1000);
}
 
async function confirmExtensionPayment() {
  if (!currentExtensionBooking) return;
  const confirmBtn = document.getElementById('confirmExtensionBtn');
  confirmBtn.textContent = 'กำลังดำเนินการ...'; confirmBtn.disabled = true;
  try {
    const booking = currentExtensionBooking;
    const endTime = booking.time.split(' - ')[1];
    const nextEndTime = addOneHourToTime(endTime);
    if (nextEndTime === null) { showToast('⏰ ไม่สามารถต่อเวลาได้ เนื่องจากเกินเวลาทำการสนาม (07:00-20:00)', 'error'); confirmBtn.textContent = 'ยืนยันชำระเงิน'; confirmBtn.disabled = false; return; }
    const timeSlot = `${endTime} - ${nextEndTime}`;
    const price = calculateFieldPrice(booking.field, parseInt(endTime.split(':')[0]));
    const uniqueKey = `${booking.field}_${booking.date}_${timeSlot}`;
 
    // FIX (race condition): เดิมจุดนี้เช็คว่าง (.once('value')) ตอนเปิด modal แล้วรอ
    // นับถอยหลังสูงสุด 5 นาทีก่อนค่อยเขียนจริงตรงนี้ โดยไม่มีการล็อกใด ๆ คั่นระหว่างทาง
    // ถ้ามี 2 คนกดต่อเวลาช่วงเวลาเดียวกันในหน้าต่างเวลานั้น ทั้งคู่จะผ่านและ
    // เขียน booking ซ้ำกันได้ ใช้ transaction แบบเดียวกับ uploadSlipAndCreateBooking()
    // เป็นตัวตัดสินแบบ atomic ก่อนค่อยสร้าง booking จริง
    const lockResult = await database.ref('booking_locks/' + uniqueKey).transaction((currentData) => {
      if (currentData === null) return { locked: true, timestamp: Date.now(), userId: booking.userId };
      else return undefined;
    });
    if (!lockResult.committed) {
      showToast('❌ ช่วงเวลานี้ถูกจองไปแล้ว กรุณาลองใหม่อีกครั้ง', 'error');
      confirmBtn.textContent = 'ยืนยันชำระเงิน'; confirmBtn.disabled = false;
      closeExtensionModal();
      return;
    }
 
    try {
      const newBookingRef = database.ref('bookings').push();
      const bookingData = {
        userId: booking.userId, username: booking.username, fullname: booking.fullname || booking.username,
        phone: booking.phone, field: booking.field, date: booking.date, time: timeSlot,
        totalPrice: price, depositAmount: 0, remainingAmount: price,
        depositStatus: 'not_required', remainingStatus: 'unpaid', bookingStatus: 'approved',
        extendedFrom: booking.id, field_date_time: uniqueKey, createdAt: new Date().toISOString()
      };
      // FIX (privacy/High): เขียน bookings/{id}, availability/{field}/{date}/{time},
      // และ extendedTo ของ booking เดิม พร้อมกันในครั้งเดียวแบบ atomic ผ่าน update()
      const updates = {};
      updates['bookings/' + newBookingRef.key] = bookingData;
      updates['bookings/' + booking.id + '/extendedTo'] = newBookingRef.key;
      updates['availability/' + booking.field + '/' + booking.date + '/' + timeSlot] = true;
      updates['user_bookings/' + booking.userId + '/' + newBookingRef.key] = true;
      await database.ref().update(updates);
      // หมายเหตุ: จงใจไม่ลบ lock ทิ้งหลังสร้างสำเร็จ — ให้ lock คงอยู่ตราบเท่าที่
      // booking ยังครองช่วงเวลานี้อยู่ (รูปแบบเดียวกับตอนจองปกติ) จะถูกลบก็ต่อเมื่อ
      // มีการยกเลิก booking นี้ภายหลังผ่าน cancelBooking()
      showToast('✅ ต่อเวลาสำเร็จ! ขอบคุณที่ใช้บริการ', 'success');
      closeExtensionModal(); updateBookingList();
    } catch (innerError) {
      // สร้าง booking ไม่สำเร็จ ต้องปลด lock คืนไม่งั้นช่วงเวลานี้จะค้างเป็น "ไม่ว่าง" ตลอดไป
      await database.ref('booking_locks/' + uniqueKey).remove().catch(() => {});
      throw innerError;
    }
  } catch(error) { showToast('❌ ' + error.message, 'error'); confirmBtn.textContent = 'ยืนยันชำระเงิน'; confirmBtn.disabled = false; }
}
 
async function findAlternativeSlots(booking) {
  const container = document.getElementById('alternativeSlotsList');
  container.innerHTML = '<div class="alternative-title">💡 ช่วงเวลาอื่นที่ว่าง</div>';
  try {
    const endTime = booking.time.split(' - ')[1];
    const allSlots = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
    const currentIndex = allSlots.indexOf(endTime);
    const startIndex = currentIndex !== -1 ? currentIndex : allSlots.findIndex(t => parseInt(t.split(':')[0]) === parseInt(endTime.split(':')[0]));
    const alternativesFound = [];
    for (let i = startIndex + 1; i < allSlots.length && alternativesFound.length < 5; i++) {
      const start = allSlots[i];
      const end = addOneHourToTime(start);
      if (end === null) continue;
      const timeSlot = `${start} - ${end}`;
      // FIX (privacy/High): เช็คจาก 'availability' แทน 'bookings' ของคนอื่น
      const snapshot = await availabilityRef(booking.field, booking.date, timeSlot).once('value');
      if (!snapshot.exists()) {
        const price = calculateFieldPrice(booking.field, parseInt(start.split(':')[0]));
        const slotDiv = document.createElement('div');
        slotDiv.className = 'alternative-slot';
        slotDiv.innerHTML = `<span class="alternative-slot-time">${timeSlot}</span><span class="alternative-slot-price">${price} บาท</span>`;
        slotDiv.onclick = () => selectAlternativeSlot(timeSlot, price);
        container.appendChild(slotDiv);
        alternativesFound.push(timeSlot);
      }
    }
    if (alternativesFound.length === 0) container.innerHTML += '<p style="text-align:center;color:#6b7280;padding:20px;">ไม่มีช่วงเวลาอื่นที่ว่าง</p>';
  } catch(error) { console.error('Error finding alternatives:', error); }
}
 
function selectAlternativeSlot(timeSlot, price) {
  if (confirm(`ต้องการจอง ${timeSlot} ในราคา ${price} บาทหรือไม่?`)) createAlternativeBooking(timeSlot, price);
}
 
async function createAlternativeBooking(timeSlot, price) {
  if (!currentExtensionBooking) { showToast('❌ ไม่พบข้อมูลการจอง', 'error'); return; }
  const booking = currentExtensionBooking;
  const uniqueKey = `${booking.field}_${booking.date}_${timeSlot}`;
  showLoading('กำลังตรวจสอบความว่าง...');
  try {
    // FIX (privacy/High): เช็คเบื้องต้นจาก 'availability' แทน 'bookings' ของคนอื่น
    // (จะถูก Firebase Rules ปฏิเสธหลังจำกัดสิทธิ์อ่านแล้ว) — ตัวตัดสินจริงคือ transaction ด้านล่าง
    const availabilityCheck = await availabilityRef(booking.field, booking.date, timeSlot).once('value');
    if (availabilityCheck.exists()) { hideLoading(); showToast('❌ ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกช่วงเวลาอื่น', 'error'); return; }
    showLoading('กำลังสร้างการจอง...');
 
    // FIX (race condition): เดิมจุดนี้ใช้ lockRef.set() ตรง ๆ ซึ่งไม่ atomic —
    // ถ้ามี 2 คนเลือกช่วงเวลาเดียวกันพร้อมกัน ต่างฝ่ายต่าง .set() ทับกันได้ทั้งคู่
    // "สำเร็จ" แล้วเขียน booking ซ้ำกัน เปลี่ยนมาใช้ .transaction() ที่คืนค่า
    // undefined เมื่อมีข้อมูลอยู่แล้ว เพื่อให้มีผู้ชนะแค่คนเดียวจริง ๆ
    const lockRef = database.ref('booking_locks/' + uniqueKey);
    const lockResult = await lockRef.transaction((currentData) => {
      if (currentData === null) return { locked: true, timestamp: Date.now(), userId: booking.userId };
      else return undefined;
    });
    if (!lockResult.committed) {
      hideLoading();
      showToast('❌ ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกช่วงเวลาอื่น', 'error');
      return;
    }
 
    try {
      const newBookingRef = database.ref('bookings').push();
      const bookingData = {
        userId: booking.userId, username: booking.username, fullname: booking.fullname || booking.username,
        phone: booking.phone, field: booking.field, date: booking.date, time: timeSlot,
        totalPrice: price, depositAmount: 0, remainingAmount: price,
        depositStatus: 'not_required', remainingStatus: 'unpaid', bookingStatus: 'approved',
        field_date_time: uniqueKey, createdAt: new Date().toISOString(), alternativeBooking: true
      };
      // FIX (privacy/High): เขียน booking ใหม่กับ availability mirror พร้อมกันแบบ atomic
      const updates = {};
      updates['bookings/' + newBookingRef.key] = bookingData;
      updates['availability/' + booking.field + '/' + booking.date + '/' + timeSlot] = true;
      updates['user_bookings/' + booking.userId + '/' + newBookingRef.key] = true;
      await database.ref().update(updates);
      // หมายเหตุ: จงใจไม่ลบ lock ทิ้งหลังสร้างสำเร็จ ด้วยเหตุผลเดียวกับ confirmExtensionPayment()
      hideLoading();
      showToast('✅ จองช่วงเวลาใหม่สำเร็จ! กรุณาชำระเงิน', 'success');
      closeExtensionModal(); updateBookingList();
      setTimeout(() => { const section = document.getElementById('checkBookingSection'); if (section) section.scrollIntoView({ behavior:'smooth', block:'start' }); }, 500);
    } catch (innerError) {
      await lockRef.remove().catch(() => {});
      throw innerError;
    }
  } catch(error) { hideLoading(); showToast('❌ ' + error.message, 'error'); }
}
 
function closeExtensionModal() {
  const modal = document.getElementById('extensionModal');
  modal.classList.remove('show');
  if (extensionCountdownInterval) clearInterval(extensionCountdownInterval);
  const confirmBtn = document.getElementById('confirmExtensionBtn');
  confirmBtn.textContent = 'ยืนยันชำระเงิน'; confirmBtn.disabled = false;
  currentExtensionBooking = null;
}
 
function addOneHourToTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const newHours = hours + 1;
  if (newHours > 20) return null;
  return `${newHours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}`;
}
 
function calculateFieldPrice(field, hour) {
  if (field.includes('สนาม 1') || field.includes('สนาม 2') || field.includes('สนาม 3')) return hour >= 18 ? 1200 : 1000;
  if (field.includes('สนาม 4')) return hour >= 18 ? 1300 : 1100;
  if (field.includes('สนาม 5')) return hour >= 18 ? 1100 : 900;
  if (field.includes('สนาม 6')) return hour >= 18 ? 900 : 700;
  return 0;
}
 
window.addEventListener('beforeunload', () => {
  if (database) { database.ref('bookings').off(); database.ref('users').off(); }
  if (typeof paymentTimer !== 'undefined' && paymentTimer) clearInterval(paymentTimer);
  if (typeof extensionCountdownInterval !== 'undefined' && extensionCountdownInterval) clearInterval(extensionCountdownInterval);
  if (typeof currentBookingData !== 'undefined' && currentBookingData) {
    const uniqueKey = `${currentBookingData.field}_${currentBookingData.date}_${currentBookingData.time}`;
    database.ref('booking_locks/' + uniqueKey).remove().catch(() => {});
  }
});
 
// ========================================================================
// ========== EDIT BOOKING SYSTEM - ระบบแก้ไขการจอง (เปลี่ยนเวลา/เปลี่ยนสนาม) ==========
// ========================================================================
// แนวคิด: ลูกค้าที่จ่ายมัดจำไปแล้วแต่ยังไม่ถึงเวลาเล่นตามที่จอง สามารถแก้ไขการจอง
// เพื่อเปลี่ยนสนามและ/หรือเวลาไปเป็นช่วงอื่นที่ว่างได้ โดยไม่ต้องจ่ายมัดจำซ้ำ
// (มัดจำเดิมที่จ่ายไปแล้วยังใช้ยืนยันการจองใหม่ได้เลย) เงื่อนไขการแก้ไข:
//   1) booking ต้องยังไม่เริ่มเล่น (เวลาที่จองไว้ต้องยังไม่ถึง)
//   2) bookingStatus ต้องเป็น pending_payment / pending / approved เท่านั้น
//   3) booking ต้องไม่มีการต่อเวลา (extendedTo) ผูกอยู่ (ดูเหตุผลใน generateBookingCard)
// เมื่อยืนยันแก้ไข ระบบจะย้าย availability ของช่วงเวลาเดิมออก มาจองช่วงเวลาใหม่แทน
// พร้อมคำนวณราคา/ยอดคงเหลือใหม่ตามสนาม/เวลาที่เลือก (ค่ามัดจำที่จ่ายไปแล้วคงเดิม
// เพราะไม่มีการคืน/เก็บเพิ่มออนไลน์ ส่วนต่างราคาถ้ามีจะไปรวมอยู่ในยอดคงเหลือที่จ่ายหน้าสนาม)
 
let currentEditBooking = null; // { id, field, date, time, totalPrice, depositAmount, remainingAmount, ... }
let editSelectedField = null;
let editSelectedDate = null;
let editSelectedTimeSlot = null;
let currentEditAvailabilityCheck = null;
 
async function openEditBookingModal(bookingId) {
  try {
    const snapshot = await database.ref('bookings/' + bookingId).once('value');
    const booking = snapshot.val();
    if (!booking) { showToast('❌ ไม่พบข้อมูลการจอง', 'error'); return; }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || booking.userId !== firebaseUser.uid) { showToast('❌ คุณไม่มีสิทธิ์แก้ไขการจองนี้', 'error'); return; }
 
    // ตรวจซ้ำฝั่ง client ว่ายังแก้ไขได้จริง (กันกรณีเปิดค้างไว้นาน/สถานะเปลี่ยนไปแล้ว)
    const editableStatuses = ['pending_payment', 'pending', 'approved'];
    if (!editableStatuses.includes(booking.bookingStatus)) {
      showToast('❌ ไม่สามารถแก้ไขการจองในสถานะปัจจุบันได้', 'error');
      return;
    }
    if (booking.extendedTo) {
      showToast('❌ การจองนี้มีการต่อเวลาแล้ว ไม่สามารถแก้ไขได้ กรุณาติดต่อเจ้าหน้าที่', 'error');
      return;
    }
    const startTimeStr = (booking.time || '').split(' - ')[0];
    const startDateTime = new Date(`${booking.date}T${startTimeStr}:00`);
    if (isNaN(startDateTime.getTime()) || new Date() >= startDateTime) {
      showToast('❌ ถึงเวลาเล่นแล้ว ไม่สามารถแก้ไขการจองนี้ได้', 'error');
      return;
    }
 
    currentEditBooking = { ...booking, id: bookingId };
    editSelectedField = null;
    editSelectedDate = null;
    editSelectedTimeSlot = null;
 
    const infoDiv = document.getElementById('editBookingCurrentInfo');
    infoDiv.innerHTML = `
      <div style="font-weight:700;color:#111827;margin-bottom:6px;">📋 การจองปัจจุบัน</div>
      <div>📍 สนาม: ${SecurityUtils.escapeHtml(booking.field)}</div>
      <div>📅 วันที่: ${formatDateThai(booking.date)}</div>
      <div>⏰ เวลา: ${SecurityUtils.escapeHtml(booking.time)}</div>
      <div>💵 มัดจำที่จ่ายแล้ว: <strong style="color:#10b981;">${(booking.depositAmount||0).toLocaleString()} บาท</strong> (ใช้ต่อได้เลย ไม่ต้องจ่ายซ้ำ)</div>`;
 
    const fieldSelect = document.getElementById('editFieldSelect');
    const dateSelect = document.getElementById('editDateSelect');
    fieldSelect.value = booking.field || '';
    dateSelect.value = booking.date || '';
    dateSelect.setAttribute('min', new Date().toISOString().split('T')[0]);
    const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + MAX_BOOKING_DAYS);
    dateSelect.setAttribute('max', maxDate.toISOString().split('T')[0]);
 
    document.getElementById('editBookingPreview').style.display = 'none';
    const confirmBtn = document.getElementById('confirmEditBookingBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '✅ ยืนยันการแก้ไข';
 
    resetEditTimeSlots();
    initializeEditTimeSlots();
 
    document.getElementById('editBookingModal').classList.add('show');
    document.body.style.overflow = 'hidden';
 
    // โหลดสถานะความว่างของ สนาม+วันที่เดิมทันที เพื่อให้เห็นตัวเลือกอื่นในวันเดียวกัน
    checkEditAvailability();
  } catch (error) {
    showToast('❌ ' + error.message, 'error');
  }
}
 
function closeEditBookingModal() {
  const modal = document.getElementById('editBookingModal');
  if (modal) modal.classList.remove('show');
  document.body.style.overflow = '';
  if (currentEditAvailabilityCheck) currentEditAvailabilityCheck = null;
  currentEditBooking = null;
  editSelectedField = null;
  editSelectedDate = null;
  editSelectedTimeSlot = null;
}
 
function initializeEditTimeSlots() {
  const timeSlots = document.querySelectorAll('#editTimeSlotsContainer .time-slot-btn');
  timeSlots.forEach(btn => {
    // เอา listener เก่าออกก่อน (เผื่อเปิด modal ซ้ำหลายรอบ) ด้วยการ clone node
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
  });
  document.querySelectorAll('#editTimeSlotsContainer .time-slot-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.classList.contains('booked') || this.disabled) return;
      document.querySelectorAll('#editTimeSlotsContainer .time-slot-btn').forEach(s => s.classList.remove('selected'));
      this.classList.add('selected');
      editSelectedTimeSlot = this.getAttribute('data-time');
      updateEditBookingPreview();
    });
  });
}
 
function resetEditTimeSlots() {
  document.querySelectorAll('#editTimeSlotsContainer .time-slot-btn').forEach(btn => {
    btn.classList.remove('available', 'booked', 'selected', 'past-time');
    btn.disabled = false;
    btn.style.opacity = '1';
    const badge = btn.querySelector('.status-badge');
    if (badge) badge.remove();
  });
}
 
function checkEditAvailability() {
  if (!currentEditBooking) return;
  const field = document.getElementById('editFieldSelect').value;
  const date = document.getElementById('editDateSelect').value;
  editSelectedField = field || null;
  editSelectedDate = date || null;
  editSelectedTimeSlot = null;
  document.getElementById('editBookingPreview').style.display = 'none';
  document.getElementById('confirmEditBookingBtn').disabled = true;
 
  if (!field || !date) { resetEditTimeSlots(); return; }
 
  const statusDiv = document.getElementById('editAvailabilityStatus');
  statusDiv.style.display = 'block';
  statusDiv.className = 'availability-notice checking';
  statusDiv.innerHTML = '<strong>⏳ กำลังตรวจสอบสถานะสนาม...</strong>';
 
  const requestToken = Symbol('editAvailability');
  currentEditAvailabilityCheck = requestToken;
 
  database.ref('availability/' + field + '/' + date).once('value')
    .then((snapshot) => {
      if (currentEditAvailabilityCheck !== requestToken) return; // มีการเปลี่ยนสนาม/วันที่ระหว่างรอ ยกเลิกผลเก่า
      const bookedTimes = snapshot.exists() ? Object.keys(snapshot.val()) : [];
      // ถ้าสนาม+วันที่ที่เลือกตรงกับของเดิม ให้ตัดเวลาเดิมออกจากลิสต์ "ไม่ว่าง"
      // เพราะช่วงเวลานั้นคือของ booking นี้เอง เลือกซ้ำได้ (เท่ากับไม่ได้เปลี่ยนอะไร)
      let effectiveBooked = bookedTimes;
      if (currentEditBooking && field === currentEditBooking.field && date === currentEditBooking.date) {
        effectiveBooked = bookedTimes.filter(t => t !== currentEditBooking.time);
      }
      updateEditTimeSlotAvailability(effectiveBooked, date);
      statusDiv.style.display = 'none';
    })
    .catch((error) => {
      if (currentEditAvailabilityCheck !== requestToken) return;
      statusDiv.className = 'availability-notice';
      statusDiv.innerHTML = '<strong style="color:#ef4444;">⚠️ ตรวจสอบสถานะสนามไม่สำเร็จ กรุณาลองใหม่</strong>';
    });
}
 
function updateEditTimeSlotAvailability(bookedTimes, dateStr) {
  const timeSlots = document.querySelectorAll('#editTimeSlotsContainer .time-slot-btn');
  const bookedTimesSet = new Set(bookedTimes);
  const today = new Date(); today.setHours(0,0,0,0);
  const selectedDateObj = new Date(dateStr + 'T00:00:00');
  const isPastDate = selectedDateObj < today;
  const isToday = selectedDateObj.getTime() === today.getTime();
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
 
  timeSlots.forEach(btn => {
    const time = btn.getAttribute('data-time');
    btn.classList.remove('available', 'booked', 'selected', 'past-time');
    const existingBadge = btn.querySelector('.status-badge');
    if (existingBadge) existingBadge.remove();
    btn.style.opacity = '1';
    let shouldDisable = false, badgeText = 'ว่าง', statusClass = 'available';
 
    if (isPastDate) {
      shouldDisable = true; badgeText = 'ผ่านแล้ว'; statusClass = 'booked past-time'; btn.style.opacity = '0.5';
    } else if (isToday) {
      const [startHour, startMinute] = time.split(' - ')[0].split(':').map(Number);
      const isPastTime = startHour < currentHour || (startHour === currentHour && startMinute <= currentMinute);
      if (isPastTime) { shouldDisable = true; badgeText = 'ผ่านแล้ว'; statusClass = 'booked past-time'; btn.style.opacity = '0.5'; }
      else if (bookedTimesSet.has(time)) { shouldDisable = true; badgeText = 'ไม่ว่าง'; statusClass = 'booked'; }
    } else {
      if (bookedTimesSet.has(time)) { shouldDisable = true; badgeText = 'ไม่ว่าง'; statusClass = 'booked'; }
    }
    btn.classList.add(...statusClass.split(' '));
    btn.disabled = shouldDisable;
    const badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.textContent = badgeText;
    btn.appendChild(badge);
  });
}
 
function updateEditBookingPreview() {
  if (!currentEditBooking || !editSelectedField || !editSelectedDate || !editSelectedTimeSlot) return;
  const newTotalPrice = calculateFieldPrice(editSelectedField, parseInt(editSelectedTimeSlot.split(':')[0]));
  const depositAmount = currentEditBooking.depositAmount || 0; // มัดจำเดิมคงเดิมเสมอ ไม่จ่ายซ้ำ/ไม่คืนอัตโนมัติ
  const newRemainingAmount = Math.max(newTotalPrice - depositAmount, 0);
  const isSameSlot = editSelectedField === currentEditBooking.field
    && editSelectedDate === currentEditBooking.date
    && editSelectedTimeSlot === currentEditBooking.time;
 
  const preview = document.getElementById('editBookingPreview');
  preview.style.display = 'block';
  let priceDiffNote = '';
  if (newTotalPrice > (currentEditBooking.totalPrice || 0)) {
    priceDiffNote = `<div style="color:#dc2626;margin-top:6px;">⚠️ สนาม/เวลาใหม่ราคาสูงกว่าเดิม ยอดคงเหลือที่ต้องจ่ายที่สนามจะเพิ่มขึ้นเป็น ${newRemainingAmount.toLocaleString()} บาท</div>`;
  } else if (newTotalPrice < (currentEditBooking.totalPrice || 0)) {
    priceDiffNote = `<div style="color:#16a34a;margin-top:6px;">✅ สนาม/เวลาใหม่ราคาถูกกว่าเดิม ยอดคงเหลือที่ต้องจ่ายที่สนามจะลดลงเหลือ ${newRemainingAmount.toLocaleString()} บาท</div>`;
  }
  preview.innerHTML = `
    <div style="font-weight:700;color:#065f46;margin-bottom:6px;">✅ สรุปการจองใหม่</div>
    <div>📍 สนาม: ${SecurityUtils.escapeHtml(editSelectedField)}</div>
    <div>📅 วันที่: ${formatDateThai(editSelectedDate)}</div>
    <div>⏰ เวลา: ${SecurityUtils.escapeHtml(editSelectedTimeSlot)}</div>
    <div>💰 ราคาเต็ม: ${newTotalPrice.toLocaleString()} บาท</div>
    <div>💵 มัดจำ (ใช้ของเดิม): ${depositAmount.toLocaleString()} บาท</div>
    <div>💸 คงเหลือจ่ายที่สนาม: ${newRemainingAmount.toLocaleString()} บาท</div>
    ${priceDiffNote}
    ${isSameSlot ? '<div style="color:#6b7280;margin-top:6px;">ℹ️ เป็นสนาม/วัน/เวลาเดิม ไม่มีการเปลี่ยนแปลง</div>' : ''}`;
 
  const confirmBtn = document.getElementById('confirmEditBookingBtn');
  confirmBtn.disabled = isSameSlot; // ป้องกันกดยืนยันทั้งที่ไม่ได้เปลี่ยนอะไร
}
 
async function confirmEditBooking() {
  if (!currentEditBooking || !editSelectedField || !editSelectedDate || !editSelectedTimeSlot) {
    showToast('❌ กรุณาเลือกสนาม วันที่ และเวลาที่ต้องการเปลี่ยนให้ครบ', 'error');
    return;
  }
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) { showToast('❌ กรุณา Login ใหม่อีกครั้ง', 'error'); return; }
 
  const oldBooking = currentEditBooking;
  const newField = editSelectedField, newDate = editSelectedDate, newTime = editSelectedTimeSlot;
  const isSameSlot = newField === oldBooking.field && newDate === oldBooking.date && newTime === oldBooking.time;
  if (isSameSlot) { showToast('ℹ️ ยังไม่ได้เปลี่ยนสนาม/วัน/เวลา', 'warning'); return; }
 
  // กันแก้ไขไปเป็นวัน/เวลาที่ผ่านไปแล้ว
  const newStartDateTime = new Date(`${newDate}T${newTime.split(' - ')[0]}:00`);
  if (isNaN(newStartDateTime.getTime()) || newStartDateTime <= new Date()) {
    showToast('❌ ไม่สามารถเลือกวัน/เวลาที่ผ่านมาแล้วได้', 'error');
    return;
  }
 
  const confirmBtn = document.getElementById('confirmEditBookingBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = '⏳ กำลังบันทึกการแก้ไข...';
 
  const oldKey = `${oldBooking.field}_${oldBooking.date}_${oldBooking.time}`;
  const newKey = `${newField}_${newDate}_${newTime}`;
 
  try {
    // 1) ล็อกช่วงเวลาใหม่แบบ atomic ก่อน กันชนกับคนอื่นที่กดจอง/แก้ไขพร้อมกัน
    const newLockResult = await database.ref('booking_locks/' + newKey).transaction((currentData) => {
      if (currentData === null) return { locked: true, timestamp: Date.now(), userId: firebaseUser.uid };
      else return undefined;
    });
    if (!newLockResult.committed) {
      showToast('❌ ช่วงเวลาที่เลือกถูกจองไปแล้ว กรุณาเลือกช่วงเวลาอื่น', 'error');
      confirmBtn.disabled = false; confirmBtn.textContent = '✅ ยืนยันการแก้ไข';
      checkEditAvailability();
      return;
    }
 
    try {
      // 2) ตรวจซ้ำสถานะ booking เดิมล่าสุดก่อนเขียนจริง (กันเปิดโมดัลค้างไว้นานแล้วสถานะเปลี่ยนไปแล้ว)
      const freshSnap = await database.ref('bookings/' + oldBooking.id).once('value');
      const freshBooking = freshSnap.val();
      if (!freshBooking) throw new Error('ไม่พบข้อมูลการจองเดิม (อาจถูกยกเลิกไปแล้ว)');
      if (freshBooking.userId !== firebaseUser.uid) throw new Error('คุณไม่มีสิทธิ์แก้ไขการจองนี้');
      if (!['pending_payment', 'pending', 'approved'].includes(freshBooking.bookingStatus)) {
        throw new Error('ไม่สามารถแก้ไขการจองในสถานะปัจจุบันได้');
      }
      if (freshBooking.extendedTo) throw new Error('การจองนี้มีการต่อเวลาแล้ว ไม่สามารถแก้ไขได้');
 
      const newTotalPrice = calculateFieldPrice(newField, parseInt(newTime.split(':')[0]));
      const depositAmount = freshBooking.depositAmount || 0;
      const newRemainingAmount = Math.max(newTotalPrice - depositAmount, 0);
 
      const updates = {};
      // ย้าย availability: ลบช่วงเวลาเดิม เพิ่มช่วงเวลาใหม่ (atomic ไปพร้อมกันทั้งหมดผ่าน update() เดียว)
      updates['availability/' + oldBooking.field + '/' + oldBooking.date + '/' + oldBooking.time] = null;
      updates['availability/' + newField + '/' + newDate + '/' + newTime] = true;
      // อัปเดตข้อมูล booking หลัก
      updates['bookings/' + oldBooking.id + '/field'] = newField;
      updates['bookings/' + oldBooking.id + '/date'] = newDate;
      updates['bookings/' + oldBooking.id + '/time'] = newTime;
      updates['bookings/' + oldBooking.id + '/totalPrice'] = newTotalPrice;
      updates['bookings/' + oldBooking.id + '/remainingAmount'] = newRemainingAmount;
      updates['bookings/' + oldBooking.id + '/field_date_time'] = newKey;
      updates['bookings/' + oldBooking.id + '/lastEditedAt'] = new Date().toISOString();
      // ปลด lock ของช่วงเวลาเดิม (ไม่ต้องครองไว้อีกต่อไปเพราะย้ายไปช่วงใหม่แล้ว)
      updates['booking_locks/' + oldKey] = null;
 
      await database.ref().update(updates);
 
      // บันทึก log การแก้ไข ไว้ให้ staff ตรวจสอบย้อนหลังได้ (ไม่มีผลต่อการทำงานถ้าล้มเหลว)
      database.ref('booking_edit_log').push({
        bookingId: oldBooking.id,
        userId: firebaseUser.uid,
        from: { field: oldBooking.field, date: oldBooking.date, time: oldBooking.time },
        to: { field: newField, date: newDate, time: newTime },
        editedAt: new Date().toISOString()
      }).catch(() => {});
 
      showToast('✅ แก้ไขการจองสำเร็จ! เปลี่ยนเป็น ' + newField + ' วันที่ ' + formatDateThai(newDate) + ' เวลา ' + newTime, 'success', 5000);
      closeEditBookingModal();
      updateBookingList();
    } catch (innerError) {
      // เขียนจริงไม่สำเร็จ ต้องปลด lock ใหม่ที่เพิ่งได้มาคืน ไม่งั้นช่วงเวลานั้นจะค้างเป็น "ไม่ว่าง" ตลอดไป
      await database.ref('booking_locks/' + newKey).remove().catch(() => {});
      throw innerError;
    }
  } catch (error) {
    showToast('❌ ' + error.message, 'error');
    confirmBtn.disabled = false;
    confirmBtn.textContent = '✅ ยืนยันการแก้ไข';
  }
}
 