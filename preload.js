const { contextBridge, ipcRenderer } = require('electron');

const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('sp', {
  authStatus: call('auth:status'),
  login: call('auth:login'),
  logout: call('auth:logout'),
  onLoggedOut: (cb) => ipcRenderer.on('auth:loggedOut', cb),
  state: call('player:state'),
  toggle: call('player:toggle'),
  next: call('player:next'),
  prev: call('player:prev'),
  shuffle: call('player:shuffle'),
  seek: call('player:seek'),
  volume: call('player:volume'),
  playlists: call('playlists:get'),
  playPlaylist: call('playlists:play'),
  expand: call('win:expand'),
  hide: call('win:hide'),
  quit: call('win:quit'),
  openUrl: call('win:openUrl'),
});
