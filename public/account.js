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
  .controller('AccountCtrl', ['$http', '$timeout', function ($http, $timeout) {
    const vm = this;

    vm.passwordChangeError = false;
    vm.userPasswordResetChangeError = false;
    
    $http.get('/me').then((response) => {
        vm.user = response.data;
    });
    vm.changeUserPassword = function () {
      $http({
        method: 'POST',
        url: '/passwordChange',
        data: {oldPassword: vm.oldPassword.trim(), newPassword: vm.newPassword},
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'text/plain'
        },
        responseType: 'text'
      }).then(response => {
        vm.passwordChangeError = false;
      }).catch((error) => {
        vm.passwordChangeError = true;
      });
    };
    vm.resetUserPassword = function () {
      $http({
        method: 'POST',
        url: '/admin/users/passwordChange?pseudo='+ vm.pseudo.trim(),
        data: {newPassword: vm.newPassword},
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'text/plain'
        },
        responseType: 'text'
      }).then(response => {
        vm.userPasswordResetChangeError = false;
      }).catch((error) => {
        vm.userPasswordResetChangeError = true;
      });
    };
  }]);