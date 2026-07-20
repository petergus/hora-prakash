// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

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
// Region must match where functions/index.js deploys the /buro callables.
export const functions = getFunctions(app, 'europe-west6')

// Keep the user logged in across reloads
setPersistence(auth, browserLocalPersistence).catch(() => {})
