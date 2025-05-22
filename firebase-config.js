

// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyD0OdRSvkRRZN_UOR91Pc8sqyRwc_jC6ZU",
  authDomain: "servicehook.firebaseapp.com",
  databaseURL: "https://servicehook.firebaseio.com",
  projectId: "servicehook",
  storageBucket: "servicehook.firebasestorage.app",
  messagingSenderId: "352210796691",
  appId: "1:352210796691:web:ec5e8bf51fec086a600d66",
  measurementId: "G-PE6M06CB7X"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
