function renderRoleSelector(anchor, roles, user) {
  const select = document.createElement('select')
  select.onchange = (e) => {
    console.info('onchange', e, user)
    updateUserRole(user.username, e.target.value)
  }

  const noneOption = document.createElement('option')
  noneOption.setAttribute('disabled', true)
  if (user.role === undefined) {
    noneOption.setAttribute('selected', true)
  } else if (!roles.includes(user.role)) {
    noneOption.setAttribute('selected', true)
    noneOption.innerText = user.role
  }
  select.appendChild(noneOption)
  
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

async function updateUserRole(username, role) {
  await fetch(`/api/rbac/users/${username}`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({role})
  })
  await renderRbacManager()
}

async function renderRbacManager() {
  const roles = await fetch('/api/rbac/roles').then((resp) => resp.json())
  const users = await fetch('/api/rbac/users').then((resp) => resp.json())

  const anchor = document.getElementById('authz-manage-rbac')
  
  if (anchor) {
    const table = document.createElement('table')

    const tableHeader = table.insertRow()
    tableHeader.innerHTML = `
      <th>User</th>
      <th>Role</th>`

    users.forEach((user) => {
      const row = table.insertRow()
      const usernameCell = row.insertCell()
      usernameCell.appendChild(document.createTextNode(user.username))
      const roleCell = row.insertCell()
      renderRoleSelector(roleCell, roles, user)
    })
  
    anchor.innerHTML = ''
    anchor.appendChild(table)
  }
}

renderRbacManager()
  .catch((err) => console.warn('Failed to render RBAC manager', err))