import StyraRun, {defaultClient} from "./run-sdk.js"

class RbacManager {
  constructor(anchor, styraRunClient) {
    this.anchor = anchor
    this.styraRunClient = styraRunClient
  }

  renderRoleSelector(anchor, roles, user) {
    const select = document.createElement('select')
    select.setAttribute('authz', '/rbac/manage/allow')
    select.onchange = (e) => {
      this.setBinding(user.username, e.target.value)
    }
  
    if (user.role === undefined || !roles.includes(user.role)) {
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
  
  async setBinding(user, role) {
    try {
      await fetch('/api/rbac/user_bindings', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({user, role})
        })
        .then(async (resp) => {
          if (resp.status !== 200) {
            throw new Error(`Unexpected status code ${resp.status}`)
          }
        })
      this.styraRunClient.handleEvent('rbac-update', {user, role})
    } catch (err) {
      this.styraRunClient.handleEvent('rbac-update', {user, role, err})
    }
    
    await this.refresh()
  }
  
  async renderRbacManager() {
    const [roles, bindings] = await Promise.all([
      fetch('/api/rbac/roles')
        .then((resp) => resp.status == 200 ? resp.json() : []),
      fetch('/api/rbac/user_bindings')
        .then((resp) => resp.status == 200 ? resp.json() : {})
    ])

    this.styraRunClient.handleEvent('rbac', {roles, bindings})
  
    const table = document.createElement('table')
  
    const tableHeader = table.insertRow()
    tableHeader.innerHTML = `
      <th>User</th>
      <th>Role</th>`
  
    Object.keys(bindings)
      .map((username) => {
        const role = bindings[username][0]
        return {username, role}
      })
      .forEach((user) => {
        const row = table.insertRow()
        const usernameCell = row.insertCell()
        usernameCell.appendChild(document.createTextNode(user.username))
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


async function setup(anchorId = 'authz-manage-rbac', styraRunClient = defaultClient) {
  const anchor = document.getElementById(anchorId)
  
  if (anchor) {
    const manager = new RbacManager(anchor, styraRunClient)
    await manager.refresh()
  }
}

export default {
  setup
}
