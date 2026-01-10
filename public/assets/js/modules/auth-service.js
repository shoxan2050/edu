/**
 * AuthService - Singleton for Authentication State Management
 * Provides a Promise-based API. No global state pollution.
 */

import { auth, db } from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

class AuthServiceClass {
    constructor() {
        this._user = undefined; // undefined = not yet checked, null = logged out
        this._userDataPromise = null;
        this._initPromise = this._initialize();
    }

    _initialize() {
        return new Promise((resolve) => {
            onAuthStateChanged(auth, async (firebaseUser) => {
                if (firebaseUser) {
                    // Fetch user data from DB
                    try {
                        const snap = await get(ref(db, `users/${firebaseUser.uid}`));
                        this._user = {
                            ...firebaseUser,
                            dbData: snap.exists() ? snap.val() : {}
                        };
                    } catch (e) {
                        console.error("AuthService: Failed to fetch user data", e);
                        this._user = firebaseUser; // Fallback to Firebase user only
                    }
                } else {
                    this._user = null;
                }
                resolve(this._user);
            });
        });
    }

    /**
     * Get current user. Returns a promise that resolves when auth state is known.
     * @returns {Promise<Object|null>}
     */
    async getCurrentUser() {
        if (this._user === undefined) {
            await this._initPromise;
        }
        return this._user;
    }

    /**
     * Check if user is authenticated.
     * @returns {Promise<boolean>}
     */
    async isAuthenticated() {
        const user = await this.getCurrentUser();
        return user !== null;
    }

    /**
     * Get user role.
     * @returns {Promise<string>}
     */
    async getRole() {
        const user = await this.getCurrentUser();
        return user?.dbData?.role || 'student';
    }

    /**
     * Get Firebase Auth instance for direct operations (login, logout, etc.)
     */
    getAuth() {
        return auth;
    }
}

// Singleton Export
export const AuthService = new AuthServiceClass();
