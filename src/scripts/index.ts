import { NTree } from "./ntree";

const vn = new NTree("vn");

vn.registerProvider({
	id: ["spriteL", "spriteR"],

	onUpdate(arg) {
		console.log(`${this.id}: ${arg}`)
	},
	
	onClear() {
		console.log("clear");
	}
});