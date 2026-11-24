'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BuddyAPI', {
  getState: () => ipcRenderer.invoke('buddy:get'),
  action: (action, payload) => ipcRenderer.invoke('buddy:action', action, payload),
  saveNow: () => ipcRenderer.invoke('buddy:saveNow'),
  onState: (cb) => ipcRenderer.on('buddy:state', (_event, snapshot) => cb(snapshot)),
  onEvent: (cb) => ipcRenderer.on('buddy:event', (_event, data) => cb(data)),
  getEvent: () => ipcRenderer.invoke('buddy:getEvent'),
  openDashboard: () => ipcRenderer.send('pet:openDashboard'),
  hidePetWindow: () => ipcRenderer.send('pet:hide'),
});
