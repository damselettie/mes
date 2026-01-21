const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

const app = express();
app.use(cors());
app.use(express.json());

// File upload setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const online = {};

/*
opis do zdarzen obsługi błędów nieobsłużonych obietnic i wyjątków 
@param {Error} err - reason
*/
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && (err.stack || err.message || err));
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

app.get('/', (req, res) => res.send('Messenger server is running'));

app.get('/messages', (req, res) => res.json(db.getMessages()));

app.get('/users', (req, res) => {
  res.json(Object.values(online));
});

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.originalname });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password required' });
  }
  const existing = db.findUser(username);
  if (existing) return res.status(409).json({ error: 'user_exists' });
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const user = db.createUser({ username, passwordHash: hash });
  if (!user) return res.status(500).json({ error: 'failed' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = db.findUser(username);
  if (!user) return res.status(401).json({ error: 'invalid' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid' });
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('unauthenticated'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = { id: payload.id, username: payload.username };
    return next();
  } catch (e) {
    return next(new Error('unauthenticated'));
  }
});

io.on('connection', (socket) => {
  console.log('connected', socket.id, socket.user && socket.user.username);
  if (socket.user && socket.user.username) {
    online[socket.id] = socket.user.username;
    const allUsers = db.getUsers().map(u => ({
      username: u.username,
      online: Object.values(online).includes(u.username)
    }));
    io.emit('users', allUsers);
    
    // Send pending messages to the user
    const pendingMessages = db.getPendingMessages(socket.user.username);
    if (pendingMessages.length > 0) {
      socket.emit('pending_messages', pendingMessages);
      db.clearPendingMessages(socket.user.username);
    }
  }

  socket.on('message', (payload) => {
    if (!payload || !payload.text) return;
    const username = socket.user && socket.user.username ? socket.user.username : 'Anon';
    const msg = db.addMessage({ username, text: payload.text });
    io.emit('message', msg);
  });

  socket.on('private_message', (payload) => {
    if (!payload || !payload.to || !payload.text) return;
    const from = socket.user && socket.user.username;
    if (!from) return;
    const msg = { id: Date.now() + Math.random().toString(36).slice(2, 9), from, to: payload.to, text: payload.text, time: new Date().toISOString() };
    // Find socket of recipient
    const recipientSocket = Object.keys(online).find(id => online[id] === payload.to);
    if (recipientSocket) {
      io.to(recipientSocket).emit('private_message', msg);
      io.to(recipientSocket).emit('notification', { from, text: payload.text }); // Send notification
      io.to(socket.id).emit('private_message', msg); // also send to sender
    } else {
      // User is offline - save the message for later
      db.addPendingMessage({ to: payload.to, from, text: payload.text });
      // Still send confirmation to sender
      io.to(socket.id).emit('private_message', msg);
    }
  });

  socket.on('disconnect', () => {
    delete online[socket.id];
    const allUsers = db.getUsers().map(u => ({
      username: u.username,
      online: Object.values(online).includes(u.username)
    }));
    io.emit('users', allUsers);
    console.log('disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on ${PORT}`));
