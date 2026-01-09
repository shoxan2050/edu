import { auth, db } from './firebase.js';
import { ref, set, get, push } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("user");
        window.location.href = 'login.html';
        return;
    }

    // Verify Teacher role
    const snapshot = await get(ref(db, 'users/' + user.uid));
    if (snapshot.exists() && snapshot.val().role !== 'teacher') {
        window.location.href = 'dashboard.html';
    }

    loadTeacherSubjects();
});

async function loadTeacherSubjects() {
    const list = document.getElementById('teacherSubjects');
    // For MVP, using a simple structure
    const subjects = [
        { id: 'math', name: 'Matematika', lessons: 5 },
        { id: 'english', name: 'Ingliz tili', lessons: 3 }
    ];

    list.innerHTML = subjects.map(s => `
        <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div class="flex justify-between items-start mb-4">
                <h4 class="text-xl font-bold text-gray-900">${s.name}</h4>
                <span class="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">${s.lessons} mavzu</span>
            </div>
            <div class="flex gap-2">
                <button class="flex-grow py-3 bg-gray-50 text-gray-600 rounded-xl font-semibold hover:bg-gray-100 transition">Tahrirlash</button>
                <button class="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

// Excel Parsing Logic
document.getElementById('excelInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        console.log("Excel Data:", jsonData);
        processExcelData(jsonData);
    };
    reader.readAsArrayBuffer(file);
});

async function processExcelData(data) {
    // Validate schema
    if (!data.length) {
        alert("Excel fayl bo'sh!");
        return;
    }

    const firstRow = data[0];
    const required = ["Fan", "Mavzu", "Tartib"];
    const missing = required.filter(col => !(col in firstRow));

    if (missing.length > 0) {
        alert(`Xato! Quyidagi ustunlar topilmadi: ${missing.join(", ")}`);
        return;
    }

    alert(`${data.length} ta satr aniqlandi. Tizimga yuklanmoqda...`);

    // Save to Firebase (Simplified logic for MVP)
    const user = auth.currentUser;
    if (user) {
        try {
            for (const row of data) {
                if (!row.Fan || !row.Mavzu || !row.Tartib) continue;

                const subjectRef = ref(db, `subjects/${row.Fan.toLowerCase()}/lessons/${row.Tartib}`);
                await set(subjectRef, {
                    title: row.Mavzu,
                    order: row.Tartib,
                    duration: row.Soat || 0,
                    uploadedBy: user.uid
                });
            }
            alert("Ma'lumotlar muvaffaqiyatli saqlandi!");
            loadTeacherSubjects();
        } catch (e) {
            console.error("Upload error", e);
            alert("Yuklashda xatolik yuz berdi!");
        }
    }
}

import { logout } from './auth.js';
document.getElementById('logoutBtn').addEventListener('click', logout);
