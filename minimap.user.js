// ==UserScript==
// @name        r/Place MLP Minimap 🇺🇦 #StandWithUkraine
// @namespace   http://tampermonkey.net/
// @description MLP Minimap r/Place
// @include     https://hot-potato.reddit.com/embed*
// @version     0.3
// @grant       GM.xmlHttpRequest
// @author      Ponywka, bb010g
// @downloadURL https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/minimap.user.js
// @updateURL   https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/minimap.user.js
// @connect     raw.githubusercontent.com
// @connect     media.githubusercontent.com
// @require     https://unpkg.com/uhtml@2.8.1
// ==/UserScript==

const _TamperRoot = this;
(async function () {
  // Updater
  GM.xmlHttpRequest({
    method: "GET",
    url: `https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/minimap.impl.user.js?t=${new Date().getTime()}`,
    onload: function (res) {
      new Function(res.responseText)(_TamperRoot);
    },
  });
})();
