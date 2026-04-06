// Custom entry point for Rubidium.
//
// WHY THIS FILE EXISTS:
// @livekit/react-native requires registerGlobals() to be called before ANY
// other module loads. ES module `import` statements are hoisted by Babel/Metro,
// so putting registerGlobals() in App.tsx doesn't work — all imports run first.
//
// Using CommonJS `require()` here guarantees the call order:
//   1. registerGlobals() → patches global WebSocket + RTCPeerConnection
//   2. Expo registers the root component
//   3. App loads with properly initialized WebRTC

// Polyfill DOMException FIRST — registerGlobals() internally uses it.
if (typeof global.DOMException === 'undefined') {
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name;
    }
  };
}

const { registerGlobals } = require("@livekit/react-native");
registerGlobals();

// Now it's safe to load the rest of the app.
const { registerRootComponent } = require("expo");
const { default: App } = require("./App");
registerRootComponent(App);
