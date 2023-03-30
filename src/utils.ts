/**
 *
 * Part of the MLP r/place Project, under the Apache License v2.0 or ISC.
 * SPDX-License-Identifier: Apache-2.0 OR ISC
 * SPDX-FileCopyrightText: Copyright CONTRIBUTORS.md
 *
 **
 *
 * @file Random extra functions.
 *
 **/

/**
 * GM.xmlHttpRequest as a Promise
 */
export function gm_fetch<TContext = any>(request: GM.Request<TContext>) {
  return new Promise((res: (res: GM.Response<TContext>) => void,
                      rej: (res: GM.Response<TContext>) => void) => {
    request.onload = res;
    request.onerror = rej;
    request.onabort = rej;
    request.ontimeout = rej;
    GM.xmlHttpRequest(request);
  });
}

/**
 * @param headers \r\n separated string of HTTP headers
 * @returns An object mapping each header to its value. Unspecified which header is returned for
 *          multiple of the same header.
 */
export function headerStringToObject(headers: string) {
  return Object.fromEntries(headers.split('\r\n').filter((val) => {
    return !!val;
  }).map((val) => {
    return val.split(': ').map((val) => {
      return val.trim().replace(/^"+/, '').replace(/"+$/, '');
    });
  }));
}

export class AsyncWorkQueue {
  #queue: {work: (() => Promise<any>), resolve, reject}[] = [];
  #working = false;

  enqueue<T>(work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.#queue.push({work, resolve, reject});
      if (this.#working)
        return;

      this.#working = true;
      this.workLoop();
    });
  }

  private async workLoop() {
    while (this.#queue.length) {
      const work = this.#queue.shift()!;
      try {
        const result = await work.work();
        work.resolve(result);
      } catch(e) {
        work.reject(e);
      }
    }

    this.#working = false;
  }
};
