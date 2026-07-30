// ============================================================
// firebase-init.js — Firebase Configuration (Centralized)
// ============================================================
// ไฟล์นี้คือแหล่งรวม firebaseConfig เพียงแห่งเดียวของโปรเจค
// ทุกหน้าต้องโหลด firebase-init.js หลังจาก Firebase SDK
// (firebase-app.js, firebase-auth.js, firebase-database.js)
// เพื่อให้ firebase.initializeApp() ถูกเรียกแค่ครั้งเดียว
// ============================================================

(function() {
  var FIREBASE_INIT_RETRY_MAX = 50;
  var FIREBASE_INIT_RETRY_COUNT = 0;

  function initFirebase() {
    FIREBASE_INIT_RETRY_COUNT++;

    // รอให้ Firebase SDK โหลดเสร็จก่อน
    if (typeof firebase === 'undefined') {
      if (FIREBASE_INIT_RETRY_COUNT > FIREBASE_INIT_RETRY_MAX) {
        console.error('[firebase-init] Firebase SDK failed to load after retries');
        return;
      }
      setTimeout(initFirebase, 100);
      return;
    }

    try {
      // ถ้า Firebase ถูก initialize ไปแล้ว (จาก instance อื่น) ให้ข้าม
      if (firebase.apps.length === 0) {
        var firebaseConfig = {
          apiKey: "AIzaSyB6jVc8qcyS9zIJvfi-E1BL7BaxrUorO7w",
          authDomain: "prijit-sport.firebaseapp.com",
          databaseURL: "https://prijit-sport-default-rtdb.asia-southeast1.firebasedatabase.app",
          projectId: "prijit-sport",
          storageBucket: "prijit-sport.firebasestorage.app",
          messagingSenderId: "19782245186",
          appId: "1:19782245186:web:8ff3e2e17a214edc3546db"
        };

        firebase.initializeApp(firebaseConfig);
        console.log('[firebase-init] Firebase initialized successfully');
      } else {
        console.log('[firebase-init] Firebase already initialized, reusing existing instance');
      }

      // ตั้งค่า auth และ database เป็น global variable
      // เพื่อให้ทุกไฟล์ (app.js, staff-login.html, staff-panel.html, ฯลฯ)
      // สามารถใช้ window.auth / window.database หรือ auth / database ตรง ๆ ได้
      window.auth = firebase.auth();
      window.database = firebase.database();
      console.log('[firebase-init] auth & database ready');
    } catch (error) {
      console.error('[firebase-init] Initialization error:', error);
    }
  }

  initFirebase();
})();
