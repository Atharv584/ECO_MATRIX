import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// ⚠️ Replace these with your actual Firebase project config
// Get them from: https://console.firebase.google.com → Project Settings → General → Your apps
const firebaseConfig = {
    apiKey: "AIzaSyBJ_lO2GCqtZ4hRX-dCw4bQAU5X_A4Sv2k",
    authDomain: "eco-matrix-53dac.firebaseapp.com",
    projectId: "eco-matrix-53dac",
    storageBucket: "eco-matrix-53dac.firebasestorage.app",
    messagingSenderId: "1060570417878",
    appId: "1:1060570417878:web:1747850211111",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
