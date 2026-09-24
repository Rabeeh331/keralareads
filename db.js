import { db } from './firebase-config.js';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const booksCollection = collection(db, 'books');

export async function addBook(book) {
  await setDoc(doc(db, 'books', book.id), book);
  return book;
}

export async function getBooks() {
  const snapshot = await getDocs(booksCollection);
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function updateBook(book) {
  const { id, ...data } = book;
  await updateDoc(doc(db, 'books', id), data);
  return book;
}

export async function deleteBook(id) {
  await deleteDoc(doc(db, 'books', id));
}
