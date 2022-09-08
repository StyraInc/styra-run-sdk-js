import { defaultClient } from "./run-sdk.js"
import { StyraRunHttpError, UnauthorizedError } from "./errors.js"

class RbacManager {
  constructor(url, node, styraRunClient) {
    this.url = url
    this.node = node
    this.styraRunClient = styraRunClient
    this.pageIndex = 1
  }

  renderRoleSelector(node, roles, user) {
    const selectNode = document.createElement('select')
    selectNode.onchange = (event) => {
      selectNode.setAttribute('disabled', true)
      this.setBinding(user.id, event.target.value)
    }
  
    if (!roles.includes(user?.role)) {
      const optionNode = document.createElement('option')
      optionNode.setAttribute('disabled', true)
      optionNode.setAttribute('selected', true)
      optionNode.innerText = user.role || ''
      selectNode.appendChild(optionNode)
    }
    
    roles.forEach((role) => {
      const optionNode = document.createElement('option')
      optionNode.innerText = role
      optionNode.setAttribute('value', role)
      if (user?.role === role) {
        optionNode.setAttribute('selected', true)
      }
      
      selectNode.appendChild(optionNode)
    })
  
    node.appendChild(selectNode)
  }
  
  async setBinding(id, role) {
    try {
      const response = await fetch(`${this.url}/user_bindings/${id}`, {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify([role])
        })
      if (response.status !== 200) {
        throw new StyraRunHttpError(`Unexpected status code ${resp.status}`, 
          resp.status, response.text())
      }
      this.styraRunClient.handleEvent('rbac-update', {id, role})
    } catch (err) {
      this.styraRunClient.handleEvent('rbac-update', {id, role, err})
    }
    
    await this.renderRbacManagerPage(this.pageIndex)
  }

  async handleResponse(response) {
    if (response.status === 403) {
      throw new UnauthorizedError()
    }
    return response.status == 200 ? response.json() : {}
  }
  
  async renderRbacManagerPage(pageIndex = 1) {
    this.pageIndex = pageIndex

    const [roles, bindings] = await Promise.all([
        fetch(this.url + '/roles')
          .then(this.handleResponse)
          .then(({result}) => result ?? []),
        fetch(this.url + '/user_bindings?page=' + pageIndex)
          .then(this.handleResponse)
      ])
      .catch(err => {
        if (err instanceof UnauthorizedError) {
          this.renderNotAuthorized()
        } else {
          this.styraRunClient.handleEvent('rbac', {err})
          return [{}, {}]
        }
      })

    this.styraRunClient.handleEvent('rbac', {roles, bindings})
  
    const container = document.createElement('div')
    container.classList.add('rbac')
    const table = document.createElement('table')
    container.appendChild(table)

    table.innerHTML = `\
    <thead>
      <tr>
          <th>User</th>
          <th>Role</th>
      </tr>
    </thead>`

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
  
    if (bindings.result) {
      bindings.result?.forEach((binding) => {
        const [role] = binding.roles ?? []
        const user = {id: binding.id, role}
        const row = tbody.insertRow()
  
        const usernameCell = row.insertCell()
        usernameCell.appendChild(document.createTextNode(user.id))
  
        const roleCell = row.insertCell()
        this.renderRoleSelector(roleCell, roles, user)
      })
  
      const navigation = document.createElement('div')
      navigation.classList.add('navigation')
      container.appendChild(navigation)
  
      const page = bindings.page
      // Only show navigation buttons if we're on a page index
      if (page?.index) {
        const previousButton = document.createElement('button')
        previousButton.innerText = '<'
        previousButton.onclick = () => this.renderRbacManagerPage(page.index - 1)
        if (page.index <= 1) {
          previousButton.setAttribute('disabled', 'true')
        }
        navigation.appendChild(previousButton)

        const indexLabel = document.createElement('div')
        indexLabel.textContent = page.of ? `${page.index}/${page.of}` : `${page.index}`
        navigation.appendChild(indexLabel)
    
        const nextButton = document.createElement('button')
        nextButton.innerText = '>'
        nextButton.onclick = () => this.renderRbacManagerPage(page.index + 1)
        if (bindings.result.length == 0 || (page.of && page.index >= page.of)) {
          nextButton.setAttribute('disabled', 'true')
        }
        navigation.appendChild(nextButton)
      }
    }
    
    this.node.innerHTML = ''
    this.node.appendChild(container)
  }

  renderNotAuthorized() {
    const container = document.createElement('div')
    container.textContent = 'You are unauthorized for user role management.'
    this.node.innerHTML = ''
    this.node.appendChild(container)
  }

  async render() {
    try {
      await this.renderRbacManagerPage(1)
    } catch (err) {
      this.styraRunClient.handleEvent('rbac', {err})
      await this.renderNotAuthorized()
    }
  }
}

/**
 * Sets up and attaches an RBAC Management widget to the document.
 * 
 * @param {string} url the location of the RBAC Management API
 * @param {string} nodeSelector the CSS selector string to locate the document element to append the widget to (e.g. '#my-id', '.my-class')
 * @param {Client} styraRunClient the Styra Run client to use (defaults to the default Styra Run client)
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors
 */
async function render(url, nodeSelector, styraRunClient = defaultClient) {
  const node = document.querySelector(nodeSelector)

  if (!node) {
    throw Error(`No element could be found with selector string '${nodeSelector}'`)
  }
  
  const manager = new RbacManager(url, node, styraRunClient)
  await manager.render()
}

export default {
  render
}
