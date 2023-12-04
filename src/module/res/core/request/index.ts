import { MochiRequestClient, MochiRequestMethod } from '@mochiapp/js/dist';
import { MochiResponse } from '@mochiapp/js/src/core/request/types';

const test: MochiRequestClient = {
  [MochiRequestMethod.get]: async (url, options) => {
    return {
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      request: {
        url,
        method: MochiRequestMethod.get,
      },
    } satisfies MochiResponse
  }
}
