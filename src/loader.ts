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

import {constants} from "./constants";
import {gm_fetch, headerStringToObject} from "./utils";

const url = "http://ponyplace-cdn.ferrictorus.com/minimap.user.js";

(async function () {
  let etag: string | undefined;
  try {
    const response = await gm_fetch({
      method: "GET",
      url: `${url}?t=${new Date().getTime()}`
    });

    const headers = headerStringToObject(response.responseHeaders);
    etag = headers.ETag;
    new Function('GM', response.responseText)(GM);
  } catch(e) {
    console.error(`Failed to get primary script ${e}`);
  }

  if (etag) {
    setInterval(async () => {
      try {
        const response = await gm_fetch({
          method: "HEAD",
          url: `${url}?t=${new Date().getTime()}`,
          headers: {
            'If-None-Match': etag!
          }
        });

        if (response.status == 200) {
          location.reload();
        }
      } catch(e) {
        console.warn(`Failed to refersh primary script ${e}`);
      }
    }, constants.ScriptReloadCheckPeriodMs);
  } else {
    console.log("No ETag in response. Auto refresh on update disabled.");
  }
})();
