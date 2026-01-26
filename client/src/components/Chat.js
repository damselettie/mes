import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import '../styles.css';
import { SERVER } from '../config';
import EmojiPicker from 'emoji-picker-react';
import Notification from './Notification';

export default function Chat({ username, token, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showKaomojis, setShowKaomojis] = useState(false);
  const [privateChat, setPrivateChat] = useState(null); // username for private chat
  const [privateMessages, setPrivateMessages] = useState([]);
  const [pendingNotification, setPendingNotification] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'pink');
  const socketRef = useRef(null);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const kaomojis = ['(≧ω≦)', '(⌒‿⌒)', '〜(꒪꒳꒪)〜', '(；ω；)', '(≧▽≦)', '♡(｡>ω<｡)', '(^_^)', ';_;', '<3', '٩(ˊᗜˋ*)و ♡', '(•‿•)', '(*^‿^*)', '（＾_＾）', '(✿◠‿◠)', '( ｡ •̀ ᴖ •́ ｡)', 'ʕ•ᴥ•ʔ', '(づ｡◕‿‿◕｡)づ', '૮(˶╥︿╥)ა', 'ヽ(・∀・)ﾉ', '(❁´◡`❁)', '（＾ｖ＾）', '(*≧ω≦)', '(´｡• ᵕ •｡`)'];

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
      // Show notification only if message is from another user and not in private chat with them
      if (msg.from !== username && msg.from !== privateChat) {
        setNotifications(prev => [...prev, msg]);
      }
    });
    socket.on('pending_messages', (msgs) => {
      if (msgs.length > 0) {
        setPrivateMessages(prev => [...prev, ...msgs]);
        const senders = [...new Set(msgs.map(m => m.from))].join(', ');
        setPendingNotification(`Masz wiadomości od: ${senders}`);
        // Also show as notifications popup
        msgs.forEach(msg => {
          setNotifications(prev => [...prev, msg]);
        });
        setTimeout(() => setPendingNotification(null), 5000);
      }
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
      <Notification 
        notifications={notifications} 
        onClose={() => setNotifications([])} 
      />
      <div className="chat-panel">
        <div className="header">
          <div>
            {pendingNotification && <div style={{color: '#ff6b6b', fontWeight: 'bold', marginBottom: 8}}>📬 {pendingNotification}</div>}
            <div>Zalogowany jako: <b>{username}</b> {privateChat ? ` - Prywatny z ${privateChat}` : ' - Ogólny'} &lt;3 (^_^)</div>
          </div>
          <div className="header-controls">
            <div className="theme-switcher">
              {['pink', 'blue', 'red', 'green', 'yellow', 'black'].map(t => (
                <button
                  key={t}
                  className={`theme-btn theme-${t} ${theme === t ? 'active' : ''}`}
                  onClick={() => setTheme(t)}
                  title={t}
                />
              ))}
            </div>
            {onLogout && <button className="btn secondary" onClick={onLogout}>Wyloguj ;_;</button>}
          </div>
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
          <h4>Użytkownicy</h4>
          <ul className="online-list">
            {users.map((u, i) => (
              <li key={i}>
                <span>{u.username} <span className={`status-indicator ${u.online ? 'online' : 'offline'}`}></span></span>
                {u.username !== username && <button onClick={() => setPrivateChat(u.username)}>Prywatny</button>}
                {privateChat === u.username && <button onClick={() => setPrivateChat(null)}>Ogólny</button>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
