declare module 'howler' {
  export interface HowlOptions {
    src: string | string[];
    volume?: number;
    html5?: boolean;
    loop?: boolean;
    preload?: boolean;
    autoplay?: boolean;
    mute?: boolean;
    sprite?: { [key: string]: [number, number] };
    rate?: number;
    pool?: number;
    format?: string[];
    onload?: () => void;
    onloaderror?: (id: number, error: any) => void;
    onplay?: (id: number) => void;
    onplayerror?: (id: number, error: any) => void;
    onend?: (id: number) => void;
    onpause?: (id: number) => void;
    onstop?: (id: number) => void;
    onmute?: (muted: boolean) => void;
    onvolume?: (volume: number) => void;
    onrate?: (rate: number) => void;
    onseek?: (seek: number) => void;
    onfade?: (id: number) => void;
  }

  export class Howl {
    constructor(options: HowlOptions);
    play(spriteOrId?: string | number): number;
    pause(id?: number): this;
    stop(id?: number): this;
    mute(muted?: boolean, id?: number): this;
    volume(volume?: number, id?: number): number;
    fade(from: number, to: number, duration: number, id?: number): this;
    rate(rate?: number, id?: number): number;
    seek(seek?: number, id?: number): number;
    loop(loop?: boolean, id?: number): this;
    playing(id?: number): boolean;
    duration(id?: number): number;
    state(): string;
    load(): this;
    unload(): this;
    on(event: string, callback: (...args: any[]) => void, id?: number): this;
    off(event?: string, callback?: (...args: any[]) => void, id?: number): this;
    once(event: string, callback: (...args: any[]) => void, id?: number): this;
  }

  export class Howler {
    static volume(volume?: number): number;
    static mute(muted?: boolean): boolean;
    static stop(): void;
    static unload(): void;
    static codecs(ext: string): boolean;
    static usingWebAudio: boolean;
    static ctx: AudioContext | null;
    static masterGain: GainNode | null;
    static noAudio: boolean;
    static mobileAutoEnable: boolean;
    static autoSuspend: boolean;
    static autoUnlock: boolean;
    static orientation(x: number, y: number, z: number, xUp: number, yUp: number, zUp: number): void;
    static pos(x: number, y: number, z: number): void;
  }
}
