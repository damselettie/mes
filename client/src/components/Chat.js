import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import '../styles.css';
import { SERVER } from '../config';

export default function Chat({ username, token, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    fetch(`${SERVER}/messages`).then(r => r.json()).then(setMessages).catch(()=>{});
    const socket = io(SERVER, { auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => {
      console.log('socket connected', socket.id);
    });
    socket.on('message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    socket.on('users', (u) => setUsers(u));
    socket.on('connect_error', (err) => {
      console.warn('connect_error', err.message);
    });
    return () => socket.disconnect();
  }, [token]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  function send() {
    const t = text.trim();
    if (!t) return;
    socketRef.current.emit('message', { text: t });
    setText('');
  }

  return (
    <div className="chat">
      <div className="chat-panel">
        <div className="header">
          <div>Zalogowany jako: <b>{username}</b></div>
          <div>{onLogout && <button className="btn secondary" onClick={onLogout}>Wyloguj</button>}</div>
        </div>
        <div ref={listRef} className="messages">
          {messages.map(m => (
            <div key={m.id} className="message">
              <div className="meta">{m.username} · <span style={{color:'var(--muted)'}}>{new Date(m.time).toLocaleTimeString()}</span></div>
              <div>{m.text}</div>
            </div>
          ))}
        </div>
        <div className="input-row">
          <input className="input" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter' && send()} placeholder="Napisz wiadomość..." />
          <button className="btn" onClick={send}>Wyślij</button>
        </div>
      </div>

      <div className="sidebar">
        <div className="card">
          <h4>Online</h4>
          <ul className="online-list">
            {users.map((u, i) => <li key={i}>{u}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
