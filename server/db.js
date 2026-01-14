const fs = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, 'store.json');

let store = { messages: [], users: [] };
/*
  opis funkcji zapisywania stanu do pliku store.json 
*/
function saveStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save store:', e);
  }
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      saveStore();
      return;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      store = parsed || { messages: [], users: [] };
      store.messages = store.messages || [];
      store.users = store.users || [];
    } catch (parseErr) {
      console.error('store.json is invalid JSON, creating backup and resetting store:', parseErr);
      try {
        const bak = STORE_FILE + '.bak.' + Date.now();
        fs.renameSync(STORE_FILE, bak);
        console.error('Backed up corrupted store to', bak);
      } catch (renameErr) {
        console.error('Failed to backup corrupted store.json:', renameErr);
      }
      store = { messages: [], users: [] };
      saveStore();
    }
  } catch (e) {
    console.error('Failed to load store:', e);
  }
}

loadStore();

// messages
function addMessage({ username, text }) {
  const msg = {
    id: Date.now() + Math.random().toString(36).slice(2, 9),
    username,
    text,
    time: new Date().toISOString()
  };
  store.messages.push(msg);
  if (store.messages.length > 200) store.messages.shift();
  saveStore();
  return msg;
}

function getMessages() {
  return store.messages.slice();
}

// users
function findUser(username) {
  return store.users.find(u => u.username === username);
}

function createUser({ username, passwordHash }) {
  if (findUser(username)) return null;
  const user = {
    id: Date.now() + Math.random().toString(36).slice(2, 9),
    username,
    passwordHash,
    createdAt: new Date().toISOString()
  };
  store.users.push(user);
  saveStore();
  return user;
}

module.exports = { addMessage, getMessages, findUser, createUser };
