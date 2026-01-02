import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { generateFullTables, TEAMS } from '../src/table';
import { User, FullTable, GameMode } from '../src/db/schema.types';

const DEFAULT_TABLE = 'Panama';

describe('Get frontend', () => {
	describe('request for /index.html', () => {
		it('responds with frontend title', async () => {
			const request = new Request('http://example.com/index.html');
			const response = await SELF.fetch(request);
			expect(await response.text()).toMatch(`<title>Meltdown Belote</title>`);
		});
	});

	// describe('request for /random', () => {
	// 	it('/ responds with a random UUID (unit style)', async () => {
	// 		const request = new Request<unknown, IncomingRequestCfProperties>('http://example.com/random');
	// 		// Create an empty context to pass to `worker.fetch()`.
	// 		const ctx = createExecutionContext();
	// 		const response = await worker.fetch(request, env, ctx);
	// 		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
	// 		await waitOnExecutionContext(ctx);
	// 		expect(await response.text()).toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/);
	// 	});

	// 	it('responds with a random UUID (integration style)', async () => {
	// 		const request = new Request('http://example.com/random');
	// 		const response = await SELF.fetch(request);
	// 		expect(await response.text()).toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/);
	// 	});
	// });
});

function basicUser(name: string) : User {
	return {
		pseudo: name,
		id: -1,
		ready: false,
		canPlayTarot: false,
		canPlayTwoTables: false,
		admin: false,
		lastActiveAt: null,
		password: null,
		token: null,
		tokenValidity: null
	};
}

function readyPlayer(name: string): User {
	const user: User = basicUser(name);
	user.ready = true;
	return user;
}

function readyPlayerTarot(name: string): User {
	const user: User = basicUser(name);
	user.ready = true;
	user.canPlayTarot = true;
	return user;
}

function readyPlayerTwoTables(name: string): User {
	const user: User = basicUser(name);
	user.ready = true;
	user.canPlayTwoTables = true;
	return user;
}

function getGameModes(): GameMode[] {
	return [
		{
			id:1,
			name: 'Panama'
		},
		{
			id:2,
			name: 'Belote'
		},
		{
			id:3,
			name: 'Belote a 6'
		},
		{
			id:4,
			name: 'Tarot'
		},
	]
}

describe('Get backend', () => {
	describe('request for /backend.html', () => {
		it('responds with backend title', async () => {
			const request = new Request('http://example.com/backend.html');
			const response = await SELF.fetch(request);
			expect(await response.text()).toMatch(`<title>Meltdown backend</title>`);
		});
	});
});


describe('Table generation', () => {
	it.each([
		// Format: { players, tarotPlayers, twoTablesPlayers, expectedDefaultTable, expectedTables }
		{ 
			desc: '0 player',
			players: 0, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '1 players',
			players: 1, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 1 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '2 players',
			players: 2, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 2 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '3 players',
			players: 3, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 3 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '4 players',
			players: 4, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '4 players WITH 4 who knows Tarot',
			players: 4, 
			tarotPlayers: 4, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '5 players',
			players: 5, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 1 },
				{ name: 'Table 1', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '5 players WHO knows Tarot (1 regular)',
			players: 5, 
			tarotPlayers: 4, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 1 },
				{ name: 'Table 1', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '5 players WHO knows Tarot (all)',
			players: 5, 
			tarotPlayers: 5, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 5 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '6 players',
			players: 6, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 6 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '7 players WITHOUT any player on 2 tables',
			players: 7, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 1 },
				{ name: 'Table 1', size: 6 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '7 players WITH 1 player who KNOWS how to play on 2 tables',
			players: 7, 
			tarotPlayers: 0, 
			twoTablesPlayers: 1,
			mustHavePlayerOnTwoTable: true,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1 (Table de 7)', size: 4 }, 
				{ name: 'Table 2 (Table de 7)', size: 4 }
			],
			mustHavePlayerOnTwoTables: true
		},
		{ 
			desc: '7 players WITH 2 player who KNOWS how to play on 2 tables',
			players: 7, 
			tarotPlayers: 0, 
			twoTablesPlayers: 2,
			mustHavePlayerOnTwoTable: true,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1 (Table de 7)', size: 4 }, 
				{ name: 'Table 2 (Table de 7)', size: 4 }
			],
			mustHavePlayerOnTwoTables: true
		},
		{ 
			desc: '8 players',
			players: 8, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 4 },
				{ name: 'Table 2', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '9 players',
			players: 9, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 1 },
				{ name: 'Table 1', size: 4 },
				{ name: 'Table 2', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '9 players WITH 5 who knows Tarot',
			players: 9, 
			tarotPlayers: 5, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 5 },
				{ name: 'Table 2', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '10 players',
			players: 10, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 4 },
				{ name: 'Table 2', size: 6 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '11 players',
			players: 11, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 1 },
				{ name: 'Table 1', size: 4 },
				{ name: 'Table 2', size: 6 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '11 players WITH 1 player who KNOWS how to play on 2 tables',
			players: 11, 
			tarotPlayers: 0, 
			twoTablesPlayers: 1,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1 (Table de 7)', size: 4 },
				{ name: 'Table 2 (Table de 7)', size: 4 },
				{ name: 'Table 3', size: 4 }
			],
			mustHavePlayerOnTwoTables: true
		},
		{ 
			desc: '11 players WITH 2 player who KNOWS how to play on 2 tables',
			players: 11, 
			tarotPlayers: 0, 
			twoTablesPlayers: 2,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1 (Table de 7)', size: 4 },
				{ name: 'Table 2 (Table de 7)', size: 4 },
				{ name: 'Table 3', size: 4 }
			],
			mustHavePlayerOnTwoTables: true
		},
		{ 
			desc: '11 players WITH 1 player who KNOWS how to play on 2 tables + 5 who KNOWS Tarot',
			players: 11, 
			tarotPlayers: 5, 
			twoTablesPlayers: 1,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1 (Table de 7)', size: 4 },
				{ name: 'Table 2 (Table de 7)', size: 4 },
				{ name: 'Table 3', size: 4 }
			],
			mustHavePlayerOnTwoTables: true
		},
		{ 
			desc: '11 players WITH 2 player who KNOWS how to play on 2 tables + 5 who KNOWS Tarot',
			players: 11, 
			tarotPlayers: 5, 
			twoTablesPlayers: 2,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1 (Table de 7)', size: 4 },
				{ name: 'Table 2 (Table de 7)', size: 4 },
				{ name: 'Table 3', size: 4 }
			],
			mustHavePlayerOnTwoTables: true
		},
		{ 
			desc: '11 players WITH 5 who KNOWS Tarot',
			players: 11, 
			tarotPlayers: 5, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 5 },
				{ name: 'Table 2', size: 6 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '12 players',
			players: 12, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 4 },
				{ name: 'Table 2', size: 4 },
				{ name: 'Table 3', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '13 players',
			players: 13, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 1 },
				{ name: 'Table 1', size: 4 },
				{ name: 'Table 2', size: 4 },
				{ name: 'Table 3', size: 4 }
			],
			mustHavePlayerOnTwoTables: false
		},
		{ 
			desc: '13 players WITH 1 player who KNOWS how to play on 2 tables',
			players: 13, 
			tarotPlayers: 0, 
			twoTablesPlayers: 1,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1 (Table de 7)', size: 4 },
				{ name: 'Table 2 (Table de 7)', size: 4 },
				{ name: 'Table 3', size: 6 }
			],
			mustHavePlayerOnTwoTables: true
		},
		{ 
			desc: '13 players WITH 2 player who KNOWS how to play on 2 tables',
			players: 13, 
			tarotPlayers: 0, 
			twoTablesPlayers: 2,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1 (Table de 7)', size: 4 },
				{ name: 'Table 2 (Table de 7)', size: 4 },
				{ name: 'Table 3', size: 6 }
			],
			mustHavePlayerOnTwoTables: true
		},
		{ 
			desc: '14 players',
			players: 14, 
			tarotPlayers: 0, 
			twoTablesPlayers: 0,
			expectedTables: [
				{ name: DEFAULT_TABLE, size: 0 },
				{ name: 'Table 1', size: 4 },
				{ name: 'Table 2', size: 4 },
				{ name: 'Table 3', size: 6 }
			],
			mustHavePlayerOnTwoTables: false
		},
	])('$desc', async ({ 
		players, 
		tarotPlayers, 
		twoTablesPlayers, 
		expectedTables,
		mustHavePlayerOnTwoTables
	}) => {
		// Generate players dynamically
		const allPlayers = [];
		const playersOnTwoTables = [];
		// Add players
		for (let i = 1; i <= tarotPlayers; i++) {
			allPlayers.push(readyPlayerTarot(`tarot player (${i})`));
		}
		
		for (let i = 1; i <= twoTablesPlayers; i++) {
			let player = readyPlayerTwoTables(`player on two tables (${i})`)
			playersOnTwoTables.push(player);
			allPlayers.push(player);
		}
		
		const regularPlayers = players - tarotPlayers - twoTablesPlayers;
		for (let i = 1; i <= regularPlayers; i++) {
			allPlayers.push(readyPlayer(`player ${i}`));
		}
		
		// Generate the table
		const tables: FullTable[]= [
			{
				table:{
					gamemodeId: 1,
					id: 1,
					finished: false,
					panama: true,
					name: 'Panama'
				},
				teams: [{
					name: TEAMS[0],
					users: allPlayers
				}]
			}
		]
		generateFullTables(tables, getGameModes());

		let panamaTable = tables.find((fullTable) => fullTable.table.panama);

		expect(panamaTable).toBeDefined();
		
		expectedTables.forEach(table => {
			let foundTable = tables.find((elem) => elem.table.name.trim() === table.name.trim());
			expect(foundTable).toBeDefined();
			expect(foundTable?.teams.reduce((acc: number,current) => acc + current.users.length,0)).eq(table.size);
		});

		let totalPlayers = 0;
		tables.forEach(table => {
			table.teams.forEach(team => {
				totalPlayers += team.users.length;
			});
		});
		

		if (mustHavePlayerOnTwoTables) {
			let isPlayerPlayingOnTwoTables = false;
			for (const player of playersOnTwoTables) {
				let numberOfOccurencesOfPlayer = 0;
				tables.forEach(table => {
					table.teams.forEach(team => {
						numberOfOccurencesOfPlayer+= team.users.filter((playerInTable) => playerInTable.pseudo === player.pseudo).length;
					});
				});
				isPlayerPlayingOnTwoTables = isPlayerPlayingOnTwoTables || numberOfOccurencesOfPlayer == 2;
			}
			expect(isPlayerPlayingOnTwoTables).toBeTruthy();
			expect(totalPlayers).toBe(allPlayers.length+1);
		} else {
			expect(totalPlayers).toBe(allPlayers.length);
		}
	});
});