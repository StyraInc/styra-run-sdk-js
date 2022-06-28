export class Client {
  url
  callbacks

  constructor(url, {callbacks} = {}) {
    this.url = url
    this.callbacks = callbacks ?? {}

    if (!this.callbacks["disable"]) {
      this.callbacks["disable"] = disable
    }

    if (!this.callbacks["hide"]) {
      this.callbacks["hide"] = hide
    }
  }

  /**
   * Makes an authorization check against a policy rule identified by `'info'`.
   *
   * The `'info'` dictionary has the following properties:
   *
   * * `path`: (string) the path to the policy rule to query. Ignored if `'check'` is also provided
   * * `check`: (string) the name of a registered named check function
   * * `input`: (dictionary) the input document for the query
   *
   * @param info
   * @returns {Promise<Response>}
   */
  check(info) {
    console.debug("Checking:", info);
    return fetch(this.url,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        dataType: 'json',
        body: JSON.stringify(info)
      })
      .then(resp => {
        if (resp.status !== 200) {
          return Promise.reject(resp)
        }
        return resp.json()
      });
  }

  /**
   * Searches the provided `'root'` Element for `'authz'`- and `'on-authz'` properties.
   * For each `'authz'` property found, a check request is made; upon completion of which, the `'on-authz'`
   callback is called.
   *
   * The `'authz'` property value can either be a json dictionary, or a function returning a dictionary.
   * If a function, the `'authz'` callback takes one argument, the `Element` on which it was declared.
   * The `'authz'` dictionary has the same structure as the `'info'` argument for `check(info)`.
   *
   * The `'on-authz'` callback has the following argument list `(allowed, elem)`;
   * where `'allowed'` is the boolean result of the queried policy rule (`false` on `undefined` results);
   * and `'elem'` is the `Element` on which the `'on-authz'` property was declared.
   *
   * When looking up for callback functions, the client's callback dictionary is searched first,
   * after which global functions in the `'window'` are searched by name. If no callback is found, an exception is
   thrown.
   *
   * @param root the root `Element`, under which to search for `'authz'`- and `'on-authz'` properties. Defaults to
   `document`.
   */
  refresh(root = document) {
    console.debug("Applying authorization")
    let elements = root.querySelectorAll('[authz]')
    elements.forEach((elem) => {
      console.debug("authz elem:", elem)

      let authz_attr = elem.getAttribute("authz")
      let authz_info
      try {
        // Attempt parsing as JSON
        authz_info = JSON.parse(authz_attr)
      } catch {
        authz_info = findFunction(authz_attr, this.callbacks)(elem)
      }

      this.check(authz_info)
        .then(result => {
          console.debug("authz result:", elem, result)
          let allowed = result.result === true
          handle(allowed, elem, this.callbacks)
        })
        .catch((e) => {
          console.warn("Authz check failed", e)
          handle(false, elem, this.callbacks)
        });
    });
  }
}

function findFunction(name, callbacks) {
  let func = callbacks[name]
  if (func) {
    return func
  }

  if (window.hasOwnProperty(name)) {
    return window[name]
  }

  throw Error(`Unknown function '${name}'`)
}

function handle(allowed, elem, callbacks) {
  const onAuthz = elem.getAttribute('on-authz')
  if (onAuthz) {
    findFunction(onAuthz, callbacks)(allowed, elem)
  } else {
    // Disable elements by default if no on-authz function has been defined.
    disable(allowed, elem);
  }
}

function disable(allowed, elem) {
  if (allowed) {
    elem.removeAttribute("disabled");
  } else {
    elem.setAttribute("disabled", "true");
  }
}

function hide(allowed, elem) {
  console.debug("hiding:", elem, !allowed)
  if (allowed) {
    elem.classList.remove('hidden');
  } else {
    elem.classList.add('hidden');
  }
}

/**
 * Construct a new Oz Client from the passed `'options'` dictionary.
 * Valid options are:
 *
 * * `callbacks`: (dictionary) a name-to-function mapping of `'authz'`- and `'on-authz'` html property callbacks
 *
 * @param url the location of the Oz API
 * @param options
 * @returns {Client}
 * @constructor
 */
function New(url, options = {}) {
  return new Client(url, options);
}

export default {
  New
}

