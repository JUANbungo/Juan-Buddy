'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BuddyAPI', {
  getState: () => ipcRenderer.invoke('buddy:get'),
  action: (action, payload) => ipcRenderer.invoke('buddy:action', action, payload),
  saveNow: () => ipcRenderer.invoke('buddy:saveNow'),
  onState: (cb) => ipcRenderer.on('buddy:state', (_event, snapshot) => cb(snapshot)),
  openDashboard: () => ipcRenderer.send('pet:openDashboard'),
  hidePetWindow: () => ipcRenderer.send('pet:hide'),
});
