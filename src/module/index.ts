import { DiscoverListingOrientationType, DiscoverListingType, } from '@mochiapp/js/src/interfaces/source/types';

import type {
  DiscoverListing,
  DiscoverListingsRequest,
  Paging,
  Playlist,
  PlaylistDetails,
  PlaylistItem,
  SearchFilter,
  SearchQuery,
} from '@mochiapp/js/dist';
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
  VideoContent
} from '@mochiapp/js/dist';
import { load } from 'cheerio';
import { PlaylistEpisodeServer } from '@mochiapp/js/src/contents/video/types';
import { getServerSources } from './utils/getServerUrl';

const BASENAME = 'https://anitaku.to'
const AJAX_BASENAME = 'https://ajax.gogo-load.com/ajax/'

export default class Source extends SourceModule implements VideoContent {
  metadata = {
    id: 'GoGoAnimeSource',
    name: 'GoGoAnime Source',
    version: '1.1.1',
  }

  async searchFilters(): Promise<SearchFilter[]>  {
    return [];
  }

  async search(searchQuery: SearchQuery): Promise<Paging<Playlist>> {
    const html = await request.get(`${BASENAME}/search.html?keyword=${searchQuery.query}&page=${searchQuery.page ?? 1}`)
    const $ = load(html.text());
    const pages = $('ul.pagination-list > li');
    const currentPageIndex = pages.filter('li.selected').index();
    const items: Playlist[] = $('.items > li').map((i, anime) => {
      const animeRef = $(anime);
      const url = animeRef.find('div > a').attr('href')?.split('/').pop() ?? '';
      const name = animeRef.find('.name > a').text();
      const img = animeRef.find('.img > a > img').attr('src') ?? '';
      return {
        id: url,
        url: `${BASENAME}/category/${url}`,
        status: PlaylistStatus.unknown,
        type: PlaylistType.video,
        title: name,
        bannerImage: img,
        posterImage: img,
      } satisfies Playlist
    }).get();

    const hasNextPage = pages.length > currentPageIndex + 2
    return {
      id: `${BASENAME}/search.html?keyword=${searchQuery.query}&page=${searchQuery.page ?? 1}`,
      nextPage: hasNextPage ? `${BASENAME}/search.html?keyword=${searchQuery.query}&page=${Math.min(pages.length, currentPageIndex + 2)}` : undefined,
      items: items,
      previousPage: `${BASENAME}/search.html?keyword=${searchQuery.query}&page=${Math.max(1, currentPageIndex)}`,
      title: "Test",
    };
  }

  async discoverListings(listingsRequest?: DiscoverListingsRequest | undefined): Promise<DiscoverListing[]> {
    return Promise.all([{
      url: `${BASENAME}/popular.html&page=${listingsRequest?.page ?? 1}`,
      title: 'Top Airing',
      id: 'top-airing',
      type: DiscoverListingType.rank,
    }, {
      url: `${BASENAME}/new-season.html&page=${listingsRequest?.page ?? 1}`,
      title: 'Seasonal Anime',
      id: 'new-season',
      type: DiscoverListingType.featured,
    }, {
      url: `${BASENAME}/anime-movies.html&page=${listingsRequest?.page ?? 1}`,
      title: 'Movies',
      id: 'anime-movies',
      type: DiscoverListingType.default,
    }].map(async page => {
      const html = await request.get(page.url)
      const $ = load(html.text());
      const pages = $('ul.pagination-list > li');
      const currentPageIndex = pages.filter('li.selected').index();
      const items: Playlist[] = $('.items > li').map((i, anime) => {
        const animeRef = $(anime);
        const url = animeRef.find('div > a').attr('href') ?? '';
        const name = animeRef.find('.name > a').text();
        const img = animeRef.find('.img > a > img').attr('src') ?? '';
        const id = url?.split('/').pop() ?? animeRef.find('.img > a > img').attr('alt') ?? `${page.id}-${i}`
        return {
          id,
          url: `${BASENAME}${url}`,
          status: PlaylistStatus.unknown,
          type: PlaylistType.video,
          title: name,
          bannerImage: img,
          posterImage: img,
        } satisfies Playlist
      }).get();

      const hasNextPage = pages.length > currentPageIndex + 2
      const baseName = page.url.split('&')[0]
      return {
        title: page.title,
        type: page.type,
        id: page.id,
        orientation: DiscoverListingOrientationType.landscape,
        paging: {
          id: 'top-airing',
          title: "Top Airing",
          previousPage: `${baseName}&page=${Math.max(1, currentPageIndex)}`,
          nextPage: hasNextPage ? `${baseName}&page=${Math.min(pages.length, currentPageIndex + 2)}` : undefined,
          items: items,
        }
      }
    }))
  }

  async playlistDetails(id: string): Promise<PlaylistDetails> {
    const html = await request.get(`${BASENAME}/category/${id}`)
    const $ = load(html.text());
    const info = $('.anime_info_body_bg > .type')
    const synopsis = info.get(1)?.lastChild
    const yearReleased = info.get(3)?.lastChild;
    return {
      synopsis: synopsis?.nodeType === 3 ? synopsis.data : '',
      genres: $(info.get(2)).find('a').text().split(", "),
      yearReleased: yearReleased?.nodeType === 3 ? parseInt(yearReleased.data, 10) : 0,
      previews: [],
      altBanners: [],
      altPosters: [],
      altTitles: [],
    } satisfies PlaylistDetails
  }


  async playlistEpisodeServer(req: PlaylistEpisodeServerRequest): Promise<PlaylistEpisodeServerResponse> {
    const sources = await getServerSources(`${BASENAME}/${req.episodeId}`, req.sourceId);
    return {
      links: sources.map((source) => ({
        url: source.url,
        // @ts-ignore
        quality: PlaylistEpisodeServerQualityType[source.quality] ?? PlaylistEpisodeServerQualityType.auto,
        format: PlaylistEpisodeServerFormatType.dash
      })).sort((a, b) => b.quality - a.quality),
      skipTimes: [],
      headers: {},
      subtitles: [],
    }
  }

  async playlistEpisodeSources(req: PlaylistEpisodeSourcesRequest): Promise<PlaylistEpisodeSource[]> {
    const html = await request.get(`${BASENAME}/${req.episodeId}`).then(t => t.text())
    const $ = load(html)
    const servers = $('div.anime_muti_link > ul > li').map((i, el) => {
      const nodes = $(el).find('a').get(0)?.childNodes ?? [];
      const displayName = nodes.length > 2 ? nodes[nodes.length - 2] : undefined;
      return {
        id: $(el).attr('class') ?? `${BASENAME}/${req.episodeId}-${i}`,
        displayName: displayName && displayName.nodeType === 3 ? displayName.data : $(el).attr('class') ?? 'NOT_FOUND',
      } satisfies PlaylistEpisodeServer
    }).get();

    return [{
      id: 'servers',
      // Filter only working ones
      servers: servers.filter(s => s.id === 'anime' || s.id === 'vidcdn'),
      displayName: "Servers",
    }]
  }

  async playlistEpisodes(playlistId: PlaylistID, options?: PlaylistItemsOptions): Promise<PlaylistItemsResponse> {
    const variantGroups = playlistId.endsWith('-dub') ? [playlistId, playlistId.replace('-dub', '')] : [playlistId, `${playlistId}-dub`]
    let variants = await Promise.all(variantGroups.map(async id => {
      const variantId = id.endsWith("-dub") ? "DUB" : "SUB";
      const html = await request.get(`${BASENAME}/category/${id}`);
      const $ = load(html.text());
      const pages = $('#episode_page > li').map((_, page) => {
        const a = $(page).find('a')
        return ({
          episodeStart: a.attr('ep_start'),
          episodeEnd: a.attr('ep_end'),
        })
      }).get()
      const movieId = $('#movie_id').attr('value')
      const pagings = await Promise.all(pages.map(async (page) => {
        const episodes = load(await request.get(`${AJAX_BASENAME}/load-list-episode?ep_start=${page.episodeStart}&ep_end=${page.episodeEnd}&id=${movieId}&default_ep=${0}&alias=${id}`).then(t => t.text()))
        const video = episodes('#episode_related > li').map((i, episode) => {
          const link = episodes(episode).find('a').attr('href')?.slice(2) ?? id
          const title = $(episode).find('.name').text();
          return {
            id: link,
            title,
            number: parseInt(title.split(" ")[1], 10),
            tags: [],
          } satisfies PlaylistItem
        }).get().reverse()
        return {
          id: `${movieId}-${page.episodeStart}-${page.episodeEnd}`,
          title: `${page.episodeStart}-${page.episodeEnd}`,
          items: video
        }
      }))
      return {
        id: `${movieId}-${variantId}`,
        title: variantId,
        pagings,
      }
    }))
    return [{
      id: 'gogo-playlist',
      number: 1,
      variants,
    }]
  }
}
