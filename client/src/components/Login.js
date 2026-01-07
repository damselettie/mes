import React, { useState } from 'react';
import '../styles.css';
import { SERVER } from '../config';

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    const username = name.trim();
    if (!username || !password) {
      setError('Wypełnij pola');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SERVER}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) {
        setError(data && data.error ? data.error : `Błąd: ${res.status}`);
      } else {
        if (onLogin) onLogin({ username: data.username, token: data.token });
      }
    } catch (err) {
      setError('Brak połączenia z serwerem');
      console.error('login error', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <h2>{mode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}</h2>
      <form onSubmit={submit}>
        <input
          className="input"
          autoComplete="username"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Twoja nazwa"
          disabled={loading}
        />
        <input
          className="input"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Hasło"
          disabled={loading}
        />
        <div style={{marginTop:8, display:'flex', gap:8}}>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Proszę czekać...' : (mode === 'login' ? 'Wejdź' : 'Zarejestruj')}</button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            disabled={loading}
          >
            {mode === 'login' ? 'Utwórz konto' : 'Mam konto'}
          </button>
        </div>
      </form>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
