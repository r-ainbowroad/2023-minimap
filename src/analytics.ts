/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Keep track of various statistics. Mostly used to know how many pixels per second we have.
 *
 **/

import {v4 as uuidv4} from 'uuid';

export class Analytics {
  #endpoint: URL;
  #uuid: uuidv4;

  constructor(endpoint: URL) {
    this.#endpoint = endpoint;
    this.#uuid = uuidv4();
  }

  async placedPixel(type: string, pos: {x: number, y: number}, color: number, timestamp: number,
                    nextPixelPlace: {reddit: number, safe: number}) {
    const data = {
      id: this.#uuid,
      event: 'pixel',
      type: type,
      pos: {
        x: pos.x,
        y: pos.y
      },
      color: color,
      timestamp: timestamp,
      nextPixelPlace: nextPixelPlace
    };

    GM.xmlHttpRequest({
      url: this.#endpoint.toString(),
      method: 'POST',
      data: JSON.stringify(data)
    });
  }
}
