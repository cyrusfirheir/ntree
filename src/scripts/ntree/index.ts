import { MacroContext } from "twine-sugarcube";

interface NTreeState {
	id: string;
	log: {
		[key: string]: number;
	};
}

interface Handler {
	id?: string;
	skipArgs?: boolean;
	clearOnEveryLeaf?: boolean;
	onUpdate: (...args: any) => void;
	onClear?: (macroContext?: MacroContext) => void;
	delta?: HandlerDelta;
}

interface HandlerDelta {
	[key: string]: any;
}

type NTreeRepository = Map<string, NTree>;
type NTreeStateStore = Map<string, NTreeState>;

export class NTree {
	id: string;
	handlers: Map<string, Handler> = new Map();

	constructor(id: string) {
		if (!id?.trim()) throw new Error(`@NTree: No ID specified!`);

		this.id = id;

		this.registerDefault(NTree.defaultOnUpdateHandler);

		NTree.Repository.set(id, this);
		NTree.StateStore.set(id, {
			id,
			log: {}
		});
	}

	static get Repository() {
		if (!setup["@NTree/Repository"]) setup["@NTree/Repository"] = new Map();
		return setup["@NTree/Repository"] as NTreeRepository;
	}

	static get StateStore() {
		if (!variables()["@NTree/StateStore"]) variables()["@NTree/StateStore"] = new Map();
		return variables()["@NTree/StateStore"] as NTreeStateStore;
	}

	static getNTree(id: string) {
		return NTree.Repository.get(id);
	}

	static getState(id: string) {
		return NTree.StateStore.get(id);
	}

	get state() {
		return NTree.getState(this.id) as NTreeState;
	}

	registerHandler(id: string | string[], def: Handler) {
		const IDs = id instanceof Array ? id : [id];

		for (const id of IDs) {
			if (!id?.trim()) throw new Error(`@NTree/${this.id}: Handler ID not specified!`);

			this.handlers.delete(id);

			const errorSource = `@NTree/${this.id}/handlers/${id}`;

			if (!def.onUpdate) throw new Error(`${errorSource}: No definition for onUpdate() found!`);
			if (!(def.onUpdate instanceof Function)) throw new Error(`${errorSource}: Specified onUpdate() is not a function!`);

			if (def.onClear && !(def.onClear instanceof Function)) throw new Error(`${errorSource}: Specified onClear() is not a function!`);

			this.handlers.set(id, Object.assign(Object.create(null), def, { id }));
		}

		return this;
	}

	static defaultHandlerID = "__default";

	registerDefault(onUpdate: (inString: string, macroContext?: MacroContext) => void) {
		const def: Handler = {
			onUpdate
		};
		return this.registerHandler(NTree.defaultHandlerID, def);
	}

	private static defaultOnUpdateHandler(inString: string, macroContext?: MacroContext) {
		if (macroContext) {
			$(macroContext.output).wiki(macroContext.payload.slice(1, (macroContext as any).currentPayload as number + 1).map(load => load.contents).join(""));
		}
	}

	update(delta: HandlerDelta, macroContext?: MacroContext) {
		this.handlers.forEach(handler => {
			const id = handler.id as string;

			handler.delta = delta;

			function clear() {
				if (handler.onClear) handler.onClear(macroContext);
			}

			if (delta[id]) {
				const deltaVal = delta[id];

				const clearDirective = deltaVal === NTree.clear;
				if (clearDirective) return clear();

				if (handler.skipArgs) {
					handler.onUpdate.call(handler, deltaVal, macroContext);
				} else {
					const args = deltaVal instanceof Array ? deltaVal : [deltaVal];
					args.push(macroContext);

					handler.onUpdate.call(handler, ...args);
				}
			} else {
				if (handler.clearOnEveryLeaf) clear();
			}
		});
	}

	static clear = Symbol.for("@NTree/clear");

	static deleteNTree(id: string) {
		return NTree.Repository.delete(id) && NTree.StateStore.delete(id);
	}
}

(window as any).NTree = NTree;

enum NTreeBranchRepeatConfig {
	NoRepeat = "norepeat",
	RepeatLast = "repeatlast",
	Repeat = "repeat"
}

Macro.add("treebranch", {
	tags: ["leaf"],

	//@ts-ignore. the typedefs are stoopid. skipArgs accepts array too! ><
	skipArgs: ["leaf"],

	handler() {
		try {
			const treeID: string = this.args[0];
			const branchID: string = this.args[1];
			const repeat: string = this.args[2] ?? NTreeBranchRepeatConfig.RepeatLast;

			if (!treeID?.trim()) throw new Error(`@NTreeBranch: No NTree ID specified!`);
			if (!branchID?.trim()) throw new Error(`@NTreeBranch: No NTreeBranch ID specified`)

			const nTree = NTree.getNTree(treeID);
			if (!nTree) throw new Error(`@NTreeBranch: No NTree with specified ID "${treeID}" found!`);

			const latest = nTree.state.log[branchID] ?? 0;
			let current = latest + 1;

			if (current === this.payload.length) {
				switch (repeat) {
					case NTreeBranchRepeatConfig.Repeat: {
						current = 1;
						break;
					}
					case NTreeBranchRepeatConfig.RepeatLast: {
						current = latest;
						break;
					}
					case NTreeBranchRepeatConfig.NoRepeat: {
						return;
					}
				}
			}

			(this as any).currentPayload = current;

			const chunk = this.payload[current];
			const args = chunk.args.full.trim() || "{}";

			const delta: HandlerDelta = {
				[NTree.defaultHandlerID]: chunk.contents
			};

			try {
				const parsedDelta = Scripting.evalJavaScript(`(${args})`) as HandlerDelta;
				Object.keys(parsedDelta).forEach(key => {
					delta[key] = parsedDelta[key];
				});
			} catch (ex) {
				throw new Error(`@NTreeLeaf/#${current - 1}: Malformed argument object:\n${args}: ${ex}`);
			}

			nTree.update(delta, this);

			nTree.state.log[branchID] = current;
		} catch (ex) {
			this.error("bad evaluation: " + (typeof ex === "object" ? ex.message : ex));
		}
	}
});