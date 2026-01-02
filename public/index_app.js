angular.module('meltdownApp', [])
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
                console.error('Error response intercepted:', rejection);
                if (rejection.status === 401) {
                  localStorage.removeItem('token');
                  window.location.href='/login';
                }
                
                return $q.reject(rejection); // Always return a rejected promise
            }
        };
  })
  .config(function ($httpProvider) {
      $httpProvider.interceptors.push('myHttpInterceptor');
  })
  .controller('MainController', ['$http', '$timeout','$scope', function ($http, $timeout, $scope) {
    const vm = this;
    vm.username = (localStorage.getItem('username') || '').trim();
    vm.authToken = (localStorage.getItem('token') || '').trim();
    if (!vm.authToken) {
      window.location.href='/login';
    }
    if (vm.username) {
      vm.usernameInput = vm.username;
    }
    vm.tables = [];
    vm.timer = -1;

    vm.quit = function () {
      $http.get('/user/quit').then(() => {
        vm.websocket.close();
        setTimeout(() => {
          localStorage.removeItem('username');
          localStorage.removeItem('token');
          window.location.href='/';
        }, 500);
      });
    };

    vm.finish = function (tableId,teamName) {
      if (window.confirm(`La team ${teamName} a gagné vous etes sur?`)) {
        $http.get(`/user/finish?tableId=${tableId}&winningTeam=${teamName}`).then((response) => {
          vm.refreshTables();
        });
      }
    };

    vm.ready = function (ready) {
      this.changeUserState({ready});
    };
    vm.canPlayTarot = function (canPlayTarot) {
      this.changeUserState({canPlayTarot});
    };
    vm.canPlayTwoTables = function (canPlayTwoTables) {
      this.changeUserState({canPlayTwoTables});
    };
    vm.changeUserState= function(body) {
      $http.post('/user/changeUserState',body).then(() => {
        vm.refreshTables();
      });
    }

    vm.refreshTables = function () {
      vm.onTable = false;
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
          let onThatTable = users.find((elem) => elem.pseudo === vm.user.pseudo) !== undefined;
          if (!fullTable.table.panama && onThatTable) {
            vm.onTable = true;
          }
          const readyCount = users.filter(u => u.ready).length;
          return {name:fullTable.table.name,id: fullTable.table.id,panama: fullTable.table.panama, users: users, readyCount, inThatTable: onThatTable, teams:fullTable.teams};
        });
      });
    };

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

    vm.connectWebsocket = function () {
      const scheme = location.protocol === 'http:' ? 'ws://' : 'wss://';
      const ws = new WebSocket(scheme + location.host + '/socket?auth_token=' + encodeURIComponent(vm.authToken));
      vm.websocket = ws;

      ws.onmessage = (event) => {
        vm.refreshTables();
      };

      ws.onerror = () => ws.close();

      ws.onclose = () => {
        $timeout(vm.connectWebsocket, 1000);
      };
    };

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

    $http.get('/me').then((response) => {
      vm.user = response.data;
      vm.refreshTimer();
      vm.refreshTables().then(() => {
          vm.connectWebsocket();
      });
    });
  }
]);