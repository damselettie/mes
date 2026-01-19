import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import '../styles.css';
import { SERVER } from '../config';
import EmojiPicker from 'emoji-picker-react';

export default function Chat({ username, token, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showKaomojis, setShowKaomojis] = useState(false);
  const [privateChat, setPrivateChat] = useState(null); // username for private chat
  const [privateMessages, setPrivateMessages] = useState([]);
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  const kaomojis = ['(≧ω≦)', '(⌒‿⌒)', '〜(꒪꒳꒪)〜', '(；ω；)', '(≧▽≦)', '♡(｡>ω<｡)', '(^_^)', ';_;', '<3'];

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
    socket.on('private_message', (msg) => {
      setPrivateMessages(prev => [...prev, msg]);
    });
    socket.on('users', (u) => setUsers(u));
    socket.on('connect_error', (err) => {
      console.warn('connect_error', err.message);
    });
    return () => socket.disconnect();
  }, [token]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, privateMessages]);

  function send() {
    const t = text.trim();
    if (!t) return;
    if (privateChat) {
      socketRef.current.emit('private_message', { to: privateChat, text: t });
    } else {
      socketRef.current.emit('message', { text: t });
    }
    setText('');
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    fetch(`${SERVER}/upload`, {
      method: 'POST',
      body: formData
    }).then(r => r.json()).then(data => {
      if (data.url) {
        const msg = `[File: ${data.filename}](${SERVER}${data.url})`;
        if (privateChat) {
          socketRef.current.emit('private_message', { to: privateChat, text: msg });
        } else {
          socketRef.current.emit('message', { text: msg });
        }
      }
    }).catch(console.error);
  }

  function onEmojiClick(emojiObject) {
    setText(prev => prev + emojiObject.emoji);
    setShowEmoji(false);
  }

  function insertKaomoji(k) {
    setText(prev => prev + k);
    setShowKaomojis(false);
  }

  const currentMessages = privateChat ? privateMessages.filter(m => (m.from === username && m.to === privateChat) || (m.from === privateChat && m.to === username)) : messages;

  return (
    <div className="chat">
      <div className="chat-panel">
        <div className="header">
          <div>Zalogowany jako: <b>{username}</b> {privateChat ? ` - Prywatny z ${privateChat}` : ' - Ogólny'} &lt;3 (^_^)</div>
          <div>{onLogout && <button className="btn secondary" onClick={onLogout}>Wyloguj ;_;</button>}</div>
        </div>
        <div ref={listRef} className="messages">
          {currentMessages.map(m => (
            <div key={m.id} className="message">
              <div className="meta">{m.username || m.from} · <span style={{color:'var(--muted)'}}>{new Date(m.time).toLocaleTimeString()}</span></div>
              <div dangerouslySetInnerHTML={{__html: m.text.replace(/\n/g, '<br>')}}></div>
            </div>
          ))}
        </div>
        <div className="input-row">
          <input className="input" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter' && send()} placeholder="Napisz wiadomość... uwu" />
          <button className="btn" onClick={send}>Wyślij</button>
          <button className="btn secondary" onClick={() => setShowEmoji(!showEmoji)}>😊</button>
          <button className="btn secondary" onClick={() => setShowKaomojis(!showKaomojis)}>Kaomoji</button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{display:'none'}} />
          <button className="btn secondary" onClick={() => fileInputRef.current.click()}>📎</button>
        </div>
        {showEmoji && <EmojiPicker onEmojiClick={onEmojiClick} />}
        {showKaomojis && (
          <div style={{padding:10, background:'var(--soft)', borderRadius:8, marginTop:10}}>
            {kaomojis.map(k => <button key={k} onClick={() => insertKaomoji(k)} style={{margin:5}}>{k}</button>)}
          </div>
        )}
      </div>

      <div className="sidebar">
        <div className="card">
          <h4>Online</h4>
          <ul className="online-list">
            {users.map((u, i) => (
              <li key={i}>
                {u}
                {u !== username && <button onClick={() => setPrivateChat(u)}>Prywatny</button>}
                {privateChat === u && <button onClick={() => setPrivateChat(null)}>Ogólny</button>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
