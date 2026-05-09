// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyA9L3xTl8NkxapU-SD__eefbcbRcYUUPj4',
  authDomain: 'astro1-df340.firebaseapp.com',
  projectId: 'astro1-df340',
  storageBucket: 'astro1-df340.firebasestorage.app',
  messagingSenderId: '562936426781',
  appId: '1:562936426781:web:c068f0cad1455e3c7e71f4',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Keep the user logged in across reloads
setPersistence(auth, browserLocalPersistence).catch(() => {})
