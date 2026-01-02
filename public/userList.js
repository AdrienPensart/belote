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
  .controller('UserListCtrl', ['$http', function ($http, $timeout) {
    const vm = this;
    
    $http.get('/admin/users').then((response) => {
        vm.userList = response.data;
    });
  }]);