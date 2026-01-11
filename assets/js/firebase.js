import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyB-Bp_gjuChFhdGxRTPIb5w4zGS025ITx4",
    authDomain: "smarter-a99f4.firebaseapp.com",
    databaseURL: "https://smarter-a99f4-default-rtdb.firebaseio.com",
    projectId: "smarter-a99f4",
    storageBucket: "smarter-a99f4.firebasestorage.app",
    messagingSenderId: "201127037803",
    appId: "1:201127037803:web:32f85148679a0314645a2e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
