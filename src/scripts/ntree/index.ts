import { MacroContext } from "twine-sugarcube";

interface NTreeConfig {
	providers: Map<string, Provider>;
}

interface NTreeState {
	id: string;
	log: string[];
}

interface Provider {
	/** ID of the provider. If array, all IDs are registered separately. */
	id: string | string[];

	/** If `true`, parses the update array in `<<leaf>>` as an array, otherwise, as an array of arguments. */
	skipArgs?: boolean;

	/** If `true`, runs the `onClear()` handler on each `<<leaf>>`, given the `onUpdate()` handler doesn't run. */
	clearOnEveryLeaf?: boolean;

	/** Function to run every time the provider is updated. If called through the `<<leaf>>` macro, the final argument is always the `MacroContext` of the `<<treebranch>>` the `<<leaf>>` is from. */
	onUpdate: (...args: any) => void;

	/** Function to run every time the provider is cleared by either passing `NTree.clear` as the update, or due to `clearOnEveryLeaf`. */
	onClear?: () => void;

	/** A use-as-needed store object. */
	store?: ProviderStore;
}

interface ProviderStore {
	[key: string]: any
}

interface ProviderDelta {
	[key: string]: any;
}

type NTreeRepository = Map<string, NTree>;
type NTreeStateStore = Map<string, NTreeState>;

export class NTree {
	id: string;
	providers: NTreeConfig["providers"];

	/**
	 * Creates an NTree object and adds it to `NTree.Repository`. Initializes NTree State and adds the State object to `NTree.StateStore`.
	 * @param id ID to register the NTree as.
	 * @param config Configuration object for the NTree.
	 */
	constructor(id: string,	config?: NTreeConfig) {
		if (!id?.trim()) throw new Error(`@NTree: No ID specified!`);

		this.id = id;
		this.providers = config?.providers ?? new Map();

		if (!this.hasDefaultProvider) this.registerDefault({
			id: "__default",
			onUpdate: NTree.defaultProviderOnUpdate
		});

		const stateInit: NTreeState = {
			id,
			log: []
		};

		NTree.Repository.set(id, this);
		NTree.StateStore.set(id, stateInit);
	}

	/** Repository of NTree objects at `State.variables["@NTree/Repository"]` */
	static get Repository() {
		if (!setup["@NTree/Repository"]) setup["@NTree/Repository"] = new Map();
		return setup["@NTree/Repository"] as NTreeRepository;
	}

	/** Store of NTree States at `State.variables["@NTree/StateStore"]` */
	static get StateStore() {
		if (!variables()["@NTree/StateStore"]) variables()["@NTree/StateStore"] = new Map();
		return variables()["@NTree/StateStore"] as NTreeStateStore;
	}

	/**
	 * Gets the NTree object from `NTree.Repository`.
	 * @param id ID of the NTree.
	 * @returns The NTree object.
	 */
	static getNTree(id: string) {
		return NTree.Repository.get(id);
	}

	/**
	 * Gets the State of an NTree object from `NTree.StateStore`.
	 * @param id ID of the NTree.
	 * @returns State data of the NTree.
	 */
	static getState(id: string) {
		return NTree.StateStore.get(id);
	}

	/** State data of the NTree. */
	get state() {
		return NTree.getState(this.id);
	}

	/**
	 * Registers a provider for an NTree.
	 * @param def Provider definition object.
	 * @returns Reference to NTree object for chaining.
	 */
	registerProvider(def: Provider) {
		const IDs = def.id instanceof Array ? def.id : [def.id];

		for (const id of IDs) {
			if (!id?.trim()) throw new Error(`@NTree/${this.id}: Provider ID not specified!`);

			const errorSource = `@NTree/${this.id}/providers/${id}`;

			if (!def.onUpdate) throw new Error(`${errorSource}: No definition for handler() found!`);
			if (!(def.onUpdate instanceof Function)) throw new Error(`${errorSource}: Specified handler() is not a function!`);

			if (def.onClear && !(def.onClear instanceof Function)) throw new Error(`${errorSource}: Specified clear() is not a function!`);

			def.store = def.store ?? {};

			this.providers.set(id, Object.assign(Object.create(null), def, { id }));
		}

		return this;
	}

	/**
	 * Registers the default provider for an NTree.
	 * @param def Provider definition object.
	 * @returns Reference to NTree object for chaining.
	 */
	registerDefault(def: Provider) {
		def.id = "__default";
		return this.registerProvider(def);
	}

	private get hasDefaultProvider() {
		return this.providers.has("__default");
	}

	/**
	 * `onUpdate` hander for the default default provider. Acts like a basic [CTP](https://github.com/cyrusfirheir/cycy-wrote-custom-macros/tree/master/click-to-proceed) macro.
	 * @param inString Contents of current payload. Ignored.
	 * @param macroContext `MacroContext` of the `<<treebranch>>` this was called from.
	 */
	static defaultProviderOnUpdate(inString: string, macroContext: MacroContext | null) {
		if (macroContext) {
			$(macroContext.output).wiki(macroContext.payload.slice(1, (macroContext as any).currentPayload as number + 1).map(load => load.contents).join(""))
		}
	}

	/**
	 * Loops through registered provders and runs their `onUpdate` and `onClear` handlers as specified by the delta object and provider definitions.
	 * @param delta Object containing updates/clears for the providers.
	 * @param macroContext If called from the `<<treebranch>>` macro, `MacroContext` of the same.
	 */
	update(delta: ProviderDelta, macroContext?: MacroContext) {
		this.providers.forEach(provider => {
			const id = provider.id as string;

			function clear() {
				if (provider.onClear) provider.onClear();
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

Macro.add("treebranch", {
	tags: ["leaf"],
	skipArgs: true,
	handler() {
		try {
			const id: string = Scripting.evalJavaScript(this.args.full);

			if (!id?.trim()) throw new Error(`@NTreeBranch: No NTree ID specified!`);

			const nTree = NTree.getNTree(id);

			if (!nTree) throw new Error(`@NTreeBranch: No NTree with specified ID found!`);

			const latest = nTree.state?.log.count(passage()) ?? 0;
			const current = latest + 1;

			if (current < this.payload.length) {
				(this as any).currentPayload = current;

				const chunk = this.payload[current];
				const args = chunk.args.full.trim() || "{}";
				try {
					const pDelta: ProviderDelta = Scripting.evalJavaScript(`(${args})`);
					pDelta.__default = chunk.contents;

					nTree.update(pDelta, this);

					nTree.state?.log.push(passage());
				} catch (ex) {
					throw new Error(`@NTreeLeaf/#${current - 1}: Malformed argument object:\n${args}: ${ex}`);
				}
			}
		} catch (ex) {
			this.error("bad evaluation: " + (typeof ex === "object" ? ex.message : ex));
		}
	}
});