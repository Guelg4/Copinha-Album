/* =========================================================
   firebase-config.js — Álbum Copinha
   ========================================================= */
const firebaseConfig = {
  apiKey:            "AIzaSyDhi3PAO9FHq_IZ8tM1HpnK7R4lGt3mVpQ",
  authDomain:        "album-copinha.firebaseapp.com",
  projectId:         "album-copinha",
  storageBucket:     "album-copinha.firebasestorage.app",
  messagingSenderId: "791583378158",
  appId:             "1:791583378158:web:be36be42e2eadcfbcb01ff"
};

firebase.initializeApp(firebaseConfig);

/* Desativa reCAPTCHA Enterprise no Auth */
const auth = firebase.auth();
auth.settings.appVerificationDisabledForTesting = false;

/* Força uso do reCAPTCHA v2 em vez do Enterprise */
firebase.auth().useDeviceLanguage();

const db = firebase.firestore();