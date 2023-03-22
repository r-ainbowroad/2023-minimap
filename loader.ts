/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Loads the real script from the web with cache busting since it changes so often.
 *
 **/

(async function () {
  GM.xmlHttpRequest({
    method: "GET",
    url: `weneedtofigurethisout?t=${new Date().getTime()}`,
    onload: function (res) {
      new Function('GM', res.responseText)(GM);
    },
  });
})();
