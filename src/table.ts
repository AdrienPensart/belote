import { FullTable, GameMode, Team, User } from "./db/schema.types";
import { shuffleArray } from "./helpers";

export const TEAMS = ['red', 'black', 'orange', 'blue', 'green'];

export async function generateFullTables(tables: FullTable[], gameModes: GameMode[]) {
		let readyUsers = tables.find((tableWithUsers) => tableWithUsers.table.panama)!!.teams[0].users.filter(user => user.ready); 
		let users = shuffleArray(readyUsers);
		// Index 0 for 4,Index 1 for 5,Index 2 for 6,Index 3 for 7,
		let maxAllocationPossible = [
			Math.floor(users.length / 4),
			//Maximum de nombre de tables qui peuvent jouer au tarot
			Math.floor(users.filter((user) => user.canPlayTarot).length / 5),
			Math.floor(users.length / 6),
			//Maximum de nombre de tables ayant un joueur qui peut jouer sur deux tables
			users.filter((user) => user.canPlayTwoTables).length,
		];
		let candidates = [];
		for (let t4 = 0; t4 <= maxAllocationPossible[0]; t4++) {
			for (let t5 = 0; t5 <= maxAllocationPossible[1]; t5++) {
				for (let t6 = 0; t6 <= maxAllocationPossible[2]; t6++) {
					for (let t7 = 0; t7 <= maxAllocationPossible[3]; t7++) {
						const usedPlayers = 4 * t4 + 5 * t5 + 6 * t6 + 7 * t7;
						if (usedPlayers <= users.length) {
							candidates.push([t4, t5, t6, t7]);
						}
					}
				}
			}
		}
		if (candidates.length === 0) {
			return;
		}

		const usedPlayers = (p: number[]): number => {
			return p[0] * 4 + p[1] * 5 + p[2] * 6 + p[3] * 7;
		};

		const combinationsWithNumberMatchingTotalParticipants = candidates.filter((combination) => usedPlayers(combination) === users.length);
		let bestCombinationPossible: number[] = [];
		let currentPlayers = [...users];
		if (combinationsWithNumberMatchingTotalParticipants.length != 0) {
			//We find the one that max the number of tables of 4
			const maxT4 = Math.max(...combinationsWithNumberMatchingTotalParticipants.map((combination) => combination[0]));
			bestCombinationPossible = combinationsWithNumberMatchingTotalParticipants.filter((combination) => combination[0] === maxT4)[0];
		} else {
			//We try to find the combinations that maxes the number of participants
			let secondBestCombinationParticipantNumber = users.length;
			let secondBestCombinations = [];
			do {
				secondBestCombinationParticipantNumber--;
				secondBestCombinations = candidates.filter((combination) => usedPlayers(combination) === secondBestCombinationParticipantNumber);
			} while (secondBestCombinations.length == 0);
			//Maximize number of tables of 4
			const maxT4 = Math.max(...secondBestCombinations.map((combination) => combination[0]));
			bestCombinationPossible = secondBestCombinations.filter((combination) => combination[0] === maxT4)[0];

			//Now we assign the players that would be left to Panama...
			let currentPlayersThatDontTarotOrSeven = currentPlayers.filter((user) => !user.canPlayTarot && !user.canPlayTwoTables);
			let numberOfPlayersToGoToPanama = currentPlayers.length - secondBestCombinationParticipantNumber;
			let playersSelected = [];
			if (currentPlayersThatDontTarotOrSeven.length >= numberOfPlayersToGoToPanama) {
				playersSelected = currentPlayersThatDontTarotOrSeven.slice(0, numberOfPlayersToGoToPanama);
			} else {
				playersSelected = currentPlayers
					.filter(
						(user) => (!user.canPlayTarot || bestCombinationPossible[1] == 0) && (!user.canPlayTwoTables || bestCombinationPossible[3] == 0)
					)
					.slice(0, numberOfPlayersToGoToPanama);
			}
			currentPlayers = currentPlayers.filter((user) => !playersSelected.find((userSelected) => userSelected.pseudo === user.pseudo));
		}
		let usedTableNames = tables.map((fullTable) => fullTable.table.name);

		//Tarot is priority
		while (currentPlayers.length != 0) {
			let playersSelected: User[] = [];
			let playerThatWillPlayTwoTables;
			// 5 priority for tarot
			if (bestCombinationPossible[1] != 0) {
				playersSelected = currentPlayers.filter((user) => user.canPlayTarot).splice(0, 5);
				bestCombinationPossible[1]--;
			} else {
				// 7 priority for users playing two tables
				if (bestCombinationPossible[3] != 0) {
					let usersThanCanPlayTwoTables = currentPlayers.filter((user) => user.canPlayTwoTables);
					playerThatWillPlayTwoTables = usersThanCanPlayTwoTables[0];
					playersSelected = [
						playerThatWillPlayTwoTables,
						...currentPlayers.filter((user) => user.pseudo !== playerThatWillPlayTwoTables!!.pseudo).slice(0, 6),
					];
					bestCombinationPossible[3]--;
				} else {
					if (bestCombinationPossible[0] != 0) {
						playersSelected = currentPlayers.splice(0, 4);
						bestCombinationPossible[0]--;
					} else {
						playersSelected = currentPlayers.splice(0, 6);
						bestCombinationPossible[2]--;
					}
				}
			}
			let teamsNeeded = Math.ceil(playersSelected.length / 2);
			let gameMode = gameModes.filter((elem) => elem.name === 'Belote')[0];
			switch(playersSelected.length) {
				case 4 :
					teamsNeeded = 2;
					break;
				case 5:
					gameMode = gameModes.filter((elem) => elem.name === 'Tarot')[0];
					teamsNeeded = 5;
					break;
				case 6:
					teamsNeeded = 3;
					// Mode specifique pour le 6 pour des stats différentes de la belote a 4
					gameMode = gameModes.filter((elem) => elem.name === 'Belote a 6')[0];
					break;
				case 7 :
					teamsNeeded = 2;
					break;
			}
			switch(playersSelected.length) {
				case 7 :
					tables.push(generateTable(
						[
							...playersSelected.filter((player) => player.pseudo!=playerThatWillPlayTwoTables!!.pseudo).slice(0,3),
							playerThatWillPlayTwoTables!!
						], 
						playerThatWillPlayTwoTables, 
						gameMode, 
						usedTableNames,
						teamsNeeded,
						tables.find((elem) => elem.table.panama)!!
					));
					tables.push(generateTable(
						[
							...playersSelected.filter((player) => player.pseudo!=playerThatWillPlayTwoTables!!.pseudo).slice(3,6),
							playerThatWillPlayTwoTables!!
						], 
						playerThatWillPlayTwoTables, 
						gameMode, 
						usedTableNames,
						teamsNeeded,
						tables.find((elem) => elem.table.panama)!!
					));
					break;
				default:
					tables.push(generateTable(
						playersSelected,
						playerThatWillPlayTwoTables, 
						gameMode, 
						usedTableNames,
						teamsNeeded,
						tables.find((elem) => elem.table.panama)!!
					));
					break;

			}


			
			currentPlayers = currentPlayers.filter((user) => !playersSelected.find((userSelected) => userSelected.pseudo === user.pseudo));
		}
	}
const generateTable = function (players: User[], playerOnTwoTable: User | undefined, gameMode: GameMode, usedTableNames: string[],teamsNeeded : number, panamaTable: FullTable): FullTable {
		let teams: Team[] = [];
			
		for (let index = 0;index < teamsNeeded; index++) {
			let users: User[] = teamsNeeded == players.length ? [
				players[index],
			]: [
				players[2*index],//0,2,4
				players[(2*index)+1],//1,3,5
			];
			teams.push({
				name: TEAMS[index % teamsNeeded],
				users : users
			})
		}
		var nextTableAvailable = 1;
		while (usedTableNames.filter((tableName) => tableName.startsWith(`Table ${nextTableAvailable} `)).length > 0) {
			nextTableAvailable++;
		}

		let tableName = `Table ${nextTableAvailable} ${playerOnTwoTable ? '(Table de 7)' : ''}`;
		usedTableNames.push(tableName);

		let fullTable: FullTable = {
			table:{
				gamemodeId: gameMode.id,
				id: -1,
				finished: false,
				panama: false,
				name: tableName
			},
			teams:teams
		}
		panamaTable.teams[0].users = panamaTable.teams[0].users.filter((user) => !players.find((userSelected) => userSelected.pseudo === user.pseudo));
		return fullTable;
		
	}
