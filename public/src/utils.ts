function userToString() {
	console.log("userToString")
}

class User {
	name: string;
	ready: boolean;
	joinedAt: number;
	lastActiveAt: number | undefined;
	ip: string | undefined;

	constructor(name: string, ip: string | undefined) {
		this.name = name;
		this.joinedAt = Date.now();
		this.lastActiveAt = this.joinedAt;
		this.ip = ip;
		this.ready = false;
	}
}
