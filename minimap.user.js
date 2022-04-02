// ==UserScript==
// @name        r/Place MLP Minimap 🇺🇦 #StandWithUkraine
// @namespace   http://tampermonkey.net/
// @description MLP Minimap r/Place
// @include     https://hot-potato.reddit.com/embed*
// @version     0.2
// @grant       GM.xmlHttpRequest
// @author      Ponywka
// @downloadURL https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/minimap.user.js
// @updateURL   https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/minimap.user.js
// @connect     raw.githubusercontent.com
// ==/UserScript==

const _TamperRoot = this;
(async function () {
  // Updater
  GM.xmlHttpRequest({
    method: "GET",
    url: `https://raw.githubusercontent.com/r-ainbowroad/minimap/d/main/minimap.js?t=${new Date().getTime()}`,
    onload: function (res) {
      new Function(res.responseText)(_TamperRoot);
    },
  });
})();
