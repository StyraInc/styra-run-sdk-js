import {defaultClient} from "./run-sdk.js"

class RbacManager {
  constructor(url, anchor, styraRunClient) {
    this.url = url
    this.anchor = anchor
    this.styraRunClient = styraRunClient
  }

  renderRoleSelector(anchor, roles, user) {
    const select = document.createElement('select')
    select.onchange = (e) => {
      this.setBinding(user.id, e.target.value)
    }
  
    if (user.role === undefined || user || !roles.includes(user.role)) {
      const option = document.createElement('option')
      option.setAttribute('disabled', true)
      option.setAttribute('selected', true)
      option.innerText = user.role ?? ''
      select.appendChild(option)
    }
    
    roles.forEach((role) => {
      const option = document.createElement('option')
      option.innerText = role
      option.setAttribute('value', role)
      if (user.role === role) {
        option.setAttribute('selected', true)
      }
      
      select.appendChild(option)
    })
  
    anchor.appendChild(select)
  }
  
  async setBinding(id, role) {
    try {
      await fetch(`${this.url}/user_bindings/${id}`, {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify([role])
        })
        .then(async (resp) => {
          if (resp.status !== 200) {
            throw new Error(`Unexpected status code ${resp.status}`)
          }
        })
      this.styraRunClient.handleEvent('rbac-update', {id, role})
    } catch (err) {
      this.styraRunClient.handleEvent('rbac-update', {id, role, err})
    }
    
    await this.refresh()
  }
  
  async renderRbacManager() {
    const [roles, bindings] = await Promise.all([
      fetch(this.url + '/roles')
        .then((resp) => resp.status == 200 ? resp.json() : []),
      fetch(this.url + '/user_bindings')
        .then((resp) => resp.status == 200 ? resp.json() : {})
    ])

    this.styraRunClient.handleEvent('rbac', {roles, bindings})
  
    const table = document.createElement('table')
  
    const tableHeader = table.insertRow()
    tableHeader.innerHTML = `
      <th>User</th>
      <th>Role</th>`
  
    bindings.forEach((binding) => {
      const role = binding.roles !== undefined ? binding.roles[0] : undefined
      const user = {id: binding.id, role}
      const row = table.insertRow()
      const usernameCell = row.insertCell()
      usernameCell.appendChild(document.createTextNode(user.id))
      const roleCell = row.insertCell()
      this.renderRoleSelector(roleCell, roles, user)
    })
  
    this.anchor.innerHTML = ''
    this.anchor.appendChild(table)
  }

  async refresh() {
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
 * @param {string} anchorId the ID of the document element to append the widget to (defaults to 'authz-manage-rbac')
 * @param {Client} styraRunClient the Styra Run client to use (defaults to the default Styra Run client)
 */
async function setup(url, anchorId = 'authz-manage-rbac', styraRunClient = defaultClient) {
  const anchor = document.getElementById(anchorId)
  
  if (anchor) {
    const manager = new RbacManager(url, anchor, styraRunClient)
    await manager.refresh()
  }
}

export default {
  setup
}
