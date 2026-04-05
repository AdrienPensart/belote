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
    .controller('TableCtrl', ['$scope', '$http', '$timeout', function ($scope, $http, $timeout) {
        var vm = this;

        vm.loading = true;
        vm.showLoading = false;
        $timeout(function () {
            if (vm.loading) vm.showLoading = true;
        }, 400);
        vm.authToken = (localStorage.getItem('token') || '').trim();
        if (!vm.authToken) {
            window.location.href = '/login';
        }

        // Table info
        vm.tableId = null;
        vm.tableName = '';
        vm.team1Name = '';
        vm.team2Name = '';
        vm.team1Players = [];
        vm.team2Players = [];
        vm.user = null;

        // Settings
        vm.pointsLimit = 1001;
        vm.customLimit = 301;
        vm.scoringMode = 'belote';
        vm.litige = 0;

        // Contract values for coinche
        vm.contractValues = [80, 90, 100, 110, 120, 130, 140, 150, 160, 250];
        vm.contractValue = 80;
        vm.coincheLevel = 1;

        // Current round input
        vm.contractTeam = '';
        vm.pointsTeam1 = null;
        vm.pointsTeam2 = null;
        vm.beloteTeam = null; // null, team1Name, or team2Name
        vm.capot = null;

        // Score data
        vm.rounds = [];
        vm.totalTeam1 = 0;
        vm.totalTeam2 = 0;
        vm.winnerTeam = null;

        // Get tableId from URL query param
        function getTableIdFromUrl() {
            var params = new URLSearchParams(window.location.search);
            var id = params.get('tableId');
            return id ? parseInt(id) : null;
        }

        // Initialize: get user, find their table, load data
        vm.init = function () {
            $http.get('/me').then(function (response) {
                vm.user = response.data;
                var urlTableId = getTableIdFromUrl();
                if (urlTableId) {
                    vm.loadTableInfo(urlTableId);
                } else {
                    vm.findUserTable();
                }
            }).catch(function () {
                vm.loading = false;
            });
        };

        // Find user's current non-Panama table
        vm.findUserTable = function () {
            $http.get('/tables').then(function (resp) {
                var tablesData = resp.data;
                for (var i = 0; i < tablesData.length; i++) {
                    var fullTable = tablesData[i];
                    if (fullTable.table.panama) continue;
                    for (var t = 0; t < fullTable.teams.length; t++) {
                        for (var u = 0; u < fullTable.teams[t].users.length; u++) {
                            if (fullTable.teams[t].users[u].pseudo === vm.user.pseudo) {
                                vm.setupTable(fullTable);
                                return;
                            }
                        }
                    }
                }
                vm.loading = false;
            }).catch(function () {
                vm.loading = false;
            });
        };

        // Load table info by ID (with access check via backend)
        vm.loadTableInfo = function (tableId) {
            $http.get('/table/info?tableId=' + tableId).then(function (resp) {
                vm.setupTable(resp.data);
            }).catch(function (err) {
                if (err.status === 403) {
                    vm.tableId = null;
                }
                vm.loading = false;
            });
        };

        // Set up table data from a FullTable object
        vm.setupTable = function (fullTable) {
            vm.tableId = fullTable.table.id;
            vm.tableName = fullTable.table.name;
            vm.pointsLimit = fullTable.table.pointsLimit || 1001;
            vm.scoringMode = fullTable.table.scoringMode || 'belote';
            vm.litige = fullTable.table.litige || 0;
            if (vm.isCustomLimit()) {
                vm.customLimit = vm.pointsLimit;
            }

            // Extract team names (first two non-panama teams)
            var teams = fullTable.teams;
            if (teams.length >= 2) {
                vm.team1Name = teams[0].name;
                vm.team2Name = teams[1].name;
                vm.team1Players = teams[0].users.map(function (u) { return u.pseudo; });
                vm.team2Players = teams[1].users.map(function (u) { return u.pseudo; });
            } else if (teams.length === 1) {
                vm.team1Name = teams[0].name;
                vm.team2Name = 'team2';
                vm.team1Players = teams[0].users.map(function (u) { return u.pseudo; });
                vm.team2Players = [];
            }

            vm.contractTeam = vm.team1Name;
            vm.loading = false;
            vm.showLoading = false;

            vm.refreshRounds();
            vm.connectWebsocket();
        };

        // Refresh rounds from backend
        vm.refreshRounds = function () {
            if (!vm.tableId) return;
            $http.get('/table/rounds?tableId=' + vm.tableId).then(function (resp) {
                vm.rounds = resp.data;
                vm.rounds.forEach(function (round) {
                    var t1 = round.pointsTeam1Raw + (round.beloteTeam1 ? 20 : 0);
                    var t2 = round.pointsTeam2Raw + (round.beloteTeam2 ? 20 : 0);
                    round.litige = !round.capot && !round.contractSuccess && t1 === t2;
                });
                vm.calculateTotals();
            });
        };

        // Refresh table info (settings may have changed)
        vm.refreshTableInfo = function () {
            if (!vm.tableId) return;
            $http.get('/table/info?tableId=' + vm.tableId).then(function (resp) {
                vm.pointsLimit = resp.data.table.pointsLimit || 1001;
                vm.scoringMode = resp.data.table.scoringMode || 'belote';
                vm.litige = resp.data.table.litige || 0;
                if (vm.isCustomLimit()) {
                    vm.customLimit = vm.pointsLimit;
                }
                var teams = resp.data.teams;
                if (teams.length >= 2) {
                    vm.team1Players = teams[0].users.map(function (u) { return u.pseudo; });
                    vm.team2Players = teams[1].users.map(function (u) { return u.pseudo; });
                }
                vm.refreshRounds();
            }).catch(function (err) {
                if (err.status === 403) {
                    // Table finished or user removed, redirect home
                    window.location.href = '/';
                }
            });
        };

        // WebSocket for real-time sync
        vm.connectWebsocket = function () {
            var scheme = location.protocol === 'http:' ? 'ws://' : 'wss://';
            var ws = new WebSocket(scheme + location.host + '/socket?auth_token=' + encodeURIComponent(vm.authToken));
            vm.websocket = ws;

            ws.onmessage = function () {
                if (vm._refreshTimer) $timeout.cancel(vm._refreshTimer);
                vm._refreshTimer = $timeout(function () {
                    vm.refreshTableInfo();
                }, 300);
            };

            ws.onerror = function () { ws.close(); };

            ws.onclose = function () {
                $timeout(vm.connectWebsocket, 1000);
            };
        };

        // Settings
        vm.setPointsLimit = function (limit) {
            if (!limit || limit < 1) return;
            vm.pointsLimit = limit;
            vm.saveSettings();
        };

        vm.isCustomLimit = function () {
            if (vm.scoringMode === 'coinche') {
                return vm.pointsLimit !== 2000 && vm.pointsLimit !== 3000;
            }
            return vm.pointsLimit !== 1001 && vm.pointsLimit !== 501;
        };

        vm.setCustomLimit = function () {
            vm.customLimit = vm.scoringMode === 'coinche' ? 1000 : 301;
            vm.setPointsLimit(vm.customLimit);
        };

        vm.setScoringMode = function (mode) {
            vm.scoringMode = mode;
            var newCustomDefault = mode === 'coinche' ? 1000 : 301;
            vm.customLimit = newCustomDefault;
            if (mode === 'coinche') {
                if (vm.pointsLimit === 1001 || vm.pointsLimit === 501) {
                    vm.pointsLimit = 2000;
                } else if (vm.pointsLimit !== 2000 && vm.pointsLimit !== 3000) {
                    vm.pointsLimit = newCustomDefault;
                }
            } else {
                if (vm.pointsLimit === 2000 || vm.pointsLimit === 3000) {
                    vm.pointsLimit = 1001;
                } else if (vm.pointsLimit !== 1001 && vm.pointsLimit !== 501) {
                    vm.pointsLimit = newCustomDefault;
                }
            }
            vm.saveSettings();
        };

        vm.saveSettings = function () {
            if (!vm.tableId) return;
            $http.post('/table/settings?tableId=' + vm.tableId, {
                pointsLimit: vm.pointsLimit,
                scoringMode: vm.scoringMode
            });
        };

        // Contract
        vm.setContractTeam = function (team) {
            vm.contractTeam = team;
        };

        vm.setContractValue = function (value) {
            vm.contractValue = value;
        };

        vm.setCoinche = function (level) {
            vm.coincheLevel = level;
        };

        // Sync points between teams (total = 162)
        vm.syncPoints = function (changedTeam) {
            var TOTAL_POINTS = 162;
            if (vm.capot) return;

            if (changedTeam === 'team1' && vm.pointsTeam1 !== null && vm.pointsTeam1 !== '') {
                var points = parseInt(vm.pointsTeam1) || 0;
                if (points >= 0 && points <= TOTAL_POINTS) {
                    vm.pointsTeam2 = TOTAL_POINTS - points;
                }
            } else if (changedTeam === 'team2' && vm.pointsTeam2 !== null && vm.pointsTeam2 !== '') {
                var points = parseInt(vm.pointsTeam2) || 0;
                if (points >= 0 && points <= TOTAL_POINTS) {
                    vm.pointsTeam1 = TOTAL_POINTS - points;
                }
            }
        };

        // Set belote (mutually exclusive)
        vm.setBelote = function (team) {
            vm.beloteTeam = team;
        };

        // Set capot
        vm.setCapot = function (team) {
            vm.capot = team;
            if (team === vm.team1Name) {
                vm.pointsTeam1 = 162;
                vm.pointsTeam2 = 0;
            } else if (team === vm.team2Name) {
                vm.pointsTeam1 = 0;
                vm.pointsTeam2 = 162;
            }
        };

        // Check if we can calculate the result
        vm.canCalculate = function () {
            return vm.contractTeam &&
                (vm.pointsTeam1 !== null && vm.pointsTeam1 !== '') &&
                (vm.pointsTeam2 !== null && vm.pointsTeam2 !== '');
        };

        vm.getPreviewResult = function () {
            return vm.calculateRoundScore();
        };

        // Calculate round score based on Belote/Coinche rules
        vm.calculateRoundScore = function () {
            var TOTAL_BASE = 162;
            var CAPOT_BONUS = 90;
            var BELOTE_BONUS = 20;

            var pointsTeam1 = parseInt(vm.pointsTeam1) || 0;
            var pointsTeam2 = parseInt(vm.pointsTeam2) || 0;

            var beloteTeam1 = vm.beloteTeam === vm.team1Name;
            var beloteTeam2 = vm.beloteTeam === vm.team2Name;
            var team1WithBelote = pointsTeam1 + (beloteTeam1 ? BELOTE_BONUS : 0);
            var team2WithBelote = pointsTeam2 + (beloteTeam2 ? BELOTE_BONUS : 0);

            var contractSuccess = false;
            var team1Score = 0;
            var team2Score = 0;
            var message = '';

            // Determine which team is team1 and which is team2 relative to contract
            var contractIsTeam1 = vm.contractTeam === vm.team1Name;

            if (vm.scoringMode === 'belote') {
                if (vm.capot) {
                    var capotTotal = TOTAL_BASE + CAPOT_BONUS;
                    if (vm.capot === vm.team1Name) {
                        team1Score = capotTotal + (beloteTeam1 ? BELOTE_BONUS : 0);
                        team2Score = beloteTeam2 ? BELOTE_BONUS : 0;
                        contractSuccess = contractIsTeam1;
                    } else {
                        team2Score = capotTotal + (beloteTeam2 ? BELOTE_BONUS : 0);
                        team1Score = beloteTeam1 ? BELOTE_BONUS : 0;
                        contractSuccess = !contractIsTeam1;
                    }
                } else {
                    if (contractIsTeam1) {
                        contractSuccess = team1WithBelote > team2WithBelote;
                    } else {
                        contractSuccess = team2WithBelote > team1WithBelote;
                    }

                    if (contractSuccess) {
                        team1Score = team1WithBelote;
                        team2Score = team2WithBelote;
                    } else {
                        var totalPoints = TOTAL_BASE + (beloteTeam1 ? BELOTE_BONUS : 0) + (beloteTeam2 ? BELOTE_BONUS : 0);
                        if (contractIsTeam1) {
                            team1Score = 0;
                            team2Score = totalPoints;
                        } else {
                            team1Score = totalPoints;
                            team2Score = 0;
                        }
                    }
                }

                // Litige
                if (!vm.capot && team1WithBelote === team2WithBelote) {
                    var litigeAtStake = contractIsTeam1 ? team1WithBelote : team2WithBelote;
                    if (contractIsTeam1) {
                        team1Score = 0;
                        team2Score = team2WithBelote;
                    } else {
                        team1Score = team1WithBelote;
                        team2Score = 0;
                    }
                    contractSuccess = false;
                    var totalLitige = vm.litige + litigeAtStake;
                    message = 'Litige! Le preneur ne marque rien. (' + totalLitige + ' pts en litige)';
                } else if (vm.litige > 0) {
                    // Distribute accumulated litige to the round winner
                    if (team1Score >= team2Score) {
                        team1Score += vm.litige;
                    } else {
                        team2Score += vm.litige;
                    }
                }
            } else {
                // Coinche rules
                if (vm.capot) {
                    var capotTotal = 250 * vm.coincheLevel;
                    if (vm.capot === vm.team1Name) {
                        team1Score = capotTotal + (beloteTeam1 ? BELOTE_BONUS : 0);
                        team2Score = beloteTeam2 ? BELOTE_BONUS : 0;
                        contractSuccess = contractIsTeam1;
                    } else {
                        team2Score = capotTotal + (beloteTeam2 ? BELOTE_BONUS : 0);
                        team1Score = beloteTeam1 ? BELOTE_BONUS : 0;
                        contractSuccess = !contractIsTeam1;
                    }
                } else {
                    var contractorPoints = contractIsTeam1 ? team1WithBelote : team2WithBelote;
                    contractSuccess = contractorPoints >= vm.contractValue;

                    if (contractSuccess) {
                        var contractPoints = vm.contractValue * vm.coincheLevel;
                        if (contractIsTeam1) {
                            team1Score = team1WithBelote + contractPoints;
                            team2Score = team2WithBelote;
                        } else {
                            team2Score = team2WithBelote + contractPoints;
                            team1Score = team1WithBelote;
                        }
                    } else {
                        var contractPoints = vm.contractValue * vm.coincheLevel;
                        if (contractIsTeam1) {
                            team1Score = 0;
                            team2Score = contractPoints + TOTAL_BASE + (beloteTeam2 ? BELOTE_BONUS : 0);
                        } else {
                            team1Score = contractPoints + TOTAL_BASE + (beloteTeam1 ? BELOTE_BONUS : 0);
                            team2Score = 0;
                        }
                    }
                }

                // Litige
                if (!vm.capot && team1WithBelote === team2WithBelote) {
                    var litigeAtStake = contractIsTeam1 ? team1WithBelote : team2WithBelote;
                    if (contractIsTeam1) {
                        team1Score = 0;
                        team2Score = team2WithBelote;
                    } else {
                        team1Score = team1WithBelote;
                        team2Score = 0;
                    }
                    contractSuccess = false;
                    var totalLitige = vm.litige + litigeAtStake;
                    message = 'Litige! Le preneur ne marque rien. (' + totalLitige + ' pts en litige)';
                } else if (vm.litige > 0) {
                    // Distribute accumulated litige to the round winner
                    if (team1Score >= team2Score) {
                        team1Score += vm.litige;
                    } else {
                        team2Score += vm.litige;
                    }
                }
            }

            if (!message) {
                var preneurName = 'Team ' + vm.contractTeam;
                if (vm.capot) {
                    var capotTeamName = 'Team ' + vm.capot;
                    message = 'Capot de ' + capotTeamName + '!';
                    if (contractSuccess) {
                        message += ' Contrat réussi pour ' + preneurName + '.';
                    } else {
                        message += ' Chute pour ' + preneurName + '.';
                    }
                } else if (contractSuccess) {
                    message = 'Contrat réussi pour ' + preneurName + '!';
                } else {
                    message = 'Chute! ' + preneurName + ' perd le contrat.';
                }
            }

            var isLitige = false;
            var newLitige = 0;

            if (!vm.capot && team1WithBelote === team2WithBelote) {
                isLitige = true;
                var litigeAtStake = contractIsTeam1 ? team1WithBelote : team2WithBelote;
                newLitige = vm.litige + litigeAtStake;
            }

            return {
                team1Score: Math.round(team1Score),
                team2Score: Math.round(team2Score),
                contractSuccess: contractSuccess,
                message: message,
                team1Wins: team1Score > team2Score,
                isLitige: isLitige,
                newLitige: newLitige
            };
        };

        // Add round via backend
        vm.addRound = function () {
            if (!vm.canCalculate()) return;

            var result = vm.calculateRoundScore();

            var roundData = {
                contractTeam: vm.contractTeam,
                contractValue: vm.scoringMode === 'coinche' ? vm.contractValue : null,
                coincheLevel: vm.scoringMode === 'coinche' ? vm.coincheLevel : 1,
                pointsTeam1Raw: parseInt(vm.pointsTeam1),
                pointsTeam2Raw: parseInt(vm.pointsTeam2),
                beloteTeam1: vm.beloteTeam === vm.team1Name,
                beloteTeam2: vm.beloteTeam === vm.team2Name,
                capot: vm.capot,
                scoreTeam1: result.team1Score,
                scoreTeam2: result.team2Score,
                contractSuccess: result.contractSuccess,
                newLitige: result.newLitige
            };

            $http.post('/table/rounds?tableId=' + vm.tableId, roundData).then(function () {
                vm.litige = result.newLitige;
                vm.resetRoundInput();
                vm.refreshRounds();
            });
        };

        // Calculate totals and check for winner
        vm.calculateTotals = function () {
            vm.totalTeam1 = vm.rounds.reduce(function (sum, r) { return sum + r.scoreTeam1; }, 0);
            vm.totalTeam2 = vm.rounds.reduce(function (sum, r) { return sum + r.scoreTeam2; }, 0);

            // Check if any team reached the points limit
            vm.winnerTeam = null;
            if (vm.totalTeam1 >= vm.pointsLimit && vm.totalTeam1 > vm.totalTeam2) {
                vm.winnerTeam = vm.team1Name;
            } else if (vm.totalTeam2 >= vm.pointsLimit && vm.totalTeam2 > vm.totalTeam1) {
                vm.winnerTeam = vm.team2Name;
            } else if (vm.totalTeam1 >= vm.pointsLimit && vm.totalTeam2 >= vm.pointsLimit) {
                // Both over limit, highest wins
                if (vm.totalTeam1 > vm.totalTeam2) {
                    vm.winnerTeam = vm.team1Name;
                } else if (vm.totalTeam2 > vm.totalTeam1) {
                    vm.winnerTeam = vm.team2Name;
                }
            }
        };

        // Reset round input
        vm.resetRoundInput = function () {
            vm.contractTeam = vm.team1Name;
            vm.contractValue = 80;
            vm.coincheLevel = 1;
            vm.pointsTeam1 = null;
            vm.pointsTeam2 = null;
            vm.beloteTeam = null;
            vm.capot = null;
        };

        // Remove a round
        vm.removeRound = function (roundId) {
            if (confirm('Supprimer cette manche?')) {
                $http({
                    method: 'DELETE',
                    url: '/table/rounds?tableId=' + vm.tableId + '&roundId=' + roundId
                }).then(function () {
                    vm.refreshRounds();
                });
            }
        };

        // Reset entire game (delete all rounds)
        vm.resetGame = function () {
            if (confirm('Réinitialiser tous les scores? Cette action est irréversible.')) {
                // Delete all rounds one by one
                var promises = vm.rounds.map(function (round) {
                    return $http({
                        method: 'DELETE',
                        url: '/table/rounds?tableId=' + vm.tableId + '&roundId=' + round.id
                    });
                });
                Promise.all(promises).then(function () {
                    vm.refreshRounds();
                    $scope.$applyAsync();
                });
            }
        };

        // Declare winner and finish the table
        vm.declareWinner = function (teamName) {
            if (window.confirm('Déclarer Team ' + teamName + ' vainqueur? Cela terminera la table.')) {
                $http.get('/user/finish?tableId=' + vm.tableId + '&winningTeam=' + encodeURIComponent(teamName)).then(function () {
                    window.location.href = '/';
                });
            }
        };

        // Initialize
        vm.init();
    }]);
