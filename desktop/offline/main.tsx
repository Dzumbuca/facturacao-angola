import React from 'react';
import { createRoot } from 'react-dom/client';
import { OfflineWorkspace } from './offline-workspace';

const element = document.getElementById('root');
if (!element) throw new Error('Offline workspace root is missing');
createRoot(element).render(<React.StrictMode><OfflineWorkspace /></React.StrictMode>);
