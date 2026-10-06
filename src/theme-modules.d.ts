/**
 * Ambient module declarations for the Docusaurus webpack module aliases and
 * CSS modules, which TypeScript cannot resolve from node_modules:
 * - `@theme/*` resolves to the active theme or src/theme overrides;
 * - `@theme-original/*` resolves to the overridden implementation (swizzle);
 * - `@docusaurus/<client module>` are build-time aliases defined by
 *   @docusaurus/core/module-type-aliases;
 * - `*.module.css` are CSS modules processed by the bundler.
 */
declare module '@theme/*';
declare module '@theme-original/*';

declare module '@docusaurus/Translate' {
  import type React from 'react';
  export function translate(
    translation: {id?: string; message: string; description?: string},
    values?: Record<string, unknown>,
  ): string;
  const Translate: React.FC<{
    id?: string;
    message?: string;
    description?: string;
    values?: Record<string, unknown>;
    children?: React.ReactNode;
  }>;
  export default Translate;
}

declare module '@docusaurus/Link';
declare module '@docusaurus/BrowserOnly' {
  import type React from 'react';
  export default function BrowserOnly({
    children,
    fallback,
  }: {
    children: () => React.ReactNode;
    fallback?: React.ReactNode;
  }): React.ReactNode;
}
declare module '@docusaurus/router' {
  export function useLocation(): {pathname: string; search: string; hash: string};
}
declare module '@docusaurus/useBaseUrl';
declare module '@docusaurus/useDocusaurusContext' {
  export default function useDocusaurusContext(): {
    siteConfig: {title: string; tagline: string; url: string; baseUrl: string; [key: string]: unknown};
    i18n: {currentLocale: string; [key: string]: unknown};
    [key: string]: unknown;
  };
}

declare module '*.module.css' {
  const classes: {readonly [key: string]: string};
  export default classes;
}

declare module '*.css';
