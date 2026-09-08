import React from 'react';
import {createRoot} from 'react-dom/client';
import {Buffer} from 'buffer';
import App from './App.jsx';
import './style.css';
window.Buffer=Buffer;
createRoot(document.getElementById('root')).render(<App/>);

