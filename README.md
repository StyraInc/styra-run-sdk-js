# The Styra Run front-end js SDK

## Installation

1. Download `styra_run.js` from a recent [release](https://github.com/StyraInc/styra-run-sdk-js/releases).
1. Add a script tag to your HTML source:

    ```html
    <script src="/path/to/styra_run.js"></script>
    ```

## Policy Checking with HTML Attributes

Note: when querying a policy rule by path, the `authz` HTML attribute value _must_ have a leading '`/`'; e.g. `/foo/bar` is a valid path, whereas `foo/bar` is not.

### Disabling an HTML Node on Policy Decision

Setting the `authz:action` attribute to `disable` will toggle the `disabled` attribute on policy decision:

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule"
           authz:action="disable">
</form>
<script src="/path/to/styra_run.js"></script>
<script>
    StyraRun.refresh() // Make a policy decision for all HTML nodes with an `authz` attribute.
</script>
```

If no `authz:action`- and no `hidden` attributes are declared, the `disabled` attribute will be toggled by default:

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule">
</form>
<script src="/path/to/styra_run.js"></script>
<script>StyraRun.refresh()</script>
```

### Hiding an HTML Node on Policy Decision

Setting the `authz:action` attribute to `hide` will toggle the `hidden` attribute on policy decision:

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule"
           authz:action="hide">
</form>
<script src="/path/to/styra_run.js"></script>
<script>StyraRun.refresh()</script>
```

If no `authz:action` attribute is declared, but the `hidden` attribute is, the `hidden` attribute will be toggled by default:

```html
<form>
    <input hidden
           type="submit"
           authz="/path/to/policy/rule">
</form>
<script src="/path/to/styra_run.js"></script>
<script>StyraRun.refresh()</script>
```

### Taking a Custom Action on Policy Decision

The `authz:action` attribute can also name a custom global function:

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule"
           authz:action="myCustomAction">
</form>
<script src="/path/to/styra_run.js"></script>
<script>
    function myCustomAction(response, node) {
        if (response?.result === true) {
            node.removeAttribute("disabled")
            node.style.background = "green"
        } else {
            node.setAttribute("disabled", "true")
            node.style.background = "red"
        }
    }

    StyraRun.refresh()
</script>
```

or a [registered callback](#registering-callbacks):

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule"
           authz:action="myCustomAction">
</form>
<script src="/path/to/styra_run.js"></script>
<script>
    function myCustomAction(decision, node) {
        if (response?.result === true) {
            node.removeAttribute("disabled")
            node.style.background = "green"
        } else {
            node.setAttribute("disabled", "true")
            node.style.background = "red"
        }
    }

    const client = StyraRun.New('/authz', {
        myCustomAction
    })

    client.refresh()
</script>
```

### Defining Policy Input

An `input` document/value can be specified via `authz:input`:

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule"
           authz:input="42"> <!-- A primitive -->
</form>
<script src="/path/to/styra_run.js"></script>
<script>StyraRun.refresh()</script>
```

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule"
           authz:input='{"foo": "bar"}'> <!-- A dictionary -->
</form>
<script src="/path/to/styra_run.js"></script>
<script>StyraRun.refresh()</script>
```

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule"
           authz:input='["do", "re", "mi"]'> <!-- An array -->
</form>
<script src="/path/to/styra_run.js"></script>
<script>StyraRun.refresh()</script>
```

Optionally, `authz:input-func` can be used to specify a global function or [registered callback](#registering-callbacks) that takes the current HTML node, and returns the `input`:

```html
<form>
    <input type="submit"
           authz="/path/to/policy/rule"
           authz:input-func="myFunc">
</form>
<script>
    function myFunc(node) {
        return {
            id: node.attributes.id,
            rand: Math.random() 
        }
    }
</script>
<script src="/path/to/styra_run.js"></script>
<script>StyraRun.refresh()</script>
```

### Calling Named Check Functions Registered Server-Side

When using the [Node.js SDK](https://github.com/StyraInc/styra-run-sdk-node), it is possible to register named check functions, which can e.g. add session data to the policy query that isn't available to the browser. To call a named check function, simply set the `authz` attribute to its name, without any leading `/`:

```html
<form>
    <input hidden
           type="submit"
           authz="my-named-check-function">
</form>
<script src="/path/to/styra_run.js"></script>
<script>StyraRun.refresh()</script>
```

### Authz Attributes

* `authz`: if prefixed with a `/`, the path to a policy rule; otherwise assumed to be a named check function registered server-side.
* `authz:action`: the action to take on a policy decision; either `hide` (toggles the `hidden` attribute), `disable` (toggles the `disabled` attribute), or the name of some global function or a callback registered when the Styra Run Client was constructed. If `authz:action` isn't declared, `hide` is assumed if the html element has the `hidden` attribute; `disable` is assumed otherwise. 
Callbacks take two arguments:
  * `decision`: (dictionary) the result of the queried polizy rule.
  * `node`: the html node that spawned the policy check.
* `authz:input`: the input document/value used when querying the policy rule.
* `authz:input-func`: a function that generates the input document/value; either a global function or a callback registered when the Styra Run Client was constructed. Shoult both be declared, `authz:input-func` is prioritized over `authz:input`.

## Using the Default Styra Run Client Directly

The default Styra Run Client makes API calls to `/authz`, and has no [registered callbacks](#registering-callbacks).

```javascript
const input = {...};
// Query the `foo/bar/allowed` policy rule.
StyraRun.check('foo/bar/allowed', input)
```

```javascript
// Refresh the policy decision for all HTML nodes with the `authz` attribute.
StyraRun.refresh();
```

## Instantiating a Custom Styra Run Client

When it's necessary to make API calls to another location than `/authz`, or [callbacks](#registering-callbacks) must be registered, it's possible to instantiate a custom Client:

```javascript
const client = StyraRun.New('/authz');
const input = {...};
// Query the `foo/bar/allowed` policy rule.
client.check('foo/bar/allowed', input)
```

## Registering Callbacks

When instantiating a Styra Run Client, it is possible to register callbacks for use with `authz:action` and `authz:input-func`:

```javascript
// Called when a policy decision has been made on a HTML node with the `authz:action` attribute.
function myCustomAction(decision, node) {
    if (decision?.result === true) {
        node.removeAttribute("disabled")
        node.style.background = "green"
    } else {
        node.setAttribute("disabled", "true")
        node.style.background = "red"
    }
}

// Called before a policy decision is made in a HTML node with the `authz:input-func` attribute.
function myCustomInput(node) {
    return {
        id: node.attributes.id,
        rand: Math.random() 
    }
}

const client = StyraRun.New('/authz', {
    myCustomAction,
    myCustomInput
})
```

## RBAC Management widget

A simple widget can be generated for managing user roles.

```html
<div id="authz-manage-rbac"></div>
<script src="/path/to/styra_run.js"></script>
<script>
    StyraRun.setupRbacManagement('/api/rbac', 'authz-manage-rbac')
</script>
```

The `StyraRun.setupRbacManagement(url, anchorId, styraRunClient)` function takes the following arguments:

* `url` (mandatory): the base URL for the RBAC management API
* `anchorId` (optional): the ID of the document element where the widget should be attached. Defaults to `'authz-manage-rbac'`
* `styraRunClient` (optional): the Styra Run client to use. Defaults to `StyraRun.defaultClient`

and will generate a simple HTML table with a `User` column, containing a user's username as defined by the default Styra Run RBAC model; and a `Role` column, containing a select drop-down with the available roles as it's options. Each row in the table represents an existing user-role binding.

The necessary back-end service for the RBAC management widget can be provided by the [Styra Run Node.js SDK](https://www.npmjs.com/package/styra-run-sdk-node).
