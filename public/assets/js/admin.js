import { auth, db } from './firebase.js';
import { ref, get, remove, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { logout, showToast } from './auth.js';

// Check admin access - uses Firebase role directly
const init = async (user) => {
    if (!user) {
        window.location.href = '/login';
        return;
    }

    // Check admin role from Firebase user data (set by guard.js)
    if (user.role !== 'admin') {
        showToast("Admin huquqi yo'q! ❌", 'error');
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 500);
        return;
    }

    // Admin verified - load users
    console.log('[Admin] Access granted for:', user.email);
    loadAllUsers();
};

if (window.__AUTH_USER__) {
    init(window.__AUTH_USER__);
} else {
    document.addEventListener('authReady', (e) => init(e.detail));
}

// Logout
document.getElementById('logoutBtn').onclick = logout;

// ========== USERS ==========
window.loadAllUsers = async function () {
    const tbody = document.getElementById('usersTableBody');
    try {
        const snap = await get(ref(db, 'users'));
        if (!snap.exists()) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400">Foydalanuvchilar topilmadi</td></tr>';
            return;
        }

        const users = snap.val();
        let idx = 1;

        tbody.innerHTML = Object.entries(users).map(([uid, u]) => `
            <tr class="hover:bg-gray-50">
                <td class="p-4 text-gray-400">${idx++}</td>
                <td class="p-4 font-bold text-gray-900">${u.name || 'Noma\'lum'}</td>
                <td class="p-4 text-gray-500">${u.email || '-'}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded-lg text-xs font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-600' :
                u.role === 'teacher' ? 'bg-purple-100 text-purple-600' :
                    'bg-blue-100 text-blue-600'
            }">${u.role || 'student'}</span>
                </td>
                <td class="p-4">${u.sinf || '-'}</td>
                <td class="p-4">
                    <button onclick="deleteUser('${uid}')" class="px-3 py-1 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Load users error:", e);
    }
};

window.deleteUser = async function (uid) {
    if (!confirm("Bu foydalanuvchini o'chirishni xohlaysizmi?")) return;
    try {
        await remove(ref(db, `users/${uid}`));
        showToast("Foydalanuvchi o'chirildi! 🗑️", 'success');
        loadAllUsers();
    } catch (e) {
        showToast("Xatolik: " + e.message, 'error');
    }
};

window.deleteAllUsers = async function () {
    if (!confirm("BARCHA foydalanuvchilarni o'chirmoqchimisiz?")) return;
    if (!confirm("ROSTDAN HAM BARCHA FOYDALANUVCHILARNI O'CHIRASIZMI?")) return;
    try {
        await remove(ref(db, 'users'));
        showToast("Barcha foydalanuvchilar o'chirildi! 🗑️", 'success');
        loadAllUsers();
    } catch (e) {
        showToast("Xatolik: " + e.message, 'error');
    }
};

// ========== SUBJECTS ==========
window.loadAllSubjects = async function () {
    const container = document.getElementById('adminSubjectsList');
    try {
        const snap = await get(ref(db, 'subjects'));
        if (!snap.exists()) {
            container.innerHTML = '<div class="text-center text-gray-400 p-10">Fanlar topilmadi</div>';
            return;
        }

        const subjects = snap.val();
        container.innerHTML = Object.entries(subjects).map(([id, s]) => `
            <div class="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                <div class="flex items-center gap-4">
                    <span class="text-2xl">${s.icon || '📚'}</span>
                    <div>
                        <h4 class="font-bold text-gray-900">${s.name}</h4>
                        <p class="text-sm text-gray-500">${Object.keys(s.lessons || {}).length} mavzu</p>
                    </div>
                </div>
                <button onclick="deleteSubject('${id}')" class="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200">🗑️ O'chirish</button>
            </div>
        `).join('');
    } catch (e) {
        console.error("Load subjects error:", e);
    }
};

window.deleteSubject = async function (id) {
    if (!confirm("Bu fanni o'chirishni xohlaysizmi?")) return;
    try {
        await remove(ref(db, `subjects/${id}`));
        await remove(ref(db, `tests/${id}`));
        showToast("Fan o'chirildi! 🗑️", 'success');
        loadAllSubjects();
    } catch (e) {
        showToast("Xatolik: " + e.message, 'error');
    }
};

window.deleteAllSubjects = async function () {
    if (!confirm("BARCHA fanlarni o'chirmoqchimisiz?")) return;
    try {
        await remove(ref(db, 'subjects'));
        await remove(ref(db, 'tests'));
        showToast("Barcha fanlar o'chirildi! 🗑️", 'success');
        loadAllSubjects();
    } catch (e) {
        showToast("Xatolik: " + e.message, 'error');
    }
};

// ========== TESTS ==========
window.loadAllTests = async function () {
    const container = document.getElementById('adminTestsList');
    try {
        const snap = await get(ref(db, 'tests'));
        if (!snap.exists()) {
            container.innerHTML = '<div class="text-center text-gray-400 p-10">Testlar topilmadi</div>';
            return;
        }

        const tests = snap.val();
        let html = '';

        Object.entries(tests).forEach(([subjectId, lessons]) => {
            Object.entries(lessons).forEach(([lessonId, test]) => {
                html += `
                    <div class="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                        <div>
                            <h4 class="font-bold text-gray-900">${test.topic || lessonId}</h4>
                            <p class="text-sm text-gray-500">${test.questions?.length || 0} savol</p>
                        </div>
                        <button onclick="deleteTest('${subjectId}', '${lessonId}')" class="px-4 py-2 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200">🗑️</button>
                    </div>
                `;
            });
        });

        container.innerHTML = html || '<div class="text-center text-gray-400 p-10">Testlar topilmadi</div>';
    } catch (e) {
        console.error("Load tests error:", e);
    }
};

window.deleteTest = async function (subjectId, lessonId) {
    if (!confirm("Bu testni o'chirishni xohlaysizmi?")) return;
    try {
        await remove(ref(db, `tests/${subjectId}/${lessonId}`));
        showToast("Test o'chirildi! 🗑️", 'success');
        loadAllTests();
    } catch (e) {
        showToast("Xatolik: " + e.message, 'error');
    }
};

window.deleteAllTests = async function () {
    if (!confirm("BARCHA testlarni o'chirmoqchimisiz?")) return;
    try {
        await remove(ref(db, 'tests'));
        showToast("Barcha testlar o'chirildi! 🗑️", 'success');
        loadAllTests();
    } catch (e) {
        showToast("Xatolik: " + e.message, 'error');
    }
};

// ========== LOGS ==========
window.loadLogs = async function () {
    const container = document.getElementById('adminLogsList');
    try {
        const snap = await get(ref(db, 'logs'));
        if (!snap.exists()) {
            container.innerHTML = '<div class="text-green-600">[INFO] Loglar topilmadi</div>';
            return;
        }

        const logs = snap.val();
        let html = '';

        // Uploads
        if (logs.uploads) {
            Object.entries(logs.uploads).forEach(([id, log]) => {
                const date = new Date(log.timestamp).toLocaleString('uz');
                html += `<div>[${date}] UPLOAD: ${log.fileName} - ${log.rowCount} qator</div>`;
            });
        }

        container.innerHTML = html || '<div>[INFO] Loglar topilmadi</div>';
    } catch (e) {
        console.error("Load logs error:", e);
    }
};
