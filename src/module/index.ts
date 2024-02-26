import {
  DiscoverListingOrientationType,
  DiscoverListingType,
} from "@mochiapp/js/src/interfaces/source/types";

import type {
  DiscoverListing,
  DiscoverListingsRequest,
  Paging,
  Playlist,
  PlaylistDetails,
  PlaylistItem,
  SearchFilter,
  SearchQuery,
} from "@mochiapp/js/dist";
import {
  PlaylistEpisodeServerFormatType,
  PlaylistEpisodeServerQualityType,
  PlaylistEpisodeServerRequest,
  PlaylistEpisodeServerResponse,
  PlaylistEpisodeSource,
  PlaylistEpisodeSourcesRequest,
  PlaylistID,
  PlaylistItemsOptions,
  PlaylistItemsResponse,
  PlaylistStatus,
  PlaylistType,
  SourceModule,
  VideoContent,
} from "@mochiapp/js/dist";
import { load } from "cheerio";
import { PlaylistEpisodeServer } from "@mochiapp/js/src/contents/video/types";
import { getServerSources } from "./utils/getServerUrl";
import { Kitsu } from "./models/Kitsu";
import levenshtein from "js-levenshtein";

const BASENAME = "https://anitaku.to";
const AJAX_BASENAME = "https://ajax.gogo-load.com/ajax/";
const kitsu = new Kitsu();
let lastPlaylistHtml: string | undefined;

const LISTINGS = {
  "top-airing": {
    url: `${BASENAME}/popular.html`,
    title: "Top Airing",
    id: "top-airing",
    type: DiscoverListingType.rank,
  },
  "new-season": {
    url: `${BASENAME}/new-season.html`,
    title: "Seasonal Anime",
    id: "new-season",
    type: DiscoverListingType.featured,
  },
  "anime-movies": {
    url: `${BASENAME}/anime-movies.html`,
    title: "Movies",
    id: "anime-movies",
    type: DiscoverListingType.default,
  },
};

function getListings(listingId?: string, page?: string) {
  const id = listingId as keyof typeof LISTINGS;
  let listings = LISTINGS;
  console.log(page);
  if (listingId && page) {
    listings[id].url = page;
  }
  return Object.values(listings);
}

export default class GogoAnime extends SourceModule implements VideoContent {
  metadata = {
    id: "GoGoAnimeSource",
    name: "GoGoAnime",
    version: "1.1.1",
  };

  async searchFilters(): Promise<SearchFilter[]> {
    return [];
  }

  async search(searchQuery: SearchQuery): Promise<Paging<Playlist>> {
    const html = await request.get(
      `${BASENAME}/search.html?keyword=${searchQuery.query}&page=${searchQuery.page ?? 1}`,
    );
    const $ = load(html.text());
    const pages = $("ul.pagination-list > li");
    const currentPageIndex = pages.filter("li.selected").index();
    const items: Playlist[] = $(".items > li")
      .map((i, anime) => {
        const animeRef = $(anime);
        const url =
          animeRef.find("div > a").attr("href")?.split("/").pop() ?? "";
        const name = animeRef.find(".name > a").text();
        const img = animeRef.find(".img > a > img").attr("src") ?? "";
        return {
          id: url,
          url: `${BASENAME}/category/${url}`,
          status: PlaylistStatus.unknown,
          type: PlaylistType.video,
          title: name,
          bannerImage: img,
          posterImage: img,
        } satisfies Playlist;
      })
      .get();

    const hasNextPage = pages.length >= currentPageIndex + 2;
    return {
      id: `${BASENAME}/search.html?keyword=${searchQuery.query}&page=${searchQuery.page ?? 1}`,
      nextPage: hasNextPage
        ? `${BASENAME}/search.html?keyword=${searchQuery.query}&page=${Math.min(pages.length, currentPageIndex + 2)}`
        : undefined,
      items: items,
      previousPage:
        currentPageIndex !== 0
          ? `${BASENAME}/search.html?keyword=${searchQuery.query}&page=${currentPageIndex + 1}`
          : undefined,
      title: "Test",
    };
  }

  async discoverListings(
    listingsRequest?: DiscoverListingsRequest | undefined,
  ): Promise<DiscoverListing[]> {
    return Promise.all(
      getListings(listingsRequest?.listingId, listingsRequest?.page).map(
        async (page) => {
          const html = await request.get(page.url);
          const $ = load(html.text());
          const pages = $("ul.pagination-list > li");
          const currentPageIndex = pages.filter("li.selected").index();
          const items: Playlist[] = $(".items > li")
            .map((i, anime) => {
              const animeRef = $(anime);
              const url = animeRef.find("div > a").attr("href") ?? "";
              const name = animeRef.find(".name > a").text();
              const img = animeRef.find(".img > a > img").attr("src") ?? "";
              const id =
                url?.split("/").pop() ??
                animeRef.find(".img > a > img").attr("alt") ??
                `${page.id}-${i}`;
              return {
                id,
                url: `${BASENAME}${url}`,
                status: PlaylistStatus.unknown,
                type: PlaylistType.video,
                title: name,
                bannerImage: img,
                posterImage: img,
              } satisfies Playlist;
            })
            .get();

          const hasNextPage = pages.length >= currentPageIndex + 2;
          const baseName = page.url.split("&")[0];
          return {
            title: page.title,
            type: page.type,
            id: page.id,
            orientation: DiscoverListingOrientationType.portrait,
            paging: {
              id: page.url,
              title: page.title,
              previousPage:
                currentPageIndex !== 0
                  ? `${baseName}&page=${currentPageIndex}`
                  : undefined,
              nextPage: hasNextPage
                ? `${baseName}&page=${Math.min(pages.length, currentPageIndex + 2)}`
                : undefined,
              items: items,
            },
          };
        },
      ),
    );
  }

  async playlistDetails(id: string): Promise<PlaylistDetails> {
    const html = await request
      .get(`${BASENAME}/category/${id}`)
      .then((r) => r.text());
    lastPlaylistHtml = html;
    const $ = load(html);
    const info = $(".anime_info_body_bg > .type");
    const synopsis = info.get(1)?.lastChild;
    const yearReleased = info.get(3)?.lastChild;
    return {
      synopsis: synopsis?.nodeType === 3 ? synopsis.data : "",
      genres: $(info.get(2)).find("a").text().split(", "),
      yearReleased:
        yearReleased?.nodeType === 3 ? parseInt(yearReleased.data, 10) : 0,
      previews: [],
      altBanners: [],
      altPosters: [],
      altTitles: [],
    } satisfies PlaylistDetails;
  }

  async playlistEpisodeServer(
    req: PlaylistEpisodeServerRequest,
  ): Promise<PlaylistEpisodeServerResponse> {
    const sources = await getServerSources(
      `${BASENAME}/${req.episodeId}`,
      req.sourceId,
    );
    return {
      links: sources
        .map((source) => ({
          url: source.url,
          quality:
            // @ts-ignore
            PlaylistEpisodeServerQualityType[source.quality] ??
            PlaylistEpisodeServerQualityType.auto,
          format: PlaylistEpisodeServerFormatType.dash,
        }))
        .sort((a, b) => b.quality - a.quality),
      skipTimes: [],
      headers: {},
      subtitles: [],
    };
  }

  async playlistEpisodeSources(
    req: PlaylistEpisodeSourcesRequest,
  ): Promise<PlaylistEpisodeSource[]> {
    const html = await request
      .get(`${BASENAME}/${req.episodeId}`)
      .then((t) => t.text());
    const $ = load(html);
    const servers = $("div.anime_muti_link > ul > li")
      .map((i, el) => {
        const nodes = $(el).find("a").get(0)?.childNodes ?? [];
        const displayName =
          nodes.length > 2 ? nodes[nodes.length - 2] : undefined;
        return {
          id: $(el).attr("class") ?? `${BASENAME}/${req.episodeId}-${i}`,
          displayName:
            displayName && displayName.nodeType === 3
              ? displayName.data
              : $(el).attr("class") ?? "NOT_FOUND",
        } satisfies PlaylistEpisodeServer;
      })
      .get();

    return [
      {
        id: "servers",
        // Filter only working ones
        servers: servers.filter((s) => s.id === "anime" || s.id === "vidcdn"),
        displayName: "Servers",
      },
    ];
  }

  async playlistEpisodes(
    playlistId: PlaylistID,
    options?: PlaylistItemsOptions,
  ): Promise<PlaylistItemsResponse> {
    const html =
      lastPlaylistHtml === undefined
        ? await request
            .get(`${BASENAME}/category/${playlistId}`)
            .then((r) => r.text())
        : lastPlaylistHtml;
    const html$ = load(html);
    const isDub = playlistId.endsWith("-dub");
    const title = html$(".anime_info_body_bg > h1").text();
    const titleWithoutDub = title.split(" (Dub)")[0];
    let variantHtmls = [html];
    const searchHtml$ = load(
      await request
        .get(
          `${BASENAME}/filter.html?keyword=${encodeURIComponent(titleWithoutDub)}${isDub ? "" : "&language%5B%5D=dub"}`,
        )
        .then((r) => r.text()),
    );
    const items = searchHtml$(".items > li");
    const closestArray = items
      .map((_, e) =>
        levenshtein(
          `${titleWithoutDub}${isDub ? "" : " (Dub)"}`,
          searchHtml$(e).find(".name > a").text(),
        ),
      )
      .get();
    const i = closestArray.indexOf(0);
    if (i !== -1) {
      const item = items.get(i);
      const id = searchHtml$(item).find(".name > a").attr("href");
      const variantHtml = await request
        .get(`${BASENAME}/${id}`)
        .then((r) => r.text());
      variantHtmls.push(variantHtml);
    }

    let variants = await Promise.all(
      variantHtmls.map(async (html) => {
        const $ = load(html);
        const pages = $("#episode_page > li")
          .map((_, page) => {
            const a = $(page).find("a");
            return {
              episodeStart: a.attr("ep_start"),
              episodeEnd: a.attr("ep_end"),
            };
          })
          .get();
        const movieId = $("#movie_id").attr("value");
        const alias = $("#alias_anime").attr("value");
        const pagings = await Promise.all(
          pages.map(async (page) => {
            const episodes = load(
              await request
                .get(
                  `${AJAX_BASENAME}/load-list-episode?ep_start=${page.episodeStart}&ep_end=${page.episodeEnd}&id=${movieId}&default_ep=${0}&alias=${alias}`,
                )
                .then((t) => t.text()),
            );
            const video = episodes("#episode_related > li")
              .map((i, episode) => {
                const link =
                  episodes(episode).find("a").attr("href")?.slice(2) ?? alias!;
                const title = $(episode).find(".name").text();
                return {
                  id: link,
                  title,
                  number: parseInt(title.split(" ")[1], 10),
                  tags: [],
                } satisfies PlaylistItem;
              })
              .get()
              .reverse();
            return {
              id: `${playlistId}-${page.episodeStart}-${page.episodeEnd}`,
              title: `${page.episodeStart}-${page.episodeEnd}`,
              items: video,
            };
          }),
        );
        const variantId = alias?.endsWith("dub") ? "DUB" : "SUB";
        return {
          id: `${playlistId}-${variantId}`,
          title: variantId,
          pagings,
        };
      }),
    );
    return [
      {
        id: playlistId,
        number: 1,
        // @ts-ignore
        variants,
      },
    ];
  }
}
