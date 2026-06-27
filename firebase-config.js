/* =========================================================
   firebase-config.js — Álbum Copinha
   ========================================================= */
const firebaseConfig = {
  apiKey:            "AIzaSyCqam6xaSiYE2ax8F7uBZHoRNr_m0XPGNA",
  authDomain:        "album-copinha.firebaseapp.com",
  projectId:         "album-copinha",
  storageBucket:     "album-copinha.firebasestorage.app",
  messagingSenderId: "791583378158",
  appId:             "1:791583378158:web:be36be42e2eadcfbcb01ff"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();