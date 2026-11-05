// Plain tsc (and typed ESLint) cannot resolve `.astro` imports; only the
// Astro language server can. This lets tests import a page as a component.
declare module "*.astro" {
  const component: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default component;
}
