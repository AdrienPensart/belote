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
				if (rejection.status === 401) {
					localStorage.removeItem('token');
					window.location.href='/login';
				}
				console.error('Error response intercepted:', rejection);
				return $q.reject(rejection); // Always return a rejected promise
			}
		};
	})
	.config(function ($httpProvider) {
		$httpProvider.interceptors.push('myHttpInterceptor');
	})
  .controller('StatsCtrl', ['$http', function ($http) {
    const vm = this;
    $http.get('/user/stats').then((response) => {
        vm.stats = response.data;
    });
  }]);