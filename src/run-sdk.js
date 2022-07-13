export class StyraRunError extends Error {
  constructor(message, query = undefined, cause = undefined) {
    super(message)
    this.name = "StyraRunError"
    this.query = query
    this.cause = cause
  }
}

export class StyraRunHttpError extends Error {
  constructor(message, statusCode, body) {
    super(message)
    this.name = "StyraRunHttpError"
    this.statusCode = statusCode
    this.body = body
  }
}

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
   * Makes an authorization check against a policy rule identified by `'query'`.
   *
   * The `'query'` dictionary has the following properties:
   *
   * * `path`: (string) the path to the policy rule to query. Ignored if `'check'` is also provided
   * * `check`: (string) the name of a registered named check function
   * * `input`: (dictionary) the input document for the query
   *
   * @param query
   * @returns {Promise<Response>}
   */
  async check(query) {
   const result = await this.batchedCheck([query])
   return result[0]
  }

  async batchedCheck(queries) {
    if (!Array.isArray(queries)) {
      throw new Error("'queries' is not a valid array")
    }
    console.debug("Checking:", queries);
    try {
      return await postJson(this.url, queries)
    } catch (err) {
      throw new StyraRunError('Check failed', queries, err)
    }
  }

  /**
   * Searches the provided `'root'` Element for `'authz'`- and `'authz:*'` properties.
   * For each `'authz'` property found, a check request is made; upon completion of which, the `'authz:action'` callback is called.
   *
   * When looking up for callback functions, the client's callback dictionary is searched first,
   * after which global functions in the `'window'` are searched by name. If no callback is found, an exception is
   thrown.
   *
   * @param root the root `Element`, under which to search for `'authz'`- and `'authz:*'` properties. Defaults to
   `document`.
   */
  refresh(root = document) {
    console.debug("Applying authorization")
    let elements = Array.from(root.querySelectorAll('[authz]'))
    const checks = elements.map(async (elem) => {
      const query = {
        path: elem.getAttribute("authz")
      }

      let input
      let authzInputFunc = elem.getAttribute("authz:input-func")
      if (authzInputFunc) {
        const func = findFunction(authzInputFunc, this.callbacks)
        input = func(elem)
      } else {
        let authzInput = elem.getAttribute("authz:input")
        if (authzInput) {
          try {
            // Attempt parsing as JSON
            input = JSON.parse(authzInput)
          } catch {
            input = authzInput
          }
        }
      }

      if (input) {
        query.input = input
      }

      try {
        const result = await this.check(query)
        console.debug("authz result:", elem, result)
        handle(result, elem, this.callbacks)
      } catch (err) {
        console.warn("Authz check failed", err)
        handle(undefined, elem, this.callbacks)
      }
    });

    return Promise.all(checks);
  }
}

async function postJson(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    dataType: 'json',
    body: JSON.stringify(data)
  })

  if (response.status !== 200) {
    throw new StyraRunHttpError(`Unexpected status code: ${response.status}`, 
      response.status, response.text())
  }

  return await response.json()
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

function handle(result, node, callbacks) {
  let authzAction = node.getAttribute('authz:action')
  if (authzAction) {
    findFunction(authzAction, callbacks)(result, node)
  } else {
    // No authz:action has been defined, attempt figuring it out.
    // the attribute might get removed once the inferred action has been applied, so we need to remember the action.

    if (node.attributes.hasOwnProperty('hidden')) {
      // Node has hidden property, assume policy decisions should toggle visibility.
      
      node.setAttribute('authz:action', 'hide')
      hide(result, node)
      return
    } 

    // Disable node by default.
    node.setAttribute('authz:action', 'disable')
    disable(result, node);
  }
}

function isAllowed(result) {
  return result?.result === true
}

function disable(result, node) {
  if (isAllowed(result)) {
    node.removeAttribute("disabled");
  } else {
    node.setAttribute("disabled", "true");
  }
}

function hide(result, node) {
  if (isAllowed(result)) {
    node.removeAttribute("hidden");
  } else {
    node.setAttribute("hidden", "true");
  }
}

/**
 * Construct a new `Styra Run` Client from the passed `'options'` dictionary.
 * Valid options are:
 *
 * * `callbacks`: (dictionary) a name-to-function mapping of `'authz'`- and `'on-authz'` html property callbacks
 *
 * @param url the location of the `Styra Run` API
 * @param options
 * @returns {Client}
 * @constructor
 */
function New(url, options = {}) {
  return new Client(url, options);
}

//
// Default client and convenience functions
//

/**
 * A default {@link Client}, pointed to `/authz`, with no registered callback functions.
 * @see {@link Client}
 */
export const defaultClient = New('/authz')

/**
 * Calls {@link Client#check} on the default client.
 * 
 * @param {*} info 
 * @returns 
 * @see {@link Client#check}
 * @see {@link defaultClient}
 */
function check(info) {
  return defaultClient.check(info);
}

/**
 * Calls {@link Client#refresh} on the default client.
 * 
 * @param {*} root 
 * @see {@link Client#refresh}
 * @see {@link defaultClient}
 */
function refresh(root = document) {
  return defaultClient.refresh(root);
}

export default {
  New,
  check,
  refresh
}

