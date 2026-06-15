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
    const selectedDate = new Date(value);
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
  const query = database.ref('bookings').orderByChild('field').equalTo(field);
  currentAvailabilityCheck = query;
  query.once('value').then((snapshot) => {
    clearTimeout(timeoutId);
    if (currentAvailabilityCheck !== query) return;
    const bookedTimes = [];
    snapshot.forEach((child) => {
      const booking = child.val();
      if (booking.date === date && booking.bookingStatus !== 'cancelled') bookedTimes.push(booking.time);
    });
    updateTimeSlotAvailability(bookedTimes);
    statusDiv.style.display = 'none';
    currentAvailabilityCheck = null;
  }).catch((error) => {
    clearTimeout(timeoutId);
    if (currentAvailabilityCheck !== query) return;
    statusDiv.className = 'availability-notice';
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<strong style="color:#ef4444;">❌ ตรวจสอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</strong>';
    currentAvailabilityCheck = null;
  });
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
  const selectedDate = new Date(date);
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
 
        <div style="background:#f0fdf4;border-radius:10px;padding:14px;margin-bottom:14px;font-size:0.95em;line-height:1.8;">
          <div>📍 <strong>สนาม:</strong> ${field}</div>
          <div>📅 <strong>วันที่:</strong> ${displayDate}</div>
          <div>⏰ <strong>เวลา:</strong> ${selectedTimeSlot}</div>
        </div>
 
        <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px;font-size:0.95em;line-height:1.8;">
          <div>💰 <strong>ราคาเต็ม:</strong> ${totalPrice.toLocaleString()} บาท</div>
          <div>💵 <strong>มัดจำ 30%:</strong> <span style="color:#10b981;font-weight:700;">${depositAmount.toLocaleString()} บาท</span></div>
          <div>💸 <strong>คงเหลือจ่ายที่สนาม:</strong> <span style="color:#ef4444;font-weight:700;">${remainingAmount.toLocaleString()} บาท</span></div>
        </div>
 
        <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:14px;font-size:0.95em;line-height:1.8;">
          <div>👤 <strong>ผู้จอง:</strong> ${currentUser.fullname}</div>
          <div>📞 <strong>เบอร์:</strong> ${currentUser.phone}</div>
        </div>
 
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px;margin-bottom:20px;font-size:0.9em;line-height:1.8;">
          <div style="font-weight:700;color:#dc2626;margin-bottom:6px;">⚠️ เงื่อนไข</div>
          <div>• ชำระค่ามัดจำ <strong>${depositAmount.toLocaleString()} บาท</strong> ผ่าน QR Code</div>
          <div style="color:#dc2626;font-weight:600;">• หากมาไม่ตรงตามเวลาไม่สามารถขอค่ามัดจำคืนได้</div>
          <div style="color:#059669;">• มาตามนัด = คืนเงินมัดจำทันที</div>
        </div>
 
        <div style="display:flex;gap:12px;">
          <button onclick="document.getElementById('confirmBookingModal').remove()"
            style="flex:1;padding:12px;border:2px solid #e5e7eb;background:white;border-radius:10px;font-size:1em;cursor:pointer;font-family:inherit;color:#666;">
            ยกเลิก
          </button>
          <button onclick="document.getElementById('confirmBookingModal').remove(); showPaymentModal();"
            style="flex:2;padding:12px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:10px;font-size:1em;font-weight:700;cursor:pointer;font-family:inherit;">
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
            <span class="summary-label">💵 ค่าบริการทั้งหมด:</span>
            <span class="summary-value">${data.totalPrice.toLocaleString()} บาท</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">📍 ค่ามัดจำ 30%:</span>
            <span class="summary-value">${data.depositAmount.toLocaleString()} บาท</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">💸 ค่าบริการคงเหลือจ่ายที่สนาม:</span>
            <span class="summary-value" style="color:#ef4444;font-weight:700;">${data.remainingAmount.toLocaleString()} บาท</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">💰 ต้องชำระตอนนี้:</span>
            <span class="summary-value" style="color:#22c55e;font-size:1.3em;">${data.depositAmount.toLocaleString()} บาท</span>
          </div>
        </div>
        <div class="deposit-highlight">
          <p><strong>📱 สแกน QR Code เพื่อชำระค่ามัดจำ</strong></p>
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
        <div class="payment-info">
          <p><strong>💰 ยอดชำระ:</strong> ${data.depositAmount.toLocaleString()} บาท</p>
          <p><strong>📱 เลขพร้อมเพย์:</strong> 1103100835163</p>
          <p><strong>🏢 ชื่อบัญชี:</strong> นาย พัสกร ราชชมภู</p>
          <p><strong>🆔 Ref:</strong> ${data.field.replace('สนาม ','F')}-${data.date.replace(/-/g,'')}</p>
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
          <h4>⚠️ เงื่อนไขการคืนเงินมัดจำ</h4>
          <ul>
            <li>✅ มาตามเวลานัด: คืนเงินมัดจำ ${data.depositAmount.toLocaleString()} บาท ทันที</li>
            <li style="color:red;font-weight:bold;">❌ หากมาไม่ตรงตามเวลาไม่สามารถขอค่ามัดจำคืนได้</li>
            <li>📌 กรุณามาถึงก่อนเวลา 15 นาที</li>
          </ul>
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
    database.ref('booking_locks/' + uniqueKey).transaction((currentData) => {
      if (currentData === null) return { locked: true, timestamp: Date.now() };
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
        bookingRef.set(bookingData).then(() => {
          clearInterval(paymentTimer);
          const displayDate = formatDateThai(data.date);
          alert(`✅ อัพโหลดสลิปสำเร็จ!\n\n📋 เลขที่การจอง: #${bookingRef.key.substr(-6).toUpperCase()}\n\nระบบจะตรวจสอบการชำระเงินภายใน 5 นาที\n\n📍 สนาม: ${data.field}\n📅 วันที่: ${displayDate}\n⏰ เวลา: ${data.time}\n💰 มัดจำ: ${data.depositAmount.toLocaleString()} บาท ✅\n💸 ค่าบริการคงเหลือ: ${data.remainingAmount.toLocaleString()} บาท\n\n⚠️ กรุณามาตามเวลานัดเพื่อรับเงินมัดจำคืน`);
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
  database.ref('bookings').orderByChild('userId').equalTo(user.uid).once('value').then((snapshot) => {
    if (!snapshot.exists()) {
      bookingListDiv.innerHTML = `<div style="text-align:center;padding:40px;"><p style="color:#6b7280;font-size:1.1em;">⚽ ยังไม่มีรายการจอง</p><p style="color:#9ca3af;margin-top:10px;">เริ่มจองสนามได้เลย!</p></div>`;
      return;
    }
    const bookings = [];
    snapshot.forEach((childSnapshot) => {
      const booking = childSnapshot.val();
      booking.id = childSnapshot.key;
      if (booking.bookingStatus !== 'rejected') bookings.push(booking);
    });
    if (bookings.length === 0) { bookingListDiv.innerHTML = '<p style="text-align:center;color:#666;">ยังไม่มีรายการจอง</p>'; return; }
    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    bookingListDiv.innerHTML = bookings.map(booking => generateBookingCard(booking)).join('');
    initializeBookingCardEvents();
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
 
  let extensionButton = '';
  if (safeBooking.bookingStatus === 'approved') {
    try {
      const bookingDateStr = safeBooking.date;
      const todayStr = new Date().toISOString().split('T')[0];
      if (bookingDateStr === todayStr) {
        const bookingDataStr = JSON.stringify(booking).replace(/"/g, '&quot;');
        extensionButton = `<button class="extend-booking-btn" data-booking-id="${safeBooking.id}" data-booking-data="${bookingDataStr}" id="extend-btn-${safeBooking.id}"><span>🔄</span><span>ต่อเวลา 1 ชั่วโมง</span></button><div class="next-slot-info" id="next-slot-${safeBooking.id}">กำลังตรวจสอบช่วงถัดไป...</div>`;
      }
    } catch(e) {}
  }
 
  let cancelButton = '';
  if (['pending','pending_payment','approved'].includes(safeBooking.bookingStatus)) {
    cancelButton = `<button class="cancel-btn" id="cancel-btn-${safeBooking.id}" data-booking-id="${safeBooking.id}" style="background:#ef4444;color:white;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-top:10px;">❌ ยกเลิกการจอง</button>`;
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
          <span style="font-weight:600;color:${safeBooking.depositStatus==='approved'?'#10b981':'#f59e0b'}">${safeBooking.depositAmount.toLocaleString()} บาท ${safeBooking.depositStatus==='approved'?'✅':'⏳'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#6b7280;font-size:13px;">💸 ค่าบริการคงเหลือจ่ายที่สนาม</span>
          <span style="font-weight:600;color:${safeBooking.remainingStatus==='paid'?'#10b981':'#ef4444'}">${safeBooking.remainingAmount.toLocaleString()} บาท${safeBooking.remainingStatus==='paid'?' ✅':''}</span>
        </div>
      </div>
      ${extensionButton}
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
    return Promise.all([database.ref('bookings/' + bookingId).remove(), database.ref('booking_locks/' + uniqueKey).remove()]);
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
          currentUser = { uid: user.uid, ...snapshot.val() };
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
    const snapshot = await database.ref('bookings').orderByChild('field_date_time').equalTo(`${booking.field}_${booking.date}_${endTime} - ${nextEndTime}`).once('value');
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
    const nextSlotSnapshot = await database.ref('bookings').orderByChild('field_date_time').equalTo(`${booking.field}_${booking.date}_${endTime} - ${nextEndTime}`).once('value');
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
    const newBookingRef = database.ref('bookings').push();
    const uniqueKey = `${booking.field}_${booking.date}_${timeSlot}`;
    await newBookingRef.set({
      userId: booking.userId, username: booking.username, fullname: booking.fullname || booking.username,
      phone: booking.phone, field: booking.field, date: booking.date, time: timeSlot,
      totalPrice: price, depositAmount: 0, remainingAmount: price,
      depositStatus: 'not_required', remainingStatus: 'unpaid', bookingStatus: 'approved',
      extendedFrom: booking.id, field_date_time: uniqueKey, createdAt: new Date().toISOString()
    });
    await database.ref(`bookings/${booking.id}`).update({ extendedTo: newBookingRef.key });
    showToast('✅ ต่อเวลาสำเร็จ! ขอบคุณที่ใช้บริการ', 'success');
    closeExtensionModal(); updateBookingList();
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
      const snapshot = await database.ref('bookings').orderByChild('field_date_time').equalTo(`${booking.field}_${booking.date}_${timeSlot}`).once('value');
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
    const availabilityCheck = await database.ref('bookings').orderByChild('field_date_time').equalTo(uniqueKey).once('value');
    if (availabilityCheck.exists()) { hideLoading(); showToast('❌ ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกช่วงเวลาอื่น', 'error'); return; }
    showLoading('กำลังสร้างการจอง...');
    const lockRef = database.ref('booking_locks/' + uniqueKey);
    await lockRef.set({ userId: booking.userId, timestamp: Date.now() });
    const newBookingRef = database.ref('bookings').push();
    await newBookingRef.set({
      userId: booking.userId, username: booking.username, fullname: booking.fullname || booking.username,
      phone: booking.phone, field: booking.field, date: booking.date, time: timeSlot,
      totalPrice: price, depositAmount: 0, remainingAmount: price,
      depositStatus: 'not_required', remainingStatus: 'unpaid', bookingStatus: 'approved',
      field_date_time: uniqueKey, createdAt: new Date().toISOString(), alternativeBooking: true
    });
    await lockRef.remove();
    hideLoading();
    showToast('✅ จองช่วงเวลาใหม่สำเร็จ! กรุณาชำระเงิน', 'success');
    closeExtensionModal(); updateBookingList();
    setTimeout(() => { const section = document.getElementById('checkBookingSection'); if (section) section.scrollIntoView({ behavior:'smooth', block:'start' }); }, 500);
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
 