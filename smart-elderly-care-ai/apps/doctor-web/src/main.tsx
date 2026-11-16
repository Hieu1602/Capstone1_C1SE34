import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Khởi tạo chế độ nền tối nếu đã được lưu trước đó
if (localStorage.getItem('@doctor_theme') === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
