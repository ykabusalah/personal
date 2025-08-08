import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import Info from './Info';
import ThankYou from './ThankYou';
import ModerationPanel from './ModerationPanel';
import './index.css';

// Initialize Google Analytics for the drawing app
const initializeGA = () => {
  if (!window.gtag) {
    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = 'https://www.googletagmanager.com/gtag/js?id=G-DM7G0WM5ZM';
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-DM7G0WM5ZM', {
        linker: {
          domains: [
            'ykabusalah.me',
            'draw.ykabusalah.me'
          ]
        }
      });
    `;
    document.head.appendChild(script2);
  }
};

// Initialize GA when the app loads
initializeGA();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/info" />} />
        <Route path="/info" element={<Info />} />
        <Route path="/draw" element={<App />} />
        <Route path="/thank-you" element={<ThankYou />} />
        <Route path="/moderate" element={<ModerationPanel />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);