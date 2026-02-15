angular.module('meltdownApp', [])
  .controller('LoginCtrl', ['$http', '$timeout', function ($http, $timeout) {
    const vm = this;
    vm.pseudo = (localStorage.getItem('username') || '').trim();
    vm.email = (localStorage.getItem('email') || '').trim();
    vm.loginError = false;
    vm.accountCreationError = false;

    vm.auth = function () {
      $http({
        method: 'POST',
        url: '/auth',
        data: {email: vm.email.trim(), password: vm.password},
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'text/plain'
        },
        responseType: 'text'
      }).then(response => {
        localStorage.setItem('username', vm.pseudo.trim());
        localStorage.setItem('email', vm.email.trim());
        localStorage.setItem('token', response.headers('Authorization'));
        vm.loginError = false;
        window.location.href='/';
      }).catch((error) => {
        vm.loginError = true;
      });
    };
    vm.createAccount = function () {
      $http({
        method: 'POST',
        url: '/createAccount',
        data: {pseudo: vm.newAccountPseudo.trim(), password: vm.passwordTwo, email: vm.newAccountEmail.trim()},
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'text/plain'
        },
        responseType: 'text'
      }).then(response => {
        localStorage.setItem('email', vm.newAccountEmail.trim());
        localStorage.setItem('username', vm.newAccountPseudo.trim());
        localStorage.setItem('token', response.headers('Authorization'));
        vm.creationError = false;
        window.location.href='/';
      }).catch((error) => {
        vm.creationError = true;
      });
    };
  }]);