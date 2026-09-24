import { addBook, getBooks, updateBook, deleteBook } from './db.js';
import { setupLibrary } from './setup.js';

const state = {
  books: [],
  filter: 'all',
  search: '',
  genre: 'all',
  deferredInstallPrompt: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function isOverdue(book) {
  if (!book.dueDate || book.status !== 'borrowed') return false;
  return new Date(`${book.dueDate}T23:59:59`) < new Date();
}

function effectiveStatus(book) {
  if (book.status === 'borrowed' && isOverdue(book)) return 'overdue';
  return book.status || 'available';
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function coverUrl(book) {
  if (book.coverImage) return book.coverImage;
  const isbn = String(book.isbn || '').replace(/[^0-9Xx]/g, '');
  if (isbn && isbn !== 'NA') {
    return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-M.jpg`;
  }
  return '';
}

function defaultCoverMarkup(book) {
  const title = escapeHtml(book.title || 'Book');
  const genre = escapeHtml(book.genre || 'Library');
  return `<div class="mini-cover generated-cover"><span>📚</span><small>${title}</small><em>${genre}</em></div>`;
}

function createCoverMarkup(book) {
  const src = coverUrl(book);
  if (!src) return defaultCoverMarkup(book);

  return `
    <div class="book-cover-wrap">
      <img class="book-cover" src="${escapeHtml(src)}" alt="Cover of ${escapeHtml(book.title || 'book')}"
        loading="lazy"
        onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
      <div class="cover-fallback hidden">${defaultCoverMarkup(book)}</div>
    </div>
  `;
}

function updateOfflineBanner() {
  const banner = $('#offlineBanner');
  if (!banner) return;

  const online = navigator.onLine;
  banner.innerHTML = online
    ? '<span>●</span> Online — changes are saved to Firebase.'
    : '<span>●</span> Offline — previously loaded books remain available.';
  banner.classList.toggle('offline', !online);
}

function setupCommonNavigation() {
  $('#menuBtn')?.addEventListener('click', () => $('#mobileNav')?.classList.toggle('open'));
  $$('#mobileNav a').forEach(link => link.addEventListener('click', () => $('#mobileNav')?.classList.remove('open')));

  const themeBtn = $('#themeBtn');
  const savedTheme = localStorage.getItem('keralareads-theme');
  if (savedTheme === 'dark') document.body.classList.add('dark');
  if (themeBtn) {
    themeBtn.textContent = document.body.classList.contains('dark') ? '☾' : '☼';
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      const dark = document.body.classList.contains('dark');
      localStorage.setItem('keralareads-theme', dark ? 'dark' : 'light');
      themeBtn.textContent = dark ? '☾' : '☼';
    });
  }
}

async function init() {
  setupCommonNavigation();
  updateOfflineBanner();
  window.addEventListener('online', updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);
  registerSW();

  setupInstallPrompt();

  if ($('#bookList')) {
    await setupLibrary();
    await loadBooks();
    setupLibraryControls();
  }
}

async function loadBooks() {
  const list = $('#bookList');
  if (list) list.innerHTML = '<p class="loading-books">Loading books...</p>';

  try {
    state.books = await getBooks();
    updateStats();
    updateGenreFilter();
    render();
  } catch (error) {
    console.error('Unable to load books:', error);
    if (list) {
      list.innerHTML = `<div class="load-error"><strong>Unable to load the library.</strong><span>Check your Firebase connection and refresh the page.</span></div>`;
    }
  }
}

function setupLibraryControls() {
  const addForm = $('#addForm');
  addForm?.addEventListener('submit', handleAddBook);

  $('#searchInput')?.addEventListener('input', event => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  $('#genreFilter')?.addEventListener('change', event => {
    state.genre = event.target.value;
    render();
  });

  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter || 'all';
      render();
    });
  });

  $('#coverImage')?.addEventListener('change', previewSelectedCover);
}

function render() {
  const list = $('#bookList');
  const empty = $('#emptyState');
  if (!list) return;

  const filtered = state.books.filter(book => {
    const status = effectiveStatus(book);
    const matchesFilter = state.filter === 'all' || status === state.filter;
    const haystack = `${book.title || ''} ${book.author || ''} ${book.genre || ''} ${book.isbn || ''}`.toLowerCase();
    const matchesSearch = haystack.includes(state.search);
    const matchesGenre = state.genre === 'all' || (book.genre || '') === state.genre;
    return matchesFilter && matchesSearch && matchesGenre;
  });

  list.innerHTML = '';
  if (!filtered.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  filtered.forEach(book => list.appendChild(createBookCard(book)));
}

function createBookCard(book) {
  const status = effectiveStatus(book);
  const card = document.createElement('article');
  card.className = `book-card ${status}`;

  const borrower = book.borrower ? `<div class="book-extra">👤 ${escapeHtml(book.borrower)}</div>` : '';
  const due = book.dueDate ? `<div class="book-extra">📅 Due ${escapeHtml(book.dueDate)}</div>` : '';
  const canDelete = document.body.dataset.role === 'admin';

  card.innerHTML = `
    ${createCoverMarkup(book)}
    <div class="book-card-body">
      <div class="book-top">
        <span class="book-status ${status}">${status === 'overdue' ? 'Overdue' : capitalize(status)}</span>
        <span class="book-mark">▰</span>
      </div>
      <h3>${escapeHtml(book.title || 'Untitled Book')}</h3>
      <p class="author">by ${escapeHtml(book.author || 'Unknown author')}</p>
      <div class="book-details">
        <span>🏷 ${escapeHtml(book.genre || 'General')}</span>
        <span>▦ ${escapeHtml(book.isbn || 'N/A')}</span>
      </div>
      ${borrower}${due}
      <div class="book-actions">
        <button class="small-btn primary-small" data-action="read">Read Preview</button>
        ${status === 'available'
          ? '<button class="small-btn" data-action="borrow">Borrow</button>'
          : '<button class="small-btn" data-action="return">Return</button>'}
        ${canDelete ? '<button class="small-btn danger" data-action="delete">Delete</button>' : ''}
      </div>
    </div>
  `;

  card.querySelector('[data-action="read"]')?.addEventListener('click', () => openReader(book));
  card.querySelector('[data-action="borrow"]')?.addEventListener('click', () => borrowBook(book.id));
  card.querySelector('[data-action="return"]')?.addEventListener('click', () => returnBook(book.id));
  card.querySelector('[data-action="delete"]')?.addEventListener('click', () => removeBook(book.id));
  return card;
}

function updateStats() {
  const total = state.books.length;
  const available = state.books.filter(b => effectiveStatus(b) === 'available').length;
  const borrowed = state.books.filter(b => effectiveStatus(b) === 'borrowed').length;
  const overdue = state.books.filter(b => effectiveStatus(b) === 'overdue').length;

  if ($('#totalCount')) $('#totalCount').textContent = total;
  if ($('#availableCount')) $('#availableCount').textContent = available;
  if ($('#borrowedCount')) $('#borrowedCount').textContent = borrowed;
  if ($('#overdueCount')) $('#overdueCount').textContent = overdue;
}

function updateGenreFilter() {
  const select = $('#genreFilter');
  if (!select) return;
  const current = state.genre;
  const genres = [...new Set(state.books.map(book => (book.genre || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="all">All Genres</option>' + genres.map(genre => `<option value="${escapeHtml(genre)}">${escapeHtml(genre)}</option>`).join('');
  select.value = genres.includes(current) ? current : 'all';
  state.genre = select.value;
}

async function handleAddBook(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  const author = String(data.get('author') || '').trim();
  const isbn = String(data.get('isbn') || '').trim() || 'N/A';
  const genre = String(data.get('genre') || '').trim() || 'General';
  const previewText = String(data.get('previewText') || '').trim();
  const coverFile = data.get('coverImage');

  if (!title || !author) {
    alert('Please enter the book title and author.');
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'Saving...'; }

  try {
    const coverImage = coverFile instanceof File && coverFile.size ? await compressCover(coverFile) : '';
    const book = {
      id: crypto.randomUUID(),
      title,
      author,
      isbn,
      genre,
      coverImage,
      status: 'available',
      dueDate: null,
      borrower: null,
      createdAt: new Date().toISOString(),
      previewPages: previewText ? makePreviewPages(title, author, genre, previewText) : undefined
    };

    if (!book.previewPages) delete book.previewPages;
    await addBook(book);
    form.reset();
    const preview = $('#coverPreview');
    if (preview) { preview.src = ''; preview.classList.add('hidden'); }
    await loadBooks();
    alert('Book added successfully.');
  } catch (error) {
    console.error(error);
    alert('The book could not be saved. Check your Firebase connection and try again.');
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = 'Save to My Library'; }
  }
}

function previewSelectedCover(event) {
  const file = event.target.files?.[0];
  const preview = $('#coverPreview');
  if (!preview || !file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image file.');
    event.target.value = '';
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
}

function compressCover(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 700;
      const maxH = 1000;
      const scale = Math.min(1, maxW / image.width, maxH / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.78;
      let result = canvas.toDataURL('image/jpeg', quality);
      while (result.length > 850000 && quality > 0.45) {
        quality -= 0.08;
        result = canvas.toDataURL('image/jpeg', quality);
      }
      if (result.length > 950000) {
        reject(new Error('Cover image is too large after compression.'));
      } else {
        resolve(result);
      }
    };
    image.onerror = reject;
    image.src = url;
  });
}

function makePreviewPages(title, author, genre, customText) {
  const paragraphs = customText.split(/\n\s*---PAGE---\s*\n/i).map(item => item.trim()).filter(Boolean);
  if (paragraphs.length >= 2) {
    return paragraphs.slice(0, 10).map((text, index) => ({ title: `Preview page ${index + 1}`, text }));
  }

  return [
    { title: 'Introduction', text: `Welcome to this KeralaReads preview of “${title}” by ${author}. This short introduction is provided as a reading sample and overview, not as a reproduction of the full book.` },
    { title: 'About the book', text: `The book is listed in the ${genre} category. This page helps a reader understand the subject, style and purpose of the work before choosing whether to borrow or explore it further.` },
    { title: 'What to expect', text: `A good preview introduces the central theme without replacing the original work. Use this page to note the questions, ideas or experiences that the book may invite you to explore.` },
    { title: 'Reading guide', text: `Read the preview slowly and consider what you already know about the topic. You can use the library controls to borrow the book after deciding that it is relevant to your interests.` },
    { title: 'Preview complete', text: `You have reached the end of the KeralaReads introduction. The complete work remains separate from this short preview. Use Borrow to track the physical library copy when it is available.` }
  ];
}

function fallbackPreview(book) {
  if ((book.title || '').toLowerCase() === 'atomic habits') {
    return [
      { title: 'Introduction', text: 'This is an original KeralaReads five-page introduction to Atomic Habits. It summarizes ideas readers can explore without reproducing the copyrighted book.' },
      { title: 'Page 2 — Small changes', text: 'Meaningful improvement can begin with small actions that are repeated consistently. Instead of depending on a dramatic burst of motivation, a reader can examine everyday routines and choose one manageable change.' },
      { title: 'Page 3 — Systems', text: 'Goals describe outcomes, while systems describe the repeated process used to move toward them. A supportive environment can make a useful behaviour easier to repeat.' },
      { title: 'Page 4 — Identity', text: 'Habits can be connected to identity: repeated actions provide evidence about the person we want to become. This perspective shifts attention from one result toward daily behaviour.' },
      { title: 'Page 5 — Making habits easier', text: 'A practical routine can be made more visible, attractive, simple and satisfying. This preview gives a short introduction; it is not a substitute for the original book.' }
    ];
  }
  return makePreviewPages(book.title || 'Book', book.author || 'Unknown author', book.genre || 'General', '');
}

function openReader(book) {
  const pages = Array.isArray(book.previewPages) && book.previewPages.length ? book.previewPages : fallbackPreview(book);
  let index = 0;

  let modal = $('#readerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'readerModal';
    modal.className = 'reader-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="reader-panel" role="dialog" aria-modal="true" aria-label="Book preview">
      <div class="reader-header">
        <div><span class="eyebrow">Reading Preview</span><h2>${escapeHtml(book.title || 'Book')}</h2><p>by ${escapeHtml(book.author || '')}</p></div>
        <button class="reader-close" aria-label="Close reader">×</button>
      </div>
      <div class="reader-progress"><span id="readerProgress"></span></div>
      <article class="reader-page">
        <span class="reader-page-number" id="readerPageNumber"></span>
        <h3 id="readerPageTitle"></h3>
        <p id="readerPageText"></p>
      </article>
      <div class="reader-controls">
        <button class="small-btn" id="readerPrev">← Previous</button>
        <span id="readerCounter"></span>
        <button class="small-btn primary-small" id="readerNext">Next →</button>
      </div>
      <p class="reader-note">Short introduction / preview only — not the full book.</p>
    </div>
  `;

  const pageNumber = $('#readerPageNumber');
  const pageTitle = $('#readerPageTitle');
  const pageText = $('#readerPageText');
  const counter = $('#readerCounter');
  const progress = $('#readerProgress');
  const prev = $('#readerPrev');
  const next = $('#readerNext');

  const renderPage = () => {
    const page = pages[index];
    pageNumber.textContent = `Page ${index + 1}`;
    pageTitle.textContent = page.title || `Page ${index + 1}`;
    pageText.textContent = page.text || '';
    counter.textContent = `${index + 1} / ${pages.length}`;
    progress.style.width = `${((index + 1) / pages.length) * 100}%`;
    prev.disabled = index === 0;
    next.disabled = index === pages.length - 1;
  };

  const close = () => modal.remove();
  modal.querySelector('.reader-close').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  prev.addEventListener('click', () => { if (index > 0) { index--; renderPage(); } });
  next.addEventListener('click', () => { if (index < pages.length - 1) { index++; renderPage(); } });
  document.addEventListener('keydown', function onKey(event) {
    if (!document.body.contains(modal)) { document.removeEventListener('keydown', onKey); return; }
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight' && index < pages.length - 1) { index++; renderPage(); }
    if (event.key === 'ArrowLeft' && index > 0) { index--; renderPage(); }
  });

  renderPage();
}

async function borrowBook(id) {
  const book = state.books.find(item => item.id === id);
  if (!book) return;
  const borrower = prompt(`Who is borrowing “${book.title}”?`);
  if (!borrower?.trim()) return;

  const due = new Date();
  due.setDate(due.getDate() + 14);
  const updated = { ...book, status: 'borrowed', borrower: borrower.trim(), dueDate: due.toISOString().split('T')[0] };

  try {
    await updateBook(updated);
    await loadBooks();
  } catch (error) {
    console.error(error);
    alert('Unable to borrow this book.');
  }
}

async function returnBook(id) {
  const book = state.books.find(item => item.id === id);
  if (!book || !confirm(`Return “${book.title}” to the library?`)) return;

  try {
    await updateBook({ ...book, status: 'available', borrower: null, dueDate: null });
    await loadBooks();
  } catch (error) {
    console.error(error);
    alert('Unable to return this book.');
  }
}

async function removeBook(id) {
  const book = state.books.find(item => item.id === id);
  if (!book || !confirm(`Delete “${book.title}”?`)) return;

  try {
    await deleteBook(id);
    await loadBooks();
  } catch (error) {
    console.error(error);
    alert('Unable to delete this book.');
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    ['#installBtn', '#installTopBtn'].forEach(selector => {
      const button = $(selector);
      if (button) button.hidden = false;
    });
  });

  ['#installBtn', '#installTopBtn'].forEach(selector => {
    $(selector)?.addEventListener('click', async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      ['#installBtn', '#installTopBtn'].forEach(item => { if ($(item)) $(item).hidden = true; });
    });
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker registration failed:', error));
  }
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
}

document.addEventListener('DOMContentLoaded', init);
