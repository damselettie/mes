const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

const app = express();
app.use(cors());
app.use(express.json());

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
    io.emit('users', Object.values(online));
  }

  socket.on('message', (payload) => {
    if (!payload || !payload.text) return;
    const username = socket.user && socket.user.username ? socket.user.username : 'Anon';
    const msg = db.addMessage({ username, text: payload.text });
    io.emit('message', msg);
  });

  socket.on('disconnect', () => {
    delete online[socket.id];
    io.emit('users', Object.values(online));
    console.log('disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on ${PORT}`));
