import { MacroContext } from "twine-sugarcube";

interface NTreeState {
	id: string;
	log: {
		[key: string]: number;
	};
}

interface Provider {
	id?: string;
	skipArgs?: boolean;
	clearOnEveryLeaf?: boolean;
	onUpdate: (...args: any) => void;
	onClear?: (macroContext?: MacroContext) => void;
	delta?: ProviderDelta;
}

interface ProviderDelta {
	[key: string]: any;
}

type NTreeRepository = Map<string, NTree>;
type NTreeStateStore = Map<string, NTreeState>;

export class NTree {
	id: string;
	providers: Map<string, Provider> = new Map();

	constructor(id: string) {
		if (!id?.trim()) throw new Error(`@NTree: No ID specified!`);

		this.id = id;

		this.registerDefault(NTree.defaultProviderOnUpdate);

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

	registerProvider(id: string | string[], def: Provider) {
		const IDs = id instanceof Array ? id : [id];

		for (const id of IDs) {
			if (!id?.trim()) throw new Error(`@NTree/${this.id}: Provider ID not specified!`);

			if (this.providers.has(id)) this.providers.delete(id);

			const errorSource = `@NTree/${this.id}/providers/${id}`;

			if (!def.onUpdate) throw new Error(`${errorSource}: No definition for handler() found!`);
			if (!(def.onUpdate instanceof Function)) throw new Error(`${errorSource}: Specified handler() is not a function!`);

			if (def.onClear && !(def.onClear instanceof Function)) throw new Error(`${errorSource}: Specified clear() is not a function!`);

			this.providers.set(id, Object.assign(Object.create(null), def, { id }));
		}

		return this;
	}

	private static defaultProviderID = "__default";

	registerDefault(onUpdate: (inString: string, macroContext?: MacroContext) => void) {
		const def: Provider = {
			onUpdate
		};
		return this.registerProvider(NTree.defaultProviderID, def);
	}

	private static defaultProviderOnUpdate(inString: string, macroContext?: MacroContext) {
		if (macroContext) {
			$(macroContext.output).wiki(macroContext.payload.slice(1, (macroContext as any).currentPayload as number + 1).map(load => load.contents).join(""));
		}
	}

	update(delta: ProviderDelta, macroContext?: MacroContext) {
		this.providers.forEach(provider => {
			const id = provider.id as string;

			provider.delta = delta;

			function clear() {
				if (provider.onClear) provider.onClear(macroContext);
			}

			if (delta[id]) {
				const deltaVal = delta[id];

				const clearDirective = deltaVal === NTree.clear;
				if (clearDirective) return clear();

				if (provider.skipArgs) {
					provider.onUpdate.call(provider, deltaVal, macroContext);
				} else {
					const args = deltaVal instanceof Array ? deltaVal : [deltaVal];
					args.push(macroContext);

					provider.onUpdate.call(provider, ...args);
				}
			} else {
				if (provider.clearOnEveryLeaf) clear();
			}
		});
	}

	/** Symbol used to trigger the `onClear()` handler for a provider if it exists. */
	static clear = Symbol.for("@NTree/clear");

	/**
	 * Deletes an NTree and related State data.
	 * @param id ID of the NTree.
	 * @returns `true` if both the NTree and its State data existed and were deleted successfully, `false` otherwise.
	 */
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
			try {
				const pDelta: ProviderDelta = Scripting.evalJavaScript(`(${args})`);
				pDelta.__default = chunk.contents;

				nTree.update(pDelta, this);

				nTree.state.log[branchID] = current;
			} catch (ex) {
				throw new Error(`@NTreeLeaf/#${current - 1}: Malformed argument object:\n${args}: ${ex}`);
			}

		} catch (ex) {
			this.error("bad evaluation: " + (typeof ex === "object" ? ex.message : ex));
		}
	}
});