import { NTree } from "./ntree";

const vn = new NTree("vn");

vn.registerProvider(["spriteL", "spriteR"], {
	onUpdate(arg) {
		console.log(`${this.id}: ${arg}`)
	},
	
	onClear() {
		console.log("clear");
	}
});