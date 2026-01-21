import React, { useState, useEffect } from 'react';

export default function Notification({ notifications, onClose }) {
  const [visible, setVisible] = useState(notifications.length > 0);

  useEffect(() => {
    if (notifications.length > 0) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notifications, onClose]);

  if (!visible || notifications.length === 0) return null;

  return (
    <div className="notification-popup">
      {notifications.map((notif, idx) => (
        <div key={idx} className="notification-item">
          <div className="notification-header">
            <span className="notification-sender">💬 {notif.from}</span>
            <button 
              className="notification-close" 
              onClick={() => {
                setVisible(false);
                setTimeout(onClose, 300);
              }}
            >
              ✕
            </button>
          </div>
          <div className="notification-content">{notif.text.substring(0, 100)}{notif.text.length > 100 ? '...' : ''}</div>
          <div className="notification-time">{new Date(notif.time).toLocaleTimeString()}</div>
        </div>
      ))}
    </div>
  );
}
