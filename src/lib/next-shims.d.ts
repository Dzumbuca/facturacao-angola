// Build shim: next package @16.4.2 .d.ts files are missing from the installed
// package (package.json "files" lists them but they are absent from
// node_modules/next/). npm reinstall is not possible in this environment due to
// corrupted registry tarballs and Windows EPERM file locking.
//
// These declarations cover the real next subpath modules that exist as .js files
// in node_modules/next/ and are imported by the project source code. They are
// NOT invented modules — they correspond to actual files:
//   next/server.js, next/navigation.js, next/cache.js, next/link.js,
//   next/script.js, next/headers.js, next/types.js
//
// Types are modelled on the public Next.js 16 API surface used by this project.

declare module 'next' {
  export type Metadata = any;
  export type Viewport = any;
  export type NextConfig = {
    turbopack?: { root?: string };
    distDir?: string;
    experimental?: { cpus?: number; [key: string]: any };
    [key: string]: any;
  };
  export type MetadataRoute = {
    sitemap?: () => Promise<{ url: string; [key: string]: any }[]> | { url: string; [key: string]: any }[];
    robots?: () => Promise<string> | string;
    [key: string]: any;
  };
  export namespace MetadataRoute {
    export interface Robots {
      rules: {
        userAgent: string;
        allow?: string | string[];
        disallow?: string | string[];
        [key: string]: any;
      };
      sitemap?: string;
      [key: string]: any;
    }
    export interface SitemapItem {
      url: string;
      lastModified?: Date | string;
      changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
      priority?: number;
      [key: string]: any;
    }
    export type Sitemap = SitemapItem[];
  }
}

declare module 'next/server.js' {
  export class NextRequest extends Request {
    constructor(url: string | Request, init?: RequestInit);
    readonly url: string;
    readonly method: string;
    readonly headers: Headers;
    readonly body: ReadableStream | null;
    readonly nextUrl: URL;
    json(): Promise<any>;
    text(): Promise<string>;
    formData(): Promise<FormData>;
    cookies: {
      get(name: string): { value: string } | undefined;
      set(name: string, value: string, options?: any): void;
      remove(name: string, options?: any): void;
      all(): { name: string; value: string }[];
      has(name: string): boolean;
      getAll(): { name: string; value: string }[];
    };
  }
  export class NextResponse extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly status: number;
    readonly ok: boolean;
    readonly headers: Headers;
    readonly body: ReadableStream | null;
    static json(data: any, init?: { status?: number; headers?: Record<string, string> }): NextResponse;
    static redirect(url: string | URL, status?: number): NextResponse;
    static rewrite(url: string): NextResponse;
    static next(init?: { request?: NextRequest }): NextResponse;
    cookies: {
      get(name: string): { value: string } | undefined;
      set(name: string, value: string, options?: any): void;
      remove(name: string, options?: any): void;
      all(): { name: string; value: string }[];
      has(name: string): boolean;
      getAll(): { name: string; value: string }[];
    };
  }
}

declare module 'next/server' {
  export class NextRequest extends Request {
    constructor(url: string | Request, init?: RequestInit);
    readonly url: string;
    readonly method: string;
    readonly headers: Headers;
    readonly body: ReadableStream | null;
    readonly nextUrl: URL;
    json(): Promise<any>;
    text(): Promise<string>;
    formData(): Promise<FormData>;
    cookies: {
      get(name: string): { value: string } | undefined;
      set(name: string, value: string, options?: any): void;
      remove(name: string, options?: any): void;
      all(): { name: string; value: string }[];
      has(name: string): boolean;
      getAll(): { name: string; value: string }[];
    };
  }
  export class NextResponse extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit);
    readonly status: number;
    readonly ok: boolean;
    readonly headers: Headers;
    readonly body: ReadableStream | null;
    static json(data: any, init?: { status?: number; headers?: Record<string, string> }): NextResponse;
    static redirect(url: string | URL, status?: number): NextResponse;
    static rewrite(url: string): NextResponse;
    static next(init?: { request?: NextRequest }): NextResponse;
    cookies: {
      get(name: string): { value: string } | undefined;
      set(name: string, value: string, options?: any): void;
      remove(name: string, options?: any): void;
      all(): { name: string; value: string }[];
      has(name: string): boolean;
      getAll(): { name: string; value: string }[];
    };
  }
}

declare module 'next/types.js' {
  // Marker file: // types-only
  export type ResolvingMetadata = any;
  export type ResolvingViewport = any;
  export {};
}

declare module 'next/navigation' {
  export function redirect(url: string, options?: { status?: number; permanent?: boolean }): never;
  export function notFound(): never;
  export function useRouter(): {
    push(url: string, options?: any): Promise<boolean>;
    replace(url: string, options?: any): Promise<boolean>;
    back(): void;
    refresh(): void;
  };
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams;
  export default function Link(props: { href: string; [key: string]: any }): JSX.Element;
}

declare module 'next/cache' {
  export function revalidatePath(path: string, type?: 'layout' | 'page'): void;
  export function revalidateTag(tag: string): void;
}

declare module 'next/link' {
  export default function Link(props: { href: string; [key: string]: any }): JSX.Element;
}

declare module 'next/script' {
  export default function Script(props: { [key: string]: any }): JSX.Element;
}

declare module 'next/headers' {
  export function cookies(): {
    get(name: string): { value: string } | undefined;
    set(name: string, value: string, options?: any): void;
    remove(name: string, options?: any): void;
    all(): { name: string; value: string }[];
    has(name: string): boolean;
    getAll(): { name: string; value: string }[];
  };
}

declare module 'next/font/google' {
  export interface GoogleFontOptions {
    variable?: string;
    subsets?: string[];
    weight?: string | number | string[];
    display?: string;
  }
  export function GoogleFont(options: GoogleFontOptions): {
    className: string;
    style: string;
  };
  export const Onest: (options: GoogleFontOptions) => { className: string; style: string };
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
