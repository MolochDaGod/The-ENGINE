/**
 * Grudge Engine — CharacterFSM
 *
 * Lightweight finite-state machine that mirrors the XState v4 API used in
 * gonnavis/annihilate (Maria.js, Paladin.js, etc.) — with zero external deps.
 *
 * Supported features:
 *   entry / exit actions
 *   on: { event → target } transitions
 *   after: { ms → target } timed auto-transitions
 *   tags: ['canMove', 'canDamage', …]
 *   guards via cond functions
 *   nested state IDs  (e.g. '#maria.idle')
 *   context (passed to all entry/exit actions)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionFn = (context: Record<string, unknown>, event: FSMEvent) => void;
type GuardFn  = (context: Record<string, unknown>, event: FSMEvent) => boolean;

export interface FSMEvent {
  type: string;
  [key: string]: unknown;
}

interface Transition {
  target: string;
  cond?: string;     // key into guards map
  actions?: string[];
}

interface StateConfig {
  entry?:  string | string[];
  exit?:   string | string[];
  on?:     Record<string, Transition | string>;
  after?:  Record<number, Transition | string>;
  tags?:   string[];
  initial?: string;
  states?: Record<string, StateConfig>;
}

interface MachineConfig {
  id: string;
  initial: string;
  context?: Record<string, unknown>;
  states: Record<string, StateConfig>;
  on?: Record<string, Transition | string>;   // global transitions
}

interface MachineOptions {
  actions?: Record<string, ActionFn>;
  guards?:  Record<string, GuardFn>;
}

// ─── CharacterFSM ─────────────────────────────────────────────────────────────

export class CharacterFSM {
  private config:   MachineConfig;
  private options:  MachineOptions;
  private _current: string;
  private context:  Record<string, unknown>;
  private _timers:  ReturnType<typeof setTimeout>[] = [];
  private _listeners: Array<(state: string) => void> = [];

  constructor(config: MachineConfig, options: MachineOptions = {}) {
    this.config  = config;
    this.options = options;
    this.context = { ...(config.context ?? {}) };
    this._current = config.initial;
  }

  // ── Public API (matches XState v4 service API) ─────────────────────────────

  /** Start the FSM — runs entry actions on the initial state */
  start(): this {
    this._enter(this._current, { type: 'init' });
    return this;
  }

  /** Send an event, trigger transitions */
  send(eventType: string, payload: Record<string, unknown> = {}): void {
    const event: FSMEvent = { type: eventType, ...payload };
    this._transition(this._current, event);
  }

  /** True if the current state string matches (supports dot notation for hierarchy) */
  matches(stateOrPath: string): boolean {
    return this._current === stateOrPath || this._current.startsWith(stateOrPath + '.');
  }

  /** True if the current state has the given tag */
  hasTag(tag: string): boolean {
    const cfg = this._getStateConfig(this._current);
    return cfg?.tags?.includes(tag) ?? false;
  }

  /** The current state name */
  get value(): string { return this._current; }

  /** Subscribe to state changes */
  onTransition(fn: (state: string) => void): this {
    this._listeners.push(fn);
    return this;
  }

  /** Clean up timers */
  stop(): void {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _transition(current: string, event: FSMEvent): void {
    const stateCfg = this._getStateConfig(current);
    if (!stateCfg) return;

    // Resolve target from local `on`, then global `on`
    const localOn  = stateCfg.on?.[event.type];
    const globalOn = this.config.on?.[event.type];
    const raw = localOn ?? globalOn;
    if (!raw) return;

    const tx = this._normTx(raw);
    if (!tx) return;

    // Check guard
    if (tx.cond) {
      const guard = this.options.guards?.[tx.cond];
      if (guard && !guard(this.context, event)) return;
    }

    // Resolve target (handles '#id.state' cross-machine references)
    const target = this._resolveTarget(tx.target);
    this._go(current, target, event);
  }

  private _go(from: string, to: string, event: FSMEvent): void {
    this._exit(from, event);
    this._current = to;
    this._clearTimers();
    this._enter(to, event);
    this._listeners.forEach(fn => fn(to));
  }

  private _enter(state: string, event: FSMEvent): void {
    const cfg = this._getStateConfig(state);
    if (!cfg) return;
    this._runActions(cfg.entry, event);
    // Schedule timed transitions
    if (cfg.after) {
      for (const [ms, rawTx] of Object.entries(cfg.after)) {
        const tx = this._normTx(rawTx as Transition | string);
        if (!tx) continue;
        const t = setTimeout(() => {
          if (this._current !== state) return;
          const target = this._resolveTarget(tx.target);
          this._go(state, target, { type: `after.${ms}` });
        }, Number(ms));
        this._timers.push(t);
      }
    }
  }

  private _exit(state: string, event: FSMEvent): void {
    const cfg = this._getStateConfig(state);
    if (!cfg) return;
    this._runActions(cfg.exit, event);
  }

  private _runActions(actions: string | string[] | undefined, event: FSMEvent): void {
    if (!actions) return;
    const list = Array.isArray(actions) ? actions : [actions];
    for (const name of list) {
      this.options.actions?.[name]?.(this.context, event);
    }
  }

  private _clearTimers(): void {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }

  private _normTx(raw: Transition | string): Transition | null {
    if (!raw) return null;
    if (typeof raw === 'string') return { target: raw };
    return raw;
  }

  /**
   * Resolve '#machineid.stateName' references (e.g. '#maria.idle').
   * We strip the '#id.' prefix to get the flat state name.
   */
  private _resolveTarget(target: string): string {
    if (target.startsWith('#')) {
      const parts = target.split('.');
      return parts.slice(1).join('.');
    }
    return target;
  }

  private _getStateConfig(state: string): StateConfig | undefined {
    // Support 'parent.child' notation
    const parts = state.split('.');
    let cfg: StateConfig | undefined = this.config.states[parts[0]];
    for (let i = 1; i < parts.length; i++) {
      cfg = cfg?.states?.[parts[i]];
    }
    return cfg;
  }
}

// ─── Factory helper (mirrors XState createMachine + interpret) ────────────────

export function createFSM(config: MachineConfig, options?: MachineOptions): CharacterFSM {
  return new CharacterFSM(config, options);
}
