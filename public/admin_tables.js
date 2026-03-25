angular.module('meltdownAdminTables', [])
    .factory('myHttpInterceptor', function ($q) {
        return {
            request: function (config) {
                config.headers['Authorization'] = (localStorage.getItem('token') || '').trim();
                return config;
            },
            response: function (response) {
                return response;
            },
            responseError: function (rejection) {
                if (rejection.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                }
                if (rejection.status === 403) {
                    window.location.href = '/';
                }
                console.error('Error response intercepted:', rejection);
                return $q.reject(rejection);
            }
        };
    })
    .config(function ($httpProvider) {
        $httpProvider.interceptors.push('myHttpInterceptor');
    })
    .controller('AdminTablesCtrl', ['$http', '$timeout', function ($http, $timeout) {
        var vm = this;
        vm.tables = [];
        vm.loading = true;
        vm.authToken = (localStorage.getItem('token') || '').trim();

        vm.loadTables = function () {
            $http.get('/admin/tables/all').then(function (resp) {
                vm.tables = resp.data.sort(function (a, b) {
                    var aFinished = a.table.finishedAt ? 1 : 0;
                    var bFinished = b.table.finishedAt ? 1 : 0;
                    return aFinished - bFinished;
                });
                vm.loading = false;
            }).catch(function () {
                vm.loading = false;
            });
        };

        vm.deleteTable = function (tableId) {
            if (!confirm('Supprimer cette table et toutes ses manches ?')) return;
            $http.delete('/admin/tables/delete?tableId=' + tableId).then(function () {
                vm.loadTables();
            });
        };

        vm.getTeamPlayers = function (game, teamName) {
            var team = game.teams.find(function (t) { return t.name === teamName; });
            if (!team) return '';
            return team.users.map(function (u) { return u.pseudo; }).join(', ');
        };

        vm.getTeamScore = function (game, teamIndex) {
            if (teamIndex === 0) return game.scoreTeam1;
            if (teamIndex === 1) return game.scoreTeam2;
            return '-';
        };

        vm.connectWebsocket = function () {
            var scheme = document.location.protocol === 'http:' ? 'ws://' : 'wss://';
            function connect() {
                var ws = new WebSocket(scheme + location.host + '/socket?auth_token=' + encodeURIComponent(vm.authToken));
                ws.onmessage = function () { vm.loadTables(); };
                ws.onerror = function () { try { ws.close(); } catch (e) { } };
                ws.onclose = function () { $timeout(connect, 1000); };
            }
            connect();
        };

        vm.loadTables();
        vm.connectWebsocket();
    }]);
