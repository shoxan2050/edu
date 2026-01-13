import { auth, db } from './firebase.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
    ref,
    set,
    update,
    get
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const getFriendlyErrorMessage = (code) => {
    switch (code) {
        case 'auth/user-not-found': return "Foydalanuvchi topilmadi. 👤";
        case 'auth/wrong-password': return "Parol noto'g'ri. 🔑";
        case 'auth/email-already-in-use': return "Ushbu email allaqachon ro'yxatdan o'tgan. 📧";
        case 'auth/invalid-email': return "Email formati noto'g'ri. 📬";
        case 'auth/weak-password': return "Parol juda kuchsiz (kamida 6 ta belgi). 🛡️";
        case 'auth/network-request-failed': return "Internet bilan muammo yuz berdi. 🌐";
        default: return "Kutilmagan xato yuz berdi. Iltimos qaytadan urinib ko'ring.";
    }
};

// Toast Notification Utility
export const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 px-6 py-3 rounded-2xl text-white font-bold shadow-2xl transform transition-all duration-300 translate-y-20 z-[100] ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-20'), 100);
    setTimeout(() => {
        toast.classList.add('translate-y-20');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Loading State Utility
export const setBtnLoading = (btn, isLoading) => {
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    } else {
        btn.innerHTML = btn.dataset.originalText;
        btn.disabled = false;
    }
};

// Registration Logic
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const name = document.getElementById('name').value;
        const userClass = document.getElementById('class').value;
        const role = document.getElementById('role').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            showToast("Parollar mos kelmadi! ❌", 'error');
            return;
        }

        setBtnLoading(btn, true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Get phone number (for password recovery)
            const phone = document.getElementById('phone1')?.value || '';

            // Get school info (for students)
            const viloyat = document.getElementById('viloyat')?.value || null;
            const tuman = document.getElementById('tuman')?.value || null;
            const maktab = document.getElementById('maktab')?.value || null;

            const userData = {
                uid: user.uid,
                name,
                sinf: role === 'teacher' ? null : userClass, // No class for teachers
                role,
                email,
                phone, // Phone for ALL users
                viloyat: role === 'teacher' ? null : viloyat,
                tuman: role === 'teacher' ? null : tuman,
                maktab: role === 'teacher' ? null : maktab,
                streak: 0,
                lastActive: null,
                progress: {}
            };

            await set(ref(db, 'users/' + user.uid), userData);
            localStorage.setItem("user", JSON.stringify(userData));

            showToast("Hisob muvaffaqiyatli yaratildi! 🎉");
            setTimeout(() => window.location.href = '/dashboard', 1500);
        } catch (error) {
            showToast(getFriendlyErrorMessage(error.code), 'error');
        } finally {
            setBtnLoading(btn, false);
        }
    });
}

// Login Logic
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember').checked;

        setBtnLoading(btn, true);
        try {
            await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const snapshot = await get(ref(db, 'users/' + user.uid));
            if (snapshot.exists()) {
                let userData = snapshot.val();
                userData.uid = user.uid;

                // Streak Logic (Timezone Robust)
                const now = new Date();
                const lastActiveDate = userData.lastActive ? new Date(userData.lastActive) : null;
                const todayStr = now.toLocaleDateString('sv'); // YYYY-MM-DD

                if (lastActiveDate) {
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = yesterday.toLocaleDateString('sv');
                    const lastActiveStr = lastActiveDate.toLocaleDateString('sv');

                    if (lastActiveStr === todayStr) {
                        // Already active today, do nothing
                    } else if (lastActiveStr === yesterdayStr) {
                        // Consecutive day
                        userData.streak = (userData.streak || 0) + 1;
                    } else {
                        // Gap of more than 1 day
                        userData.streak = 1;
                    }
                } else {
                    userData.streak = 1;
                }

                userData.lastActive = now;
                await update(ref(db, 'users/' + user.uid), {
                    lastActive: userData.lastActive,
                    streak: userData.streak
                });
                // localStorage.setItem("user", JSON.stringify(userData)); // Optional: update local cache if needed, but rely on DB usually

                showToast(`Xush kelibsiz, ${userData.name}! 👋`);

                // Redirect based on role from Firebase
                let targetPage = '/dashboard';
                if (userData.role === 'admin') {
                    targetPage = '/admin';
                } else if (userData.role === 'teacher') {
                    targetPage = '/teacher';
                }

                setTimeout(() => {
                    window.location.href = targetPage;
                }, 1000);
            }
        } catch (error) {
            showToast(getFriendlyErrorMessage(error.code), 'error');
        } finally {
            setBtnLoading(btn, false);
        }
    });
}

export const logout = async () => {
    localStorage.removeItem("user");
    await signOut(auth);
    window.location.href = '/login';
};

// Multi-Step Registration Handler
document.addEventListener('multiStepRegister', async (e) => {
    const data = e.detail;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
        const user = userCredential.user;

        const userData = {
            uid: user.uid,
            name: data.name,
            sinf: data.sinf,
            role: data.role || 'student',
            email: data.email,
            phone: '',
            viloyat: data.viloyat,
            tuman: data.tuman,
            maktab: data.maktab,
            // Onboarding data
            goal: data.goal || null,           // til, it, matematika
            level: data.level || null,         // beginner, intermediate, advanced
            schedule: data.schedule || null,   // 3, 5, 7 (days per week)
            streak: 0,
            lastActive: null,
            progress: {}
        };

        await set(ref(db, 'users/' + user.uid), userData);
        localStorage.setItem("user", JSON.stringify(userData));

        showToast("Hisob muvaffaqiyatli yaratildi! 🎉");
        setTimeout(() => window.location.href = '/dashboard', 1500);
    } catch (error) {
        showToast(getFriendlyErrorMessage(error.code), 'error');
        const btn = document.getElementById('continueBtn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Qayta urinish";
        }
    }
});

// Multi-Step Login Handler
document.addEventListener('multiStepLogin', async (e) => {
    const data = e.detail;

    try {
        await setPersistence(auth, browserLocalPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
        const user = userCredential.user;

        const userSnap = await get(ref(db, 'users/' + user.uid));
        const userData = userSnap.val();

        if (userData) {
            localStorage.setItem("user", JSON.stringify({
                uid: user.uid,
                email: user.email,
                ...userData
            }));

            // Update last active
            await update(ref(db, 'users/' + user.uid), { lastActive: Date.now() });

            showToast("Muvaffaqiyatli kirishingiz! 🎉");

            // Redirect based on role
            if (userData.role === 'teacher') {
                setTimeout(() => window.location.href = '/teacher', 1500);
            } else if (userData.role === 'admin') {
                setTimeout(() => window.location.href = '/admin', 1500);
            } else {
                setTimeout(() => window.location.href = '/dashboard', 1500);
            }
        }
    } catch (error) {
        showToast(getFriendlyErrorMessage(error.code), 'error');
        const btn = document.getElementById('continueBtn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Qayta urinish";
        }
    }
});
