import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { logout, showToast, setBtnLoading } from './auth.js';
import { DbService } from './modules/db-service.js';
import { AiService } from './modules/ai-service.js';
import { ExcelService } from './modules/excel-service.js';

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("user");
        window.location.href = 'login.html';
        return;
    }

    try {
        const userData = await DbService.getSubject(`users/${user.uid}`); // Reuse getSubject as generic fetcher for simplicity or rename it
        if (userData && userData.role !== 'teacher') {
            window.location.href = 'dashboard.html';
            return;
        }
    } catch (e) {
        console.error("Auth check error", e);
    }

    loadTeacherSubjects();
});

async function loadTeacherSubjects() {
    const list = document.getElementById('teacherSubjects');
    if (!list) return;

    try {
        const subjects = await DbService.getAllSubjects();
        if (Object.keys(subjects).length === 0) {
            list.innerHTML = `<div class="col-span-full py-10 text-center text-gray-400">Hali fanlar qo'shilmagan. Excel fayl yuklang!</div>`;
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
                        <button class="flex-grow py-3 bg-gray-50 text-gray-600 rounded-xl font-semibold hover:bg-gray-100 transition">Boshqarish</button>
                        ${needsAI ? `
                            <button onclick="window.generateAI('${id}')" class="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition" title="AI Test Generatsiya">
                                🪄
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Subjects load error", error);
    }
}

// Global helper for AI generation
window.generateAI = async (subjectId, event) => {
    try {
        const subjectData = await DbService.getSubject(subjectId);
        if (!subjectData) {
            showToast("Fan topilmadi! ❌", 'error');
            return;
        }

        const lessons = subjectData.lessons || {};
        const lessonKeys = Object.keys(lessons);
        const lessonsToGenerate = lessonKeys.filter(key => lessons[key].testGenerated === false);

        if (lessonsToGenerate.length === 0) {
            showToast("Barcha testlar allaqachon generatsiya qilingan! ✅", 'success');
            return;
        }

        const btn = event?.target?.closest('button');
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
            btn.textContent = '⌛';
        }

        showToast(`${subjectData.name} uchun ${lessonsToGenerate.length} ta test generatsiyasi boshlandi... 🤖`, 'success');

        let successCount = 0;
        for (const key of lessonsToGenerate) {
            const lesson = lessons[key];

            // Cooldown check: 24h
            if (lesson.lastGenerated && Date.now() - lesson.lastGenerated < 24 * 60 * 60 * 1000) {
                console.log(`Skipping ${lesson.title}: Cooldown active`);
                continue;
            }

            try {
                const testData = await AiService.generateTest(lesson.title, subjectId, key);
                await DbService.saveTest(subjectId, key, testData);
                successCount++;
            } catch (err) {
                console.error(`Error generating test:`, err);
                showToast(`${lesson.title}: ${err.message}`, 'error');
            }
        }

        if (successCount > 0) showToast(`${successCount} ta test muvaffaqiyatli generatsiya qilindi! 🎉`, 'success');
        loadTeacherSubjects();
    } catch (error) {
        console.error("AI Generation Process Error:", error);
        showToast("Jarayonda kutilmagan xatolik! ❌", 'error');
    }
};

// --- Excel Engine Phase 4 ---
let currentExcelData = null;
let currentMapping = {};
let currentFile = null;

document.getElementById('excelInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentFile = file;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            if (jsonData.length === 0) {
                showToast("Excel fayl bo'sh! 📂", 'error');
                return;
            }

            currentExcelData = jsonData;
            const headers = Object.keys(jsonData[0]);
            currentMapping = ExcelService.autoMap(headers);

            showExcelPreview(headers);
        } catch (error) {
            console.error("Excel parse error", error);
            showToast("Faylni o'qishda xatolik yuz berdi ❌", 'error');
        } finally {
            e.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
});

function showExcelPreview(headers) {
    const modal = document.getElementById('excelPreviewModal');
    modal.classList.remove('hidden');

    renderMappingUI(headers);
    updatePreview();
}

function renderMappingUI(headers) {
    const grid = document.getElementById('mappingGrid');
    grid.innerHTML = ExcelService.canonicalKeys.map(key => `
        <div class="flex flex-col gap-1">
            <label class="text-xs font-bold text-gray-500 uppercase">${key}</label>
            <select onchange="updateMapping('${key}', this.value)" class="p-2 bg-white border border-gray-200 rounded-lg text-sm">
                <option value="">-- Tanlang --</option>
                ${headers.map(h => `<option value="${h}" ${currentMapping[key] === h ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
        </div>
    `).join('');
}

window.updateMapping = (canonical, header) => {
    currentMapping[canonical] = header;
    updatePreview();
};

function updatePreview() {
    const report = ExcelService.validateRows(currentExcelData, currentMapping);

    // Header
    const headerRow = document.getElementById('previewHeader');
    headerRow.innerHTML = `
        <th class="p-4">#</th>
        ${ExcelService.canonicalKeys.map(k => `<th class="p-4">${k}</th>`).join('')}
        <th class="p-4">Holat</th>
    `;

    // Body (top 10 rows)
    const body = document.getElementById('previewBody');
    body.innerHTML = report.rows.slice(0, 10).map(row => `
        <tr class="${row.isError ? 'error-row' : ''}">
            <td class="p-4 font-mono text-gray-400">${row.data._rowIndex}</td>
            <td class="p-4">${row.data.fan || '-'}</td>
            <td class="p-4">${row.data.tartib || '-'}</td>
            <td class="p-4">${row.data.mavzu || '-'}</td>
            <td class="p-4">${row.data.uygavazifa || '-'}</td>
            <td class="p-4">${row.data.sinf || '-'}</td>
            <td class="p-4">
                ${row.isError ? `<span class="error-cell">❌ ${row.errors[0]}</span>` : '<span class="text-emerald-600 font-bold">✅ OK</span>'}
            </td>
        </tr>
    `).join('');

    const summary = document.getElementById('validationSummary');
    summary.innerHTML = `
        <span class="text-emerald-600">${report.validCount} ta to'g'ri</span>, 
        <span class="text-rose-600">${report.errorCount} ta xato</span> 
        (Jami: ${report.rows.length})
    `;

    const confirmBtn = document.getElementById('confirmUploadBtn');
    confirmBtn.disabled = report.errorCount > 0;
    confirmBtn.classList.toggle('opacity-50', report.errorCount > 0);
}

document.getElementById('confirmUploadBtn').onclick = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const report = ExcelService.validateRows(currentExcelData, currentMapping);
    if (report.errorCount > 0) return;

    setBtnLoading(document.getElementById('confirmUploadBtn'), true);

    try {
        const updates = {};
        const subjectMeta = {}; // To store subject-level changes (classes, path)

        for (const row of report.rows) {
            const d = row.data;
            const subjName = d.fan;
            // Strategy: Use generic ID if subject exists by name, or generate new UUID
            // For this phase, let's normalize name as ID to keep it searchable but internally use UUIDs for lessons
            const subjId = subjName.toLowerCase().replace(/\s+/g, '-');
            const lessonId = ExcelService.generateId('L');

            if (!subjectMeta[subjId]) {
                const existing = await DbService.getSubject(subjId);
                subjectMeta[subjId] = {
                    id: subjId,
                    name: subjName,
                    path: existing?.path || [],
                    classes: new Set(existing?.classes || []),
                    lessonsCount: 0
                };
            }

            subjectMeta[subjId].classes.add(d.sinf);
            subjectMeta[subjId].path.push(lessonId); // Append to path

            updates[`subjects/${subjId}/id`] = subjId;
            updates[`subjects/${subjId}/name`] = subjName;
            updates[`subjects/${subjId}/icon`] = "📚";
            updates[`subjects/${subjId}/createdBy`] = user.uid;

            updates[`subjects/${subjId}/lessons/${lessonId}`] = {
                id: lessonId,
                title: d.mavzu,
                order: d.tartib, // Order is now just clinical/display, not the PK
                homework: d.uygavazifa,
                sinf: d.sinf,
                testGenerated: false,
                uploadedBy: user.uid,
                timestamp: Date.now()
            };
        }

        // Finalize subject-level fields
        for (const subjId in subjectMeta) {
            const m = subjectMeta[subjId];
            updates[`subjects/${subjId}/path`] = m.path;
            updates[`subjects/${subjId}/classes`] = Array.from(m.classes).sort((a, b) => a - b);
        }

        await DbService.commitBatchUpload(updates, currentFile.name, user.uid);

        showToast("Ma'lumotlar muvaffaqiyatli saqlandi! 🎉");
        document.getElementById('excelPreviewModal').classList.add('hidden');
        loadTeacherSubjects();
    } catch (e) {
        console.error("Confirm upload error", e);
        showToast("Serverga yuklashda xatolik yuz berdi ❌", 'error');
    } finally {
        setBtnLoading(document.getElementById('confirmUploadBtn'), false);
    }
};

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.onclick = logout;
