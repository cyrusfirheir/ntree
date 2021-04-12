import { NTree } from "./ntree";

const vn = new NTree("vn");

vn.registerHandler(["spriteL", "spriteR"], {
	onUpdate(arg) {
		console.log(`${this.id}: ${arg}`)
	},

	onClear() {
		console.log("clear");
	}
});