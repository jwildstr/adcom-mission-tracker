const postFormAdmin = async() => {
  document.querySelector('#mainContent').classList.add('d-none')
  document.querySelector('#adminLoginStatus').classList.remove('d-none')
  document.querySelector('#adminLoginStatus').innerText = 'Loading ...'

  const data = {
    "password": document.querySelector('#adminControlPass').value
  }

  await fetch('api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then((response) => {
    if (response.ok) {
      return response.json()
    } else if (response.status === 401) {
      document.querySelector('#adminLoginStatus').innerText = 'Incorrect password'
    } else {
      console.error(`Server error while logging in: (${response.status})`)
      document.querySelector('#adminLoginStatus').innerText = `Server error (${response.status})`
    }
  })
  .then((responseJson) => {
    if (!responseJson) {
      return
    }

    document.querySelector('#existingVersion_ADCOM').innerText = responseJson.PLAYFAB_TITLE_ID_ADCOM || "unknown";
    document.querySelector('#existingVersion_AGES').innerText = responseJson.PLAYFAB_TITLE_ID_AGES || "unknown";
    document.querySelector('#secondaryAdminAuthentication').value = document.querySelector('#adminControlPass').value
    document.querySelector('#mainContent').classList.remove('d-none')
    document.querySelector('#adminLoginStatus').classList.add('d-none')
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#adminLoginStatus').innerText = 'Please check your internet connection'
  })
}

const postFormUpdateDataFile = async() => {
  document.querySelector('#updateDataFileStatus').classList.remove('d-none')
  document.querySelector('#updateDataFileStatus').classList.remove('text-success')
  document.querySelector('#updateDataFileStatus').classList.add('text-danger')
  document.querySelector('#updateDataFileStatus').innerText = 'Please wait ...'

  const data = {
    "password": document.querySelector('#secondaryAdminAuthentication').value,
    "title": document.querySelector('input[name="title"]:checked').value,
    "version": document.querySelector('#dataVersion').value
  }

  return await fetch('api/admin/data-file', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then((response) => {
    if (response.ok) {
      document.querySelector('#updateDataFileStatus').classList.add('text-success')
      document.querySelector('#updateDataFileStatus').classList.remove('text-danger')
      document.querySelector('#updateDataFileStatus').innerText = `Successfully updated data files to version ${document.querySelector('#dataVersion').value}`
    } else if (response.status === 401) {
      document.querySelector('#updateDataFileStatus').innerText = 'Incorrect password'
    } else {
      console.error(`Server error (${response.status})`)
      return response.json()
    }
  })
  .then((responseJson) => {
    if (!responseJson) {
      return
    }

    document.querySelector('#updateDataFileStatus').innerText = responseJson.message
  })
  .catch((error) => {
    console.error(error)
    document.querySelector('#updateDataFileStatus').innerText = 'Please check your internet connection'
    return
  })
}

document.querySelector('#formSubmitAdmin').addEventListener('click', function() {
  postFormAdmin()
})

document.querySelector('#formSubmitUpdateDataFile').addEventListener('click', function() {
  postFormUpdateDataFile()
})