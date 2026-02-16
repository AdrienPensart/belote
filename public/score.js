angular.module('meltdownApp', [])
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
                console.error('Error response intercepted:', rejection);
                if (rejection.status === 401) {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                }
                return $q.reject(rejection);
            }
        };
    })
    .config(function ($httpProvider) {
        $httpProvider.interceptors.push('myHttpInterceptor');
    })
    .controller('ScoreCtrl', ['$scope', '$http', function ($scope, $http) {
        const vm = this;

        vm.isOnTable = false;
        vm.loadingTableStatus = true;
        vm.authToken = (localStorage.getItem('token') || '').trim();
        if (!vm.authToken) {
            window.location.href = '/login';
        }

        // Game mode: 'belote' or 'coinche'
        vm.gameMode = 'belote';

        // Contract values for coinche
        vm.contractValues = [80, 90, 100, 110, 120, 130, 140, 150, 160, 250];
        vm.contractValue = 80;
        vm.coincheLevel = 1; // 1 = normal, 2 = coinché, 4 = surcoinché

        // Current round input
        vm.contractTeam = 'nous';
        vm.pointsNous = null;
        vm.pointsEux = null;
        vm.beloteNous = false;
        vm.beloteEux = false;
        vm.capot = null;

        // Score history
        vm.rounds = [];
        vm.totalNous = 0;
        vm.totalEux = 0;

        // Load saved game from localStorage
        vm.loadGame = function () {
            const savedGame = localStorage.getItem('belote_score_game');
            if (savedGame) {
                try {
                    const data = JSON.parse(savedGame);
                    vm.gameMode = data.gameMode || 'belote';
                    vm.rounds = data.rounds || [];
                    vm.calculateTotals();
                } catch (e) {
                    console.error('Error loading saved game:', e);
                }
            }
        };

        // Save game to localStorage
        vm.saveGame = function () {
            const data = {
                gameMode: vm.gameMode,
                rounds: vm.rounds
            };
            localStorage.setItem('belote_score_game', JSON.stringify(data));
        };

        // Set game mode
        vm.setGameMode = function (mode) {
            vm.gameMode = mode;
            vm.saveGame();
        };

        // Set contract team
        vm.setContractTeam = function (team) {
            vm.contractTeam = team;
        };

        // Set contract value (coinche)
        vm.setContractValue = function (value) {
            vm.contractValue = value;
        };

        // Set coinche level
        vm.setCoinche = function (level) {
            vm.coincheLevel = level;
        };

        // Sync points between teams (total = 162)
        vm.syncPoints = function (changedTeam) {
            const TOTAL_POINTS = 162;
            if (vm.capot) return; // Don't sync if capot is set

            if (changedTeam === 'nous' && vm.pointsNous !== null && vm.pointsNous !== '') {
                const points = parseInt(vm.pointsNous) || 0;
                if (points >= 0 && points <= TOTAL_POINTS) {
                    vm.pointsEux = TOTAL_POINTS - points;
                }
            } else if (changedTeam === 'eux' && vm.pointsEux !== null && vm.pointsEux !== '') {
                const points = parseInt(vm.pointsEux) || 0;
                if (points >= 0 && points <= TOTAL_POINTS) {
                    vm.pointsNous = TOTAL_POINTS - points;
                }
            }
        };

        // Set capot
        vm.setCapot = function (team) {
            vm.capot = team;
            if (team === 'nous') {
                vm.pointsNous = 162;
                vm.pointsEux = 0;
            } else if (team === 'eux') {
                vm.pointsNous = 0;
                vm.pointsEux = 162;
            }
        };

        // Check if we can calculate the result
        vm.canCalculate = function () {
            return vm.contractTeam &&
                (vm.pointsNous !== null && vm.pointsNous !== '') &&
                (vm.pointsEux !== null && vm.pointsEux !== '');
        };

        // Get preview result
        vm.getPreviewResult = function () {
            return vm.calculateRoundScore();
        };

        // Calculate round score based on Belote rules
        vm.calculateRoundScore = function () {
            const TOTAL_BASE = 162;
            const CAPOT_BONUS = 90;
            const BELOTE_BONUS = 20;

            let pointsNous = parseInt(vm.pointsNous) || 0;
            let pointsEux = parseInt(vm.pointsEux) || 0;

            // Add belote bonuses to card points
            let nousWithBelote = pointsNous + (vm.beloteNous ? BELOTE_BONUS : 0);
            let euxWithBelote = pointsEux + (vm.beloteEux ? BELOTE_BONUS : 0);

            // Determine if contract is successful
            let contractSuccess = false;
            let nousScore = 0;
            let euxScore = 0;
            let message = '';

            if (vm.gameMode === 'belote') {
                // Classic Belote rules
                if (vm.capot) {
                    // Capot case: 252 points (162 + 90 bonus)
                    const capotTotal = TOTAL_BASE + CAPOT_BONUS;
                    if (vm.capot === 'nous') {
                        nousScore = capotTotal + (vm.beloteNous ? BELOTE_BONUS : 0);
                        euxScore = vm.beloteEux ? BELOTE_BONUS : 0;
                        contractSuccess = vm.contractTeam === 'nous';
                    } else {
                        euxScore = capotTotal + (vm.beloteEux ? BELOTE_BONUS : 0);
                        nousScore = vm.beloteNous ? BELOTE_BONUS : 0;
                        contractSuccess = vm.contractTeam === 'eux';
                    }
                } else {
                    // Normal case: prenante must have more points
                    if (vm.contractTeam === 'nous') {
                        contractSuccess = nousWithBelote > euxWithBelote;
                    } else {
                        contractSuccess = euxWithBelote > nousWithBelote;
                    }

                    if (contractSuccess) {
                        // Both teams keep their points
                        nousScore = nousWithBelote;
                        euxScore = euxWithBelote;
                    } else {
                        // Chute: non-prenante gets all points
                        const totalPoints = TOTAL_BASE + (vm.beloteNous ? BELOTE_BONUS : 0) + (vm.beloteEux ? BELOTE_BONUS : 0);
                        if (vm.contractTeam === 'nous') {
                            // Nous has fallen, Eux gets everything
                            nousScore = 0;
                            euxScore = totalPoints;
                        } else {
                            // Eux has fallen, Nous gets everything
                            nousScore = totalPoints;
                            euxScore = 0;
                        }
                    }
                }

                // Litige case (égalité exacte 81-81 sans belote)
                if (!vm.capot && nousWithBelote === euxWithBelote) {
                    // In case of tie, prenante doesn't score, defender gets their points
                    if (vm.contractTeam === 'nous') {
                        nousScore = 0;
                        euxScore = euxWithBelote;
                    } else {
                        nousScore = nousWithBelote;
                        euxScore = 0;
                    }
                    contractSuccess = false;
                    message = 'Litige! Le preneur ne marque rien.';
                }
            } else {
                // Coinche rules
                if (vm.capot) {
                    // Capot in coinche
                    const capotTotal = 250 * vm.coincheLevel;
                    if (vm.capot === 'nous') {
                        nousScore = capotTotal + (vm.beloteNous ? BELOTE_BONUS : 0);
                        euxScore = vm.beloteEux ? BELOTE_BONUS : 0;
                        contractSuccess = vm.contractTeam === 'nous';
                    } else {
                        euxScore = capotTotal + (vm.beloteEux ? BELOTE_BONUS : 0);
                        nousScore = vm.beloteNous ? BELOTE_BONUS : 0;
                        contractSuccess = vm.contractTeam === 'eux';
                    }
                } else {
                    // Check if contract is met
                    const contractorPoints = vm.contractTeam === 'nous' ? nousWithBelote : euxWithBelote;
                    contractSuccess = contractorPoints >= vm.contractValue;

                    if (contractSuccess) {
                        // Contract made: prenante scores contract value, defender scores their points
                        const contractPoints = vm.contractValue * vm.coincheLevel;
                        if (vm.contractTeam === 'nous') {
                            nousScore = contractPoints + (vm.beloteNous ? BELOTE_BONUS : 0);
                            euxScore = euxWithBelote;
                        } else {
                            euxScore = contractPoints + (vm.beloteEux ? BELOTE_BONUS : 0);
                            nousScore = nousWithBelote;
                        }
                    } else {
                        // Contract failed: defender scores contract value + their points
                        const contractPoints = vm.contractValue * vm.coincheLevel;
                        if (vm.contractTeam === 'nous') {
                            nousScore = 0;
                            euxScore = contractPoints + TOTAL_BASE + (vm.beloteEux ? BELOTE_BONUS : 0);
                        } else {
                            nousScore = contractPoints + TOTAL_BASE + (vm.beloteNous ? BELOTE_BONUS : 0);
                            euxScore = 0;
                        }
                    }
                }
            }

            if (!message) {
                const preneurName = vm.contractTeam === 'nous' ? 'Nous' : 'Eux';
                if (vm.capot) {
                    const capotTeamName = vm.capot === 'nous' ? 'Nous' : 'Eux';
                    message = `Capot de ${capotTeamName}!`;
                    if (contractSuccess) {
                        message += ` Contrat réussi pour ${preneurName}.`;
                    } else {
                        message += ` Chute pour ${preneurName}.`;
                    }
                } else if (contractSuccess) {
                    message = `Contrat réussi pour ${preneurName}!`;
                } else {
                    message = `Chute! ${preneurName} perd le contrat.`;
                }
            }

            return {
                nousScore: Math.round(nousScore),
                euxScore: Math.round(euxScore),
                contractSuccess: contractSuccess,
                message: message,
                nousWins: nousScore > euxScore
            };
        };

        // Add round to history
        vm.addRound = function () {
            if (!vm.canCalculate()) return;

            const result = vm.calculateRoundScore();

            vm.rounds.push({
                contractTeam: vm.contractTeam,
                contractValue: vm.gameMode === 'coinche' ? vm.contractValue : null,
                coincheLevel: vm.gameMode === 'coinche' ? vm.coincheLevel : null,
                pointsNousRaw: parseInt(vm.pointsNous),
                pointsEuxRaw: parseInt(vm.pointsEux),
                beloteNous: vm.beloteNous,
                beloteEux: vm.beloteEux,
                capot: vm.capot,
                nousScore: result.nousScore,
                euxScore: result.euxScore,
                contractSuccess: result.contractSuccess
            });

            vm.calculateTotals();
            vm.saveGame();
            vm.resetRoundInput();
        };

        // Calculate totals
        vm.calculateTotals = function () {
            vm.totalNous = vm.rounds.reduce((sum, r) => sum + r.nousScore, 0);
            vm.totalEux = vm.rounds.reduce((sum, r) => sum + r.euxScore, 0);
        };

        // Reset round input
        vm.resetRoundInput = function () {
            vm.contractTeam = 'nous';
            vm.contractValue = 80;
            vm.coincheLevel = 1;
            vm.pointsNous = null;
            vm.pointsEux = null;
            vm.beloteNous = false;
            vm.beloteEux = false;
            vm.capot = null;
        };

        // Remove a round
        vm.removeRound = function (index) {
            if (confirm('Supprimer cette manche?')) {
                vm.rounds.splice(index, 1);
                vm.calculateTotals();
                vm.saveGame();
            }
        };

        // Reset entire game
        vm.resetGame = function () {
            if (confirm('Commencer une nouvelle partie? Les scores actuels seront effacés.')) {
                vm.rounds = [];
                vm.totalNous = 0;
                vm.totalEux = 0;
                vm.resetRoundInput();
                vm.saveGame();
            }
        };

        vm.refreshTablePresence = function () {
            vm.isOnTable = false;
            return $http.get('/tables').then((resp) => {
                const tablesData = resp.data;
                tablesData.forEach((fullTable) => {
                    let users = [];
                    for (var team of fullTable.teams) {
                        users = [...users, ...team.users.map((user) => {
                            return {
                                ...user,
                                team: team.name
                            };
                        })];
                    }
                    const onThatTable = users.find((elem) => elem.pseudo === vm.user.pseudo) !== undefined;
                    if (!fullTable.table.panama && onThatTable) {
                        vm.isOnTable = true;
                    }
                });
            }).catch((error) => {
                console.error('Failed to refresh table presence', error);
            }).finally(() => {
                vm.loadingTableStatus = false;
            });
        };

        vm.initAuth = function () {
            $http.get('/me').then((response) => {
                vm.user = response.data;
                return vm.refreshTablePresence();
            }).catch((error) => {
                console.error('Failed to load user information', error);
                vm.loadingTableStatus = false;
            });
        };

        // Initialize
        vm.loadGame();
        vm.initAuth();
    }]);
