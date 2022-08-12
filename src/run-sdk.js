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

export function DEFAULT_PREDICATE(decision) {
  return decision?.result === true
}

export class Client {
  url
  callbacks
  eventListeners

  constructor(url, {callbacks = {}, eventListeners = []} = {}) {
    this.url = url
    this.callbacks = callbacks
    this.eventListeners = eventListeners

    if (!this.callbacks["disable"]) {
      this.callbacks["disable"] = disable
    }

    if (!this.callbacks["hide"]) {
      this.callbacks["hide"] = hide
    }
  }

  async handleEvent(type, info) {
    this.eventListeners.forEach((listener) => listener(type, info))
  }

  /**
   * @typedef {{result: *}|{}} CheckResult
   */
  /**
   * Makes an authorization query against a policy rule specified by `path`.
   *
   * @param {string} path the path to the policy rule to query
   * @param {*|undefined} input the input document for the query (optional)
   * @returns {Promise<CheckResult, StyraRunError>}
   */
  async query(path, input = undefined) {
   const result = await this.batchedQuery([{path, input}])
   return result[0]
  }

  /**
   * @callback DecisionPredicate
   * @param {CheckResult} decision
   * @returns {Boolean} `true` if `decision` is valid, `false` otherwise
   */
  /**
   * Makes an authorization check against a policy rule specified by `path`.
   *
   * @param {string} path the path to the policy rule to query
   * @param {*|undefined} input the input document for the query (optional)
   * @param {DecisionPredicate|undefined} predicate a callback function, taking a query response dictionary as arg, returning true/false (optional)
   * @returns {Promise<boolean, StyraRunError>}
   */
  async check(path, input = undefined, predicate = DEFAULT_PREDICATE) {
    const decission = await this.query(path, input)
    return await predicate(decission)
  }

  /**
   * @typedef {{path: string, input: *}} BatchQuery
   */
  /**
   * Makes multiple authorization checks against a set of policy rules identified by `queries`.
   *
   * `queries` is a list of dictionaries that have the following properties:
   *
   * * `path`: (string) the path to the policy rule to query.
   * * `input`: (dictionary) the input document for the query
   * 
   * Returns a `Promise` that resolves to a list of query responses, equal in size of `queries`. 
   * Each entry in the list corresponds to the response to the query at the same position in `queries`.
   *
   * @param {BatchQuery[]} queries the list of queries to batch
   * @returns {Promise<Response[]>}
   */
  async batchedQuery(queries) {
    if (!Array.isArray(queries)) {
      throw new Error("'queries' is not a valid array")
    }
    try {
      const result = await postJson(this.url, queries)
      this.handleEvent('query', {queries, result})
      return result
    } catch (err) {
      this.handleEvent('query', {queries, err})
      throw new StyraRunError('Query failed', queries, err)
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
  async refresh(root = document) {
    let elements = Array.from(root.querySelectorAll('[authz]'))

    const queries = elements.map((elem) => {
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

      return query
    })

    if (queries.length > 0) {
      const decisions = await this.batchedQuery(queries)
      await Promise.allSettled(decisions.map(async (decision, i) => {
        const elem = elements[i]
        this.handleEvent('authz', {elem, decision})
        handle(decision, elem, this.callbacks)
      }))
    }
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

function handle(decision, node, callbacks) {
  let authzAction = node.getAttribute('authz:action')
  if (authzAction) {
    findFunction(authzAction, callbacks)(decision, node)
  } else {
    // No authz:action has been defined, attempt figuring it out.
    // the attribute might get removed once the inferred action has been applied, so we need to remember the action.

    if (node.attributes.hasOwnProperty('hidden')) {
      // Node has hidden property, assume policy decisions should toggle visibility.
      
      node.setAttribute('authz:action', 'hide')
      hide(decision, node)
      return
    } 

    // Disable node by default.
    node.setAttribute('authz:action', 'disable')
    disable(decision, node);
  }
}

function isAllowed(decision) {
  return decision?.result === true
}

function disable(decision, node) {
  if (isAllowed(decision)) {
    node.removeAttribute("disabled");
  } else {
    node.setAttribute("disabled", "true");
  }
}

function hide(decision, node) {
  if (isAllowed(decision)) {
    node.removeAttribute("hidden");
  } else {
    node.setAttribute("hidden", "true");
  }
}

/**
 * @callback EventListenerCallback
 * @param {string} type a string identifying the type of event
 * @param {Object} info a collection of event attributes 
 */
/**
 * A callback for generating the `input` document for policy checks for a given document element.
 * 
 * @callback InputCallback
 * @param {Element} element the document element the policy check was made for
 * @returns {Object} the `input` document for the policy check
 */
/**
 * A callback for handling policy decisions made for a given document element.
 * 
 * @callback HandlerCallback
 * @param {Object} result the result of the policy check
 * @param {Element} element the document element the policy check was made for
 */
/**
 * A set of options for the `Styra Run` client.
 *
 * @typedef {{callbacks: Object.<String, HandlerCallback|InputCallback>, eventListeners: EventListenerCallback}} Options
 */
/**
 * Construct a new `Styra Run` client from the passed `'options'` dictionary.
 * Valid options are:
 *
 * * `callbacks`: (dictionary) a name-to-function mapping of `'authz'`- and `'on-authz'` html property callbacks
 * * `eventListeners`: a list of callback functions for the various events triggered by the client (useful for e.g. debug logging)
 *
 * @param url the location of the `Styra Run` API
 * @param {Options} options
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

