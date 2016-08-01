import _ from 'lodash';
import stores from 'stores';

import constants from '../constants';

const isIterable = object =>
  object != null && typeof object[Symbol.iterator] === 'function';

const cacheResponse = (data) => {
  if (isIterable(data)) {
    stores.cache.cacheList(data);
  } else {
    stores.cache.cacheWithId(data.id, data);
  }
};

class ApiClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || constants.API_BASE_URL;
    this.userAgent = options.userAgent || constants.API_USER_AGENT;
  }

  fetch = (path, method, data, options = {}) => {
    let body;
    let modifiedPath;

    if (method === 'GET') {
      modifiedPath = `${path}?${this.constructQueryString(data)}`;
    } else if (method === 'POST' || method === 'PUT') {
      body = JSON.stringify(data);
    }

    // Construct headers
    const headers = new Headers({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
    });
    if (stores.user.authenticated) {
      headers.set('Authorization', `Bearer ${stores.user.token}`);
    }

    // Construct request
    const request = fetch(this.baseUrl + (modifiedPath || path), {
      method,
      body,
      headers,
      redirect: 'follow',
    });

    // Handle request promises and return a new promise
    return new Promise((resolve, reject) => {
      request
      .then((response) => {
        // Handle successful responses
        if (response.status >= 200 && response.status < 300) {
          return response;
        }

        // Handle 401, log out user
        if (response.status === 401) {
          stores.user.logout();
        }

        // Handle failed responses
        let error;
        try {
          // Expect API to return JSON
          error = JSON.parse(response);
        } catch (e) {
          // Expect call to fail without JSON response
          error = { error: response.statusText };
        }

        error.statusCode = response.status;
        error.response = response;
        return reject(error);
      })
      .then((response) => {
        return response.json();
      })
      .then((json) => {
        // Cache responses
        if (options.cache) {
          cacheResponse(json.data);
        }
        resolve(json);
      })
      .catch(() => {
        reject({ error: 'Unknown error' });
      });
    });
  }

  get = (path, data, options) => {
    return this.fetch(path, 'GET', data, options);
  }

  post = (path, data, options) => {
    return this.fetch(path, 'POST', data, options);
  }

  // Helpers

  constructQueryString = (data) => {
    return _.map(data, (v, k) => {
      return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    }).join('&');
  };
}

export default ApiClient;

// In case you don't want to always initiate, just import with `import { client } ...`
const client = new ApiClient();
export { client, cacheResponse };