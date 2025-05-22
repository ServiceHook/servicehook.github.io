// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD0OdRSvkRRZN_UOR91Pc8sqyRwc_jC6ZU",
  authDomain: "servicehook.firebaseapp.com",
  projectId: "servicehook",
  storageBucket: "servicehook.firebasestorage.app",
  messagingSenderId: "352210796691",
  appId: "1:352210796691:web:ec5e8bf51fec086a600d66",
  measurementId: "G-PE6M06CB7X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);