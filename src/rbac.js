import { defaultClient } from "./run-sdk.js"
import { StyraRunHttpError } from "./errors.js"

class RbacManager {
  constructor(url, anchor, styraRunClient) {
    this.url = url
    this.anchor = anchor
    this.styraRunClient = styraRunClient
  }

  renderRoleSelector(anchor, roles, user) {
    const selectNode = document.createElement('select')
    selectNode.onchange = (event) => {
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
  
    anchor.appendChild(selectNode)
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
    
    await this.render()
  }
  
  async renderRbacManager(pageIndex = 1) {
    const [roles, bindings] = await Promise.all([
      fetch(this.url + '/roles')
        .then((resp) => resp.status == 200 ? resp.json() : {})
        .then(({result}) => result ?? []),
      fetch(this.url + '/user_bindings?page=' + pageIndex)
        .then((resp) => resp.status == 200 ? resp.json() : {})
    ])

    this.styraRunClient.handleEvent('rbac', {roles, bindings})
  
    const container = document.createElement('div')
    container.classList.add('rbac')
    const table = document.createElement('table')
    container.appendChild(table)
  
    const tableHeader = table.insertRow()
    tableHeader.innerHTML = `
      <th>User</th>
      <th>Role</th>`
  
    if (bindings.result) {
      bindings.result?.forEach((binding) => {
        const [role] = binding.roles ?? []
        const user = {id: binding.id, role}
        const row = table.insertRow()
  
        const usernameCell = row.insertCell()
        usernameCell.appendChild(document.createTextNode(user.id))
  
        const roleCell = row.insertCell()
        this.renderRoleSelector(roleCell, roles, user)
      })
  
      const navigation = document.createElement('div')
      navigation.classList.add('navigation')
      container.appendChild(navigation)
  
      const page = bindings.page ? bindings.page : {}
      // Only show navigation buttons if we're on a page index
      if (page.index) {
        const previousButton = document.createElement('button')
        previousButton.innerText = '<'
        previousButton.onclick = () => this.renderRbacManager(page.index - 1)
        if (page.index <= 1) {
          previousButton.setAttribute('disabled', 'true')
        }
        navigation.appendChild(previousButton)

        const indexLabel = document.createElement('div')
        indexLabel.textContent = page.of ? `${page.index}/${page.of}` : `${page.index}`
        navigation.appendChild(indexLabel)
    
        const nextButton = document.createElement('button')
        nextButton.innerText = '>'
        nextButton.onclick = () => this.renderRbacManager(page.index + 1)
        if (bindings.result.length == 0 || (page.of && page.index >= page.of)) {
          nextButton.setAttribute('disabled', 'true')
        }
        navigation.appendChild(nextButton)
      }
    }
    
    this.anchor.innerHTML = ''
    this.anchor.appendChild(container)
  }

  async render() {
    try {
      await this.renderRbacManager()
    } catch (err) {
      this.styraRunClient.handleEvent('rbac', {err})
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
async function render(url, anchorQuery, styraRunClient = defaultClient) {
  const anchor = document.querySelector(anchorQuery)

  if (!anchor) {
    throw Error(`No anchor element could be found with selector string '${anchorQuery}'`)
  }
  
  const manager = new RbacManager(url, anchor, styraRunClient)
  await manager.render()
}

export default {
  render
}
