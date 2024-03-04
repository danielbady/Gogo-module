import Source from "../../src/module";
import { test } from "vitest";
import runner from "@mochiapp/runner/dist/src";

const source = runner(Source);

test("provides correct episodes playlist", async () => {
  console.log(await source.playlistEpisodes("dr-stone-new-world-part-2-dub"));
});

test("provides correct episode playlist server", async () => {
  console.log(
    await source.playlistEpisodeServer({
      episodeId: "one-piece-episode-1",
      playlistId: "one-piece",
    }),
  );
});

test("provides correct episode playlist source", async () => {
  console.log(
    await source.playlistEpisodeSources({
      episodeId: "spy-x-family-episode-1",
      playlistId: "spy-x-family",
    }),
  );
});
