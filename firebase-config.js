// firebase-config.js
// Konfigurasi Firebase - Dirgantara Jaya App

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOD6F7dQ6GWRx2Z2SG8RIyBSp7KJKWIZA",
  authDomain: "dirgantara-jaya-app.firebaseapp.com",
  projectId: "dirgantara-jaya-app",
  storageBucket: "dirgantara-jaya-app.firebasestorage.app",
  messagingSenderId: "334495959678",
  appId: "1:334495959678:web:b49c37d3071f8eacdc662f",
  measurementId: "G-L4HZPPS9XR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export fungsi Firestore yang akan dipakai
export {
  db,
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy
};
