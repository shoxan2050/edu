import { auth, db } from './firebase.js';
import { ref, get, set, remove, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { DbService } from './modules/db-service.js';
import { setBtnLoading, logout, showToast } from './auth.js';
import { AiService } from './modules/ai-service.js';

const init = async (user) => {
    loadTeacherSubjects();
    setupAddSubjectButton();
    setupProfileInfo(user);
};

if (window.__AUTH_USER__) {
    init(window.__AUTH_USER__);
} else {
    document.addEventListener('authReady', (e) => init(e.detail));
}

// Profile setup
function setupProfileInfo(user) {
    if (!user) return;
    document.getElementById('profileName').textContent = user.name || 'O\'qituvchi';
    document.getElementById('profileEmail').textContent = user.email || '';

    document.getElementById('profileLogout').onclick = logout;
    document.getElementById('logoutBtn').onclick = logout;
}

// --- ADD SUBJECT FUNCTIONALITY ---
function setupAddSubjectButton() {
    const addBtn = document.getElementById('addSubjectBtn');
    if (!addBtn) return;

    addBtn.onclick = () => {
        const modal = document.getElementById('addSubjectModal');
        if (modal) modal.classList.remove('hidden');
    };
}

async function createSubject(name) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const subjectId = `S-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const updates = {};
        updates[`subjects/${subjectId}`] = {
            id: subjectId,
            name: name,
            icon: "📚",
            createdBy: user.uid,
            createdAt: Date.now(),
            path: [],
            classes: []
        };

        await DbService.commitBatchUpload(updates, `manual_${name}`, user.uid);
        showToast(`"${name}" fani qo'shildi! 🎉`, 'success');
        loadTeacherSubjects();
    } catch (e) {
        console.error("Create subject error", e);
        showToast("Fan qo'shishda xatolik! ❌", 'error');
    }
}

window.createSubject = createSubject;

// --- LOAD SUBJECTS ---
async function loadTeacherSubjects() {
    const list = document.getElementById('teacherSubjects');
    if (!list) return;

    try {
        const subjects = await DbService.getAllSubjects() || {};
        if (!subjects || Object.keys(subjects).length === 0) {
            list.innerHTML = `<div class="col-span-full py-10 text-center text-gray-400">Hali fanlar qo'shilmagan.</div>`;
            return;
        }
        list.innerHTML = Object.keys(subjects).map(id => {
            const s = subjects[id];
            const lessons = s.lessons || {};
            const lessonsCount = Object.keys(lessons).length;
            const needsAI = Object.values(lessons).some(l => l.testGenerated === false);

            return `
                <div class="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-4">
                            <div class="flex items-center gap-3">
                                <span class="text-2xl">${s.icon || '📚'}</span>
                                <h4 class="text-xl font-bold text-gray-900">${s.name}</h4>
                            </div>
                            <span class="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-bold">${lessonsCount} mavzu</span>
                        </div>
                        ${needsAI ? `
                            <div class="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center gap-2 text-sm text-amber-700">
                                <span>🤖</span> Testlar generatsiya qilinmagan
                            </div>
                        ` : ''}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.openTestEditor('${id}', '${s.name}')" class="flex-grow py-3 bg-gray-50 text-gray-600 rounded-xl font-semibold hover:bg-gray-100 transition">Boshqarish</button>
                        ${needsAI ? `
                            <button onclick="window.generateAI('${id}')" class="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition" title="AI Test Generatsiya">🪄</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Subjects load error", error);
    }
}

// --- AI Generation ---
let isAiGenerating = false;

window.generateAI = async (subjectId) => {
    if (isAiGenerating) return;
    isAiGenerating = true;

    try {
        const subjectData = await DbService.getSubject(subjectId);
        if (!subjectData) {
            showToast("Fan topilmadi! ❌", 'error');
            return;
        }

        const lessons = subjectData.lessons || {};
        const lessonsToGenerate = Object.keys(lessons).filter(key => lessons[key].testGenerated === false);

        if (lessonsToGenerate.length === 0) {
            showToast("Barcha testlar allaqachon generatsiya qilingan! ✅", 'success');
            return;
        }

        showToast(`${lessonsToGenerate.length} ta test generatsiyasi boshlandi... 🤖`, 'success');

        let successCount = 0;
        let failCount = 0;

        for (const key of lessonsToGenerate.slice(0, 5)) {
            const lesson = lessons[key];
            try {
                const token = await auth.currentUser.getIdToken();
                const testData = await AiService.generateTest(lesson.title, subjectId, key, token);
                await DbService.saveTest(subjectId, key, testData);
                successCount++;
            } catch (err) {
                console.error(`Failed for ${lesson.title}:`, err);
                failCount++;
            }
        }

        if (successCount > 0) showToast(`${successCount} ta test generatsiya qilindi! 🎉`, 'success');
        if (failCount > 0) showToast(`${failCount} ta testda xatolik. ❌`, 'error');
        loadTeacherSubjects();
    } catch (error) {
        console.error("AI Generation Error:", error);
        showToast("Xatolik yuz berdi! ❌", 'error');
    } finally {
        isAiGenerating = false;
    }
};

// --- STUDENTS STATISTICS ---
window.loadStudents = async function () {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    try {
        const snap = await get(ref(db, 'users'));
        if (!snap.exists()) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">O\'quvchilar topilmadi</td></tr>';
            return;
        }

        const users = snap.val();
        const students = Object.entries(users)
            .filter(([_, u]) => u.role !== 'teacher')
            .map(([uid, u]) => ({ uid, ...u }));

        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400">O\'quvchilar topilmadi</td></tr>';
            return;
        }

        tbody.innerHTML = students.map((s, idx) => {
            const progress = s.progress ? Object.keys(s.progress).length * 10 : 0; // Simple calc
            return `
                <tr class="hover:bg-gray-50">
                    <td class="p-4 font-mono text-gray-400">${idx + 1}</td>
                    <td class="p-4 font-bold text-gray-900">${s.name || 'Noma\'lum'}</td>
                    <td class="p-4">${s.sinf || s.class || '-'}-sinf</td>
                    <td class="p-4 text-gray-500">${s.email || '-'}</td>
                    <td class="p-4">
                        <div class="flex items-center gap-2">
                            <div class="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full bg-indigo-600" style="width: ${Math.min(progress, 100)}%"></div>
                            </div>
                            <span class="text-sm text-gray-500">${Math.min(progress, 100)}%</span>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error("Load students error", error);
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500">Xatolik yuz berdi</td></tr>';
    }
};

// --- ADMIN PANEL ---
window.loadAdminSubjects = async function () {
    const container = document.getElementById('adminSubjectsList');
    if (!container) return;

    try {
        const subjects = await DbService.getAllSubjects();
        if (Object.keys(subjects).length === 0) {
            container.innerHTML = '<div class="text-center text-gray-400 p-10">Fanlar topilmadi</div>';
            return;
        }

        container.innerHTML = Object.keys(subjects).map(id => {
            const s = subjects[id];
            const lessonsCount = Object.keys(s.lessons || {}).length;
            return `
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <span class="text-2xl">${s.icon || '📚'}</span>
                        <div>
                            <h4 class="font-bold text-gray-900">${s.name}</h4>
                            <p class="text-sm text-gray-500">${lessonsCount} ta mavzu</p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.openEditSubject('${id}', '${s.name}')" class="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-100 transition">✏️ Tahrirlash</button>
                        <button onclick="window.deleteSubject('${id}')" class="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 transition">🗑️ O'chirish</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Load admin subjects error", error);
    }
};

window.deleteSubject = async function (id) {
    if (!confirm("Bu fanni o'chirishni xohlaysizmi? Bu qaytarib bo'lmaydi!")) return;

    try {
        await remove(ref(db, `subjects/${id}`));
        showToast("Fan o'chirildi! 🗑️", 'success');
        loadTeacherSubjects();
        window.loadAdminSubjects();
    } catch (e) {
        console.error("Delete error", e);
        showToast("O'chirishda xatolik! ❌", 'error');
    }
};

window.deleteAllSubjects = async function () {
    if (!confirm("BARCHA fanlarni o'chirishni xohlaysizmi? Bu qaytarib bo'lmaydi!")) return;
    if (!confirm("ROSTDAN HAM BARCHA FANLARNI O'CHIRASIZMI?")) return;

    try {
        await remove(ref(db, 'subjects'));
        showToast("Barcha fanlar o'chirildi! 🗑️", 'success');
        loadTeacherSubjects();
        window.loadAdminSubjects();
    } catch (e) {
        console.error("Delete all error", e);
        showToast("O'chirishda xatolik! ❌", 'error');
    }
};

window.updateSubject = async function (id, newName) {
    try {
        await update(ref(db, `subjects/${id}`), { name: newName });
        showToast("Fan yangilandi! ✅", 'success');
        loadTeacherSubjects();
        window.loadAdminSubjects();
    } catch (e) {
        console.error("Update error", e);
        showToast("Yangilashda xatolik! ❌", 'error');
    }
};

// --- Excel Engine ---
let currentExcelRows = [];

document.getElementById('excelInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const selectedClass = document.getElementById('classSelect').value;
    const selectedSubject = document.getElementById('subjectSelect').value;

    if (!selectedClass || !selectedSubject) {
        showToast("Avval sinf va fanni tanlang! ⚠️", 'error');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (jsonData.length < 2) {
                showToast("Excel fayl bo'sh! 📂", 'error');
                return;
            }

            currentExcelRows = jsonData.slice(1).map((row, idx) => ({
                tartib: row[0] || (idx + 1),
                mavzu: row[1] || '',
                uygaVazifa: row[2] || ''
            })).filter(r => r.mavzu);

            document.getElementById('excelPreviewInfo').textContent = `Sinf: ${selectedClass} | Fan: ${selectedSubject}`;
            document.getElementById('excelRowCount').textContent = `${currentExcelRows.length} ta mavzu`;
            document.getElementById('excelPreviewBody').innerHTML = currentExcelRows.slice(0, 15).map(r => `
                <tr><td class="p-3 font-mono">${r.tartib}</td><td class="p-3">${r.mavzu}</td><td class="p-3">${r.uygaVazifa}</td></tr>
            `).join('');

            document.getElementById('excelPreviewModal').classList.remove('hidden');
            document.getElementById('confirmExcelBtn').onclick = () => commitExcelUpload(selectedClass, selectedSubject);
        } catch (error) {
            console.error("Excel parse error", error);
            showToast("Faylni o'qishda xatolik ❌", 'error');
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
});

async function commitExcelUpload(sinf, subjectName) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        setBtnLoading(document.getElementById('confirmExcelBtn'), true);

        const allSubjects = await DbService.getAllSubjects() || {};
        const normalize = s => s.toString().trim().toLowerCase();

        let subjId = Object.keys(allSubjects).find(id =>
            allSubjects[id]?.name && normalize(allSubjects[id].name) === normalize(subjectName)
        );

        const updates = {};

        if (!subjId) {
            subjId = `S-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            updates[`subjects/${subjId}`] = {
                id: subjId,
                name: subjectName,
                icon: "📚",
                createdBy: user.uid,
                createdAt: Date.now(),
                classes: [parseInt(sinf)]
            };
        } else {
            const existing = allSubjects[subjId];
            const classes = new Set(existing.classes || []);
            classes.add(parseInt(sinf));
            updates[`subjects/${subjId}/classes`] = Array.from(classes).sort((a, b) => a - b);
        }

        const path = [];
        for (const row of currentExcelRows) {
            const lessonId = `L-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            updates[`subjects/${subjId}/lessons/${lessonId}`] = {
                id: lessonId,
                title: row.mavzu,
                order: parseInt(row.tartib) || 0,
                homework: row.uygaVazifa,
                sinf: parseInt(sinf),
                testGenerated: false,
                uploadedBy: user.uid,
                timestamp: Date.now()
            };
            path.push({ id: lessonId, order: parseInt(row.tartib) || 0 });
        }

        path.sort((a, b) => a.order - b.order);
        updates[`subjects/${subjId}/path`] = path.map(p => p.id);

        await DbService.commitBatchUpload(updates, `excel_${subjectName}`, user.uid);

        showToast(`${currentExcelRows.length} ta mavzu yuklandi! 🎉`, 'success');
        document.getElementById('excelPreviewModal').classList.add('hidden');
        document.getElementById('excelUploadSection').classList.add('hidden');
        loadTeacherSubjects();
    } catch (e) {
        console.error("Excel upload error", e);
        showToast("Yuklashda xatolik! ❌", 'error');
    } finally {
        setBtnLoading(document.getElementById('confirmExcelBtn'), false);
    }
}

// --- Save Test to DB ---
window.saveTestToDb = async function (subjectId, questions) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");

    const lessonId = `test_${Date.now()}`;
    await DbService.saveTest(subjectId, lessonId, { questions });
    return true;
};
