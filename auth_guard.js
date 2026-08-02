/**
 * auth_guard.js - Bảo vệ trang đích theo phân quyền của người dùng
 * Cách sử dụng trên bất kỳ trang nào (VD: student.html, teacher.html):
 * Thêm vào trong <head> hoặc trước </body>:
 * <script src="auth_guard.js" data-card-id="student"></script>
 * (Nếu không truyền data-card-id, script sẽ tự nhận diện theo tên file HTML, VD: teacher.html -> teacher)
 */

(function() {
  // Lấy data-card-id từ script tag hiện tại hoặc tự động nhận diện từ URL
  const currentScript = document.currentScript;
  let targetCardId = currentScript ? currentScript.getAttribute('data-card-id') : null;

  if (!targetCardId) {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    const match = filename.match(/^([a-zA-Z0-9_-]+)\.html$/);
    if (match && match[1] !== 'index' && match[1] !== 'admin') {
      targetCardId = match[1];
    }
  }

  // Nếu trang là index hoặc admin thì bỏ qua guard này
  if (!targetCardId) return;

  // Báo ngắn gọn và chuyển thẳng về trang chủ khi không có quyền
  const blockAccessAndRedirect = () => {
    alert('⛔ Bạn không có quyền truy cập!');
    window.location.href = 'index.html';
  };

  // Đợi Firebase sẵn sàng để kiểm tra quyền
  const checkPermission = async () => {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) {
      setTimeout(checkPermission, 100);
      return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // Kiểm tra quyền của khách (chưa đăng nhập)
        try {
          const snap = await db.collection('settings').doc('default_cards').get();
          const unauthCards = snap.exists ? (snap.data().unauthenticatedCards || []) : [];
          if (!unauthCards.includes(targetCardId)) {
            blockAccessAndRedirect();
          }
        } catch {
          blockAccessAndRedirect();
        }
        return;
      }

      // Đã đăng nhập -> kiểm tra role & group
      try {
        const uDoc = await db.collection('users').doc(user.uid).get();
        if (uDoc.exists && uDoc.data().role === 'admin') {
          return; // Admin có toàn quyền
        }

        const groupId = uDoc.exists ? uDoc.data().groupId : null;
        if (groupId) {
          const gDoc = await db.collection('groups').doc(groupId).get();
          const visibleCards = (gDoc.exists && gDoc.data().visibleCards) ? gDoc.data().visibleCards : null;
          if (visibleCards && !visibleCards.includes(targetCardId)) {
            blockAccessAndRedirect();
          }
        } else {
          // Khách đăng nhập nhưng chưa vào nhóm
          const snap = await db.collection('settings').doc('default_cards').get();
          const guestCards = snap.exists ? (snap.data().guestCards || []) : [];
          if (!guestCards.includes(targetCardId)) {
            blockAccessAndRedirect();
          }
        }
      } catch (err) {
        console.error('Lỗi kiểm tra quyền truy cập:', err);
      }
    });
  };

  checkPermission();
})();
