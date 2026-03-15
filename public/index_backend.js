angular.module('meltdownAdmin', [])
  .factory('myHttpInterceptor', function ($q) {
    return {
      'request': function (config) {
        config.headers['Authorization'] = (localStorage.getItem('token') || '').trim();
        return config;
      },
      // Optional method to handle successful responses
      response: function (response) {
        // Do something with the successful response
        // For example, modify data, add properties, or log
        return response; // Always return the response or a promise resolving to it
      },

      // Optional method to handle error responses
      responseError: function (rejection) {
        // Do something with the error response
        // For example, display error messages, redirect to login, or retry
        if (rejection.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        if (rejection.status === 403) {
          window.location.href = '/';
        }
        console.error('Error response intercepted:', rejection);
        return $q.reject(rejection); // Always return a rejected promise
      }
    };
  })
  .config(function ($httpProvider) {
    $httpProvider.interceptors.push('myHttpInterceptor');
  })
  .controller('AdminCtrl', ['$http', '$timeout', '$scope', function ($http, $timeout, $scope) {
    const vm = this;
    vm.username = '';
    vm.pseudosSelected = [];
    vm.tables = [];
    vm.users = [];
    vm.newUser = { pseudo: '', email: '', password: '', admin: false, ready: false, canPlayTarot: false, canPlayTwoTables: false };
    vm.authToken = (localStorage.getItem('token') || '').trim();
    vm.timer = -1;
    if (!vm.authToken) {
      window.location.href = '/login';
    }

    vm.refreshTables = function () {
      return $http.get('/tables').then((resp) => {
        const tablesData = resp.data;
        vm.tables = tablesData.map((fullTable) => {
          let users = [];
          for (var team of fullTable.teams) {
            users = [...users, ...team.users.map((user) => {
              return {
                ...user,
                team: team.name
              };
            })];
          }
          const readyCount = users.filter(u => u.ready).length;
          if (fullTable.table.panama) {
            users.sort((a, b) => a.pseudo.localeCompare(b.pseudo));
          }
          return { name: fullTable.table.name, id: fullTable.table.id, panama: fullTable.table.panama, users: users, readyCount, teams: fullTable.teams };
        });
        vm.pseudosSelected = vm.pseudosSelected.filter((elem) => vm.tables.findIndex((table) => table.users.findIndex((user) => user.pseudo === elem) !== -1) !== -1);
      });
    };

    vm.clearTables = function () {
      $http.get('/admin/tables/clear')
        .then(function () { vm.refreshTables(); })
    };

    vm.swapUsers = function () {
      $http.post('/admin/tables/swap', { pseudos: vm.pseudosSelected }).then(() => {
        vm.refreshTables();
      });
    }

    vm.createTable = function (gameModeName) {
      $http.post('/tables/manual', { gameModeName, pseudos: vm.pseudosSelected }).then(() => {
        vm.refreshTables();
      });
    }

    vm.generateTables = function () {
      $http.get('/admin/tables/generate')
        .then(function () { vm.refreshTables(); })
    };

    vm.reshuffleTables = function () {
      $http.get('/admin/tables/shuffle')
        .then(function () { vm.refreshTables(); })
    };

    vm.notifyAll = function () {
      $http.get('/admin/notify')
    };

    vm.ready = function (pseudo, ready) {
      vm.changeUserState(pseudo, { ready });
    };
    vm.canPlayTarot = function (pseudo, canPlayTarot) {
      vm.changeUserState(pseudo, { canPlayTarot });
    };
    vm.canPlayTwoTables = function (pseudo, canPlayTwoTables) {
      vm.changeUserState(pseudo, { canPlayTwoTables });
    };
    vm.changeUserState = function (pseudo, body) {
      $http.post('/admin/users/toggleUserState?pseudo=' + pseudo, body).then(() => {
        vm.refreshTables();
      });
    }

    vm.userDelete = function (pseudo) {
      $http.get('/admin/users/quit?pseudo=' + encodeURIComponent(pseudo))
        .then(function () {
          vm.refreshTables();
        })
    };

    vm.tableFinished = function (tableId, teamName) {
      if (window.confirm(`La team ${teamName} a gagné vous etes sur?`)) {
        $http.get(`/admin/users/finish?tableId=${tableId}&winningTeam=${teamName}`).then((response) => {
          vm.refreshTables();
        });
      }
    };

    vm.changeReadyState = function (tableId, ready) {
      $http.post('/admin/tables/changeReadyState', { ready, tableId })
        .then(function () {
          vm.refreshTables();
        })
    };

    vm.tableDelete = function (tableId) {
      $http.get('/admin/tables/delete?tableId=' + tableId)
        .then(response => {
          vm.refreshTables();
        })
    };

    vm.loadUsers = function () {
      return $http.get('/admin/users/full').then((resp) => {
        vm.users = resp.data.map((user) => ({ ...user, newPassword: '' }));
      });
    };

    vm.createUser = function () {
      const payload = { ...vm.newUser };
      $http.post('/admin/users/create', payload).then(() => {
        vm.newUser = { pseudo: '', email: '', password: '', admin: false, ready: false, canPlayTarot: false, canPlayTwoTables: false };
        vm.loadUsers();
      });
    };

    vm.saveUser = function (user) {
      const payload = {
        pseudo: user.pseudo,
        email: user.email,
        admin: user.admin,
        ready: user.ready,
        canPlayTarot: user.canPlayTarot,
        canPlayTwoTables: user.canPlayTwoTables,
        newPassword: user.newPassword || undefined
      };
      $http.post('/admin/users/update?userId=' + encodeURIComponent(user.id), payload).then(() => {
        user.newPassword = '';
        vm.loadUsers();
      });
    };

    vm.deleteUserAdmin = function (user) {
      if (!window.confirm(`Supprimer ${user.pseudo} ?`)) {
        return;
      }
      $http.delete('/admin/users/delete?userId=' + encodeURIComponent(user.id)).then(() => {
        vm.loadUsers();
      });
    };

    vm.generateToken = function (user) {
      $http.post('/admin/users/generateToken?userId=' + encodeURIComponent(user.id)).then((resp) => {
        user.generatedToken = resp.data.token;
      });
    };

    vm.addUserToPanama = function (user) {
      $http.post('/admin/users/addToPanama?userId=' + encodeURIComponent(user.id)).then(() => {
        vm.refreshTables();
      });
    };

    vm.formatTimestamp = function (value) {
      if (!value) return '-';
      const date = new Date(value);
      return isNaN(date.getTime()) ? '-' : date.toLocaleString();
    };

    vm.toggleUser = function (userName, checked) {
      if (checked) {
        if (!vm.pseudosSelected.includes(userName)) {
          vm.pseudosSelected.push(userName);
        }
      } else {
        vm.pseudosSelected =
          vm.pseudosSelected.filter(u => u !== userName);
      }
    }

    $http.get('/me').then((response) => {
      vm.user = response.data;
      vm.refreshTimer();
      vm.refreshTables().then(() => {
        vm.connectWebsocket();
      });
      vm.loadUsers();
    });

    vm.refreshTimer = function () {
      if (vm.refreshTimerWebService) {
        clearInterval(vm.refreshTimerWebService);
      }
      vm.refreshTimerWebService = setInterval(vm.refreshTimer, 5000);
      $http.get('/alarm').then((response) => {
        vm.timer = response.data.secondsLeft;
        if (vm.intervalRefreshTimer) {
          clearInterval(vm.intervalRefreshTimer);
        }
        if (vm.timer > 0) {
          vm.intervalRefreshTimer = setInterval(() => {
            vm.timer = vm.timer - 1;
            if (vm.timer <= 0) {
              clearInterval(vm.intervalRefreshTimer);
            }
            $scope.$applyAsync();
          }, 1000);
        } else {
          vm.refreshTables();
        }
        $scope.$applyAsync();
      });
    }

    vm.launchTimer = function (minutes) {
      $http.post('/admin/alarm/add', {
        minutes
      });
    }

    vm.removeTimer = function () {
      $http.delete('/admin/alarm/delete').then(() => {
        if (vm.intervalRefreshTimer) {
          clearInterval(vm.intervalRefreshTimer);
        }
        vm.timer = -1;
      });
    }

    vm.getTimerRendering = function (timer) {
      // Calculate minutes
      const minutes = Math.floor(timer / 60);

      // Calculate remaining seconds
      const seconds = timer % 60;

      // Format minutes and seconds with leading zeros if necessary
      const formattedMinutes = String(minutes).padStart(2, '0');
      const formattedSeconds = String(seconds).padStart(2, '0');

      return `${formattedMinutes}:${formattedSeconds}`;
    }

    vm.connectWebsocket = function () {
      const scheme = document.location.protocol === 'http:' ? 'ws://' : 'wss://';

      function connect() {
        const ws = new WebSocket(scheme + location.host + '/socket?auth_token=' + encodeURIComponent(vm.authToken));
        vm.websocket = ws;

        ws.onopen = function () {
          vm.messages = 'Connected to Meltdown, tables updated';
          $scope.$applyAsync();
          // vm.refreshTables();
        };

        ws.onmessage = function (event) {
          vm.refreshTables();
          vm.refreshTimer();
        };

        ws.onerror = function () { try { ws.close(); } catch (e) { } };

        ws.onclose = function () {
          $scope.$applyAsync();
          $timeout(connect, 1000);
        };
      }

      connect();
    };
  }
  ]);