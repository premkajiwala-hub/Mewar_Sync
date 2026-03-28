
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_5XDWU8fWG3KdGGpqKQi2_oBFp-B2lBw",
  authDomain: "mewar-sync-1e32e.firebaseapp.com",
  projectId: "mewar-sync-1e32e",
  storageBucket: "mewar-sync-1e32e.firebasestorage.app",
  messagingSenderId: "1028215744156",
  appId: "1:1028215744156:web:674d388cee1d59419c2f59",
  measurementId: "G-H6SW3CFCBN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
