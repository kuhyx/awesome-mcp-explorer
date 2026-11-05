/**
 * Where the jsdom element tests read their markup from. A node test asserts it
 * equals what the homepage component renders, so it cannot drift from the build.
 */
export const FIXTURE_PATH = `${process.cwd()}/src/test/home-fixture.html`;
