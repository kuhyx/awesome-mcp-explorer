// Plain tsc (and typed ESLint) cannot resolve `.astro` imports; only the
// Astro language server can. This lets tests import a page as a component.
declare module "*.astro" {
  const component: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default component;
}

// jsdom ships no types and the repo avoids a types-only dependency: the guard
// test only needs to parse a string into a document.
declare module "jsdom" {
  export class JSDOM {
    public readonly window: { readonly document: Document };
    public constructor(html: string);
  }
}
