
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import Info from './Info';
import ThankYou from './ThankYou';
import ModerationPanel from './ModerationPanel';
import './index.css';

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
