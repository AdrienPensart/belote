angular.module('meltdownApp', [])
    .factory('myHttpInterceptor', function ($q) {
        return {
            'request': function(config) {
                config.headers['Authorization'] = (localStorage.getItem('token') || '').trim();
                return config;
            },
            response: function (response) {
                return response;
            },
            responseError: function (rejection) {
                if (rejection.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href='/login';
                }
                console.error('Error response intercepted:', rejection);
                return $q.reject(rejection);
            }
        };
    })
    .config(function ($httpProvider) {
        $httpProvider.interceptors.push('myHttpInterceptor');
    })
    .controller('HistoryCtrl', ['$http', function ($http) {
        const vm = this;
        vm.history = [];

        $http.get('/user/history').then((response) => {
            vm.history = response.data;
        });
    }]);
