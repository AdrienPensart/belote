angular.module('meltdownAdmin', [])
  .factory('myHttpInterceptor', function ($q) {
    return {
      'request': function(config) {
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
          window.location.href='/login';
        }
        if (rejection.status === 403) {
          window.location.href='/';
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
    vm.tables = [];
    vm.username = '';
    vm.authToken = (localStorage.getItem('token') || '').trim();
    vm.timer = -1;
    if (!vm.authToken) {
      window.location.href='/login';
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
          return {name:fullTable.table.name,id: fullTable.table.id,panama: fullTable.table.panama, users: users, readyCount, teams:fullTable.teams };
        });
      });
    };

    vm.clearTables = function () {
      $http.get('/admin/tables/clear')
        .then(function () { vm.refreshTables(); })
    };

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
      vm.changeUserState(pseudo,{ready});
    };
    vm.canPlayTarot = function (pseudo,canPlayTarot) {
      vm.changeUserState(pseudo,{canPlayTarot});
    };
    vm.canPlayTwoTables = function (pseudo,canPlayTwoTables) {
      vm.changeUserState(pseudo,{canPlayTwoTables});
    };
    vm.changeUserState= function(pseudo, body) {
      $http.post('/admin/users/toggleUserState?pseudo=' + pseudo,body).then(() => {
        vm.refreshTables();
      });
    }

    vm.userDelete = function (pseudo) {
      $http.get('/admin/users/quit?pseudo=' + encodeURIComponent(pseudo))
        .then(function () {
          vm.refreshTables();
        })
    };

    vm.tableFinished = function (tableId,teamName) {
      if (window.confirm(`La team ${teamName} a gagné vous etes sur?`)) {
         $http.get(`/admin/users/finish?tableId=${tableId}&winningTeam=${teamName}`).then((response) => {
          vm.refreshTables();
        });
      }
    };

    vm.changeReadyState = function (tableId, ready) {
      $http.post('/admin/tables/changeReadyState', {ready, tableId})
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

    $http.get('/me').then((response) => {
      vm.user = response.data;
      vm.refreshTimer();
      vm.refreshTables().then(() => {
        vm.connectWebsocket();
      });
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
            vm.timer = vm.timer-1;
            if (vm.timer <=0) {
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
      $http.post('/admin/alarm/add',{
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