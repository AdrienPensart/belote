function userToString() {
	console.log("userToString")
}

class User {
	name: string;
	ready: boolean;
	lastActiveAt: number | undefined;
	ip: string | undefined;
	canPlayTarot: boolean;
	canPlayTwoTables: boolean;

	constructor(name: string, ip: string | undefined) {
		this.name = name;
		this.lastActiveAt = Date.now();
		this.ip = ip;
		this.ready = false;
		this.canPlayTarot = false;
		this.canPlayTwoTables = false;
	}
}
