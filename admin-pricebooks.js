// Replace with your deployed Apps Script Web App URL
const API_URL = 'https://script.google.com/a/macros/drop2drop.com/s/AKfycbxH0bLS6ReVtCqwGKtbAOvILrOFnO2o48r3FNiZpbhYcGnw1iKW_eMIYklBTMFVofoMCw/exec';

// Simple front-end password (visual only).
// Real protection is from Google auth on the Apps Script side.
const ADMIN_PASSWORD = '@drop2drop.com';

(function() {
  const loginPanel   = document.getElementById('login-panel');
  const adminPanel   = document.getElementById('admin-panel');
  const loginInput   = document.getElementById('admin-password');
  const loginBtn     = document.getElementById('login-btn');
  const loginStatus  = document.getElementById('login-status');
  const refreshBtn   = document.getElementById('refresh-btn');
  const adminStatus  = document.getElementById('admin-status');
  const tbody        = document.getElementById('restaurants-body');

  function isLoggedIn() {
    return localStorage.getItem('d2dAdminAuth') === '1';
  }

  function setLoggedIn(value) {
    if (value) {
      localStorage.setItem('d2dAdminAuth', '1');
    } else {
      localStorage.removeItem('d2dAdminAuth');
    }
  }

  function showAdminPanel() {
    loginPanel.style.display = 'none';
    adminPanel.style.display = 'block';
    adminStatus.textContent = 'Loading restaurants...';
    fetchRestaurants();
  }

  function handleLogin() {
    const pwd = loginInput.value.trim();
    if (pwd === ADMIN_PASSWORD) {
      setLoggedIn(true);
      loginStatus.textContent = '';
      showAdminPanel();
    } else {
      loginStatus.textContent = 'Incorrect password.';
    }
  }

  loginBtn.addEventListener('click', handleLogin);
  loginInput.addEventListener('keyup', function(e) {
    if (e.key === 'Enter') handleLogin();
  });

  refreshBtn.addEventListener('click', function() {
    adminStatus.textContent = 'Refreshing...';
    fetchRestaurants();
  });

  function fetchRestaurants() {
    tbody.innerHTML = '';
    fetch(API_URL + '?action=listRestaurants', {
      method: 'GET',
      credentials: 'include' // important so your Google session is used
    })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) {
          adminStatus.textContent = 'Error: ' + data.error + ' (Are you logged into the correct Google account?)';
          return;
        }
        renderRestaurants(data.restaurants || []);
        adminStatus.textContent = 'Loaded ' + (data.restaurants || []).length + ' restaurants.';
      })
      .catch(function(err) {
        adminStatus.textContent = 'Request failed. Check console.';
        console.error(err);
      });
  }

  function renderRestaurants(list) {
    tbody.innerHTML = '';
    if (!list.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 2;
      td.textContent = 'No price books found.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    list.forEach(function(item) {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = item.restaurant;
      tr.appendChild(tdName);

      const tdActions = document.createElement('td');
      tdActions.className = 'right';

      const btnExport = document.createElement('button');
      btnExport.className = 'primary';
      btnExport.textContent = 'Export & Email';
      btnExport.addEventListener('click', function() {
        exportCustomerView(item.restaurant);
      });

      tdActions.appendChild(btnExport);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  function exportCustomerView(restaurant) {
    adminStatus.textContent = 'Exporting for ' + restaurant + '...';
    fetch(API_URL + '?action=exportCustomerView&restaurant=' + encodeURIComponent(restaurant), {
      method: 'GET',
      credentials: 'include'
    })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.error) {
          adminStatus.textContent = 'Error: ' + data.error;
          return;
        }
        adminStatus.textContent = 'Exported and emailed: ' + restaurant;
      })
      .catch(function(err) {
        adminStatus.textContent = 'Export failed. Check console.';
        console.error(err);
      });
  }

  // On load: auto-login if localStorage flag is set
  if (isLoggedIn()) {
    showAdminPanel();
  }
})();
