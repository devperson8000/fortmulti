window.SUNNY_CONFIG={url:'',key:''};
Promise.all([
 import('./connection-stability.js'),
 import('./multiplayer-runtime.js')
]).catch(error=>console.error('Multiplayer stability runtime failed to load',error));
