import { addBook, getBooks } from './db.js';

const SAMPLE_BOOKS = [
  {
    id: 'kr-atomic-habits',
    title: 'Atomic Habits',
    author: 'James Clear',
    isbn: '9780735211292',
    genre: 'Self Help',
    status: 'available',
    dueDate: null,
    borrower: null,
    coverImage: '',
    previewPages: [
      {
        title: 'Introduction',
        text: 'This preview is an original five-page introduction created for KeralaReads. It is a concise guide to the ideas readers can expect from Atomic Habits, not a reproduction of the book.'
      },
      {
        title: 'Page 2 — Small Changes',
        text: 'A useful starting point is the idea that meaningful improvement can come from small, repeatable actions. Instead of waiting for a dramatic transformation, a reader can look at ordinary routines and ask which tiny change would make the next action easier.'
      },
      {
        title: 'Page 3 — Systems and Routines',
        text: 'Goals describe a destination, while systems describe the repeated process used to move toward it. A practical habit is easier to maintain when the environment and routine support the behaviour rather than relying only on motivation.'
      },
      {
        title: 'Page 4 — Identity and Habits',
        text: 'Habits can also be viewed as expressions of identity. Repeated actions provide evidence about the kind of person someone wants to become. This perspective shifts attention from a single result to the daily behaviour that supports it.'
      },
      {
        title: 'Page 5 — Making Habits Easier',
        text: 'A good routine can be made more visible, attractive, simple and satisfying. KeralaReads presents this preview as a short reading experience so users can understand the book topic before deciding whether to borrow or explore it further.'
      }
    ]
  }
];

export async function setupLibrary() {
  try {
    const existing = await getBooks();
    const existingIds = new Set(existing.map(book => book.id));

    for (const book of SAMPLE_BOOKS) {
      if (!existingIds.has(book.id)) {
        await addBook(book);
      }
    }
  } catch (error) {
    console.warn('Sample library setup skipped:', error);
  }
}
