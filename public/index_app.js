angular.module('meltdownApp', [])
  .controller('MainController', ['$http', '$timeout', function ($http, $timeout) {
    const vm = this;
    vm.username = localStorage.getItem('username') || '';
    if (vm.username) {
      vm.usernameInput = vm.username;
    }
    vm.joinDisabled = !!vm.username;
    vm.connected = !!vm.username;
    vm.tables = [];
    vm.message = 'disconnected';

    vm.join = function () {
      $http({
        method: 'GET',
        url: '/me/join?username=' + encodeURIComponent(vm.usernameInput),
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'text/plain'
        },
        responseType: 'text'
      }).then(response => {
        localStorage.setItem('username', vm.usernameInput);
        vm.username = vm.usernameInput;
        vm.joinDisabled = true;
        vm.connected = true;
        vm.connectWebsocket();
        vm.refreshTables();
      });
    };

    vm.quit = function () {
      $http.get('/me/quit?username=' + encodeURIComponent(vm.username)).then(() => {
        localStorage.removeItem('username');
        vm.username = '';
        vm.connected = false;
        vm.joinDisabled = false;
        vm.refreshTables();
      });
    };

    vm.finish = function () {
      $http.get('/me/finish?username=' + encodeURIComponent(vm.username)).then((response) => {
        if (response.status === 404) {
          vm.quit();
        } else {
          vm.refreshTables();
        }
      });
    };

    vm.ready = function () {
      $http.get('/me/ready?username=' + encodeURIComponent(vm.username)).then((response) => {
        if (response.status === 404) {
          vm.quit();
        } else {
          vm.refreshTables();
        }
      });
    };

    vm.refreshTables = function () {
      $http.get('/public/tables').then((resp) => {
        const tablesData = resp.data;
        vm.tables = Object.entries(tablesData).map(([name, users]) => {
          const usersList = Object.values(users).map(user => ({
            name: user.name,
            ready: user.ready,
            ip: user.ip
          }));
          const readyCount = usersList.filter(u => u.ready).length;
          return { name, users: usersList, readyCount };
        });

        const found = vm.tables.some(table =>
          table.users.some(user => user.name === vm.username)
        );

        if (!found) {
          vm.connected = false;
          vm.joinDisabled = false;
        }
      });
    };

    vm.connectWebsocket = function () {
      const scheme = location.protocol === 'http:' ? 'ws://' : 'wss://';
      const ws = new WebSocket(scheme + location.host + '/me/meltdown?username=' + encodeURIComponent(vm.username));

      ws.onopen = () => {
        vm.message = 'Connected to Meltdown, tables updated';
        vm.refreshTables();
      };

      ws.onmessage = (event) => {
        vm.message = `Update tables because : ${event.data}`;
        vm.refreshTables();
      };

      ws.onerror = () => ws.close();

      ws.onclose = () => {
        vm.message = 'Disconnected from Meltdown!';
        vm.tables = [];
        $timeout(vm.connectWebsocket, 1000);
      };
    };

    if (vm.username) {
      vm.connectWebsocket();
    }

    vm.refreshTables();
  }]);