# The Styra Run front-end js SDK

## How to use

### Simple Check

```javascript
const client = StyraRun.New('/authz');
const input = {...};
client.check({
    input,
    path: 'foo/bar/allowed'
});
```

### Check Using HTML Tags

```html
<form>
    <!-- The default 'disable' function adds/removes the 'disabled' property --> 
    <input disabled
            type="text" authz='{"path": "/edit/allowed"}'
            on-authz="disable"> 
            
    <!-- Use custom functions for producing the 'authz' info dictionary and for handling check result -->
    <input disabled
            type="text" authz='myAuthzFunc'
            on-authz="myOnAuthzFunc">

    <!-- Use a named check function registered server-side -->
    <!-- The default 'hide' function adds/removes the 'hidden' property --> 
    <input hidden
            type="submit"
            value="Submit" authz='{"checked": "my-check-func"}'
            on-authz="hide"> 
</form>
```

```javascript
const client = StyraRun.New('/authz');
client.refresh(); // Scan the active document for nested elements with 'authz' properties; making a check request for each.

function myAuthzFunc(elem) {
    return {
        path: '/edit/allowed',
        input: { foo: "bar" }
    };
}

function myOnAuthzFunc(allowed, elem) {
    if (allowed) {
        elem.removeAttribute("disabled");
        elem.style.backgroundColor = 'green'
    } else {
        elem.setAttribute("disabled", "true");
        elem.style.backgroundColor = 'red'
    }
}
```
