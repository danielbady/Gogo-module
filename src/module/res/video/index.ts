import type {
  PlaylistEpisodeServerRequest,
  PlaylistEpisodeServerResponse, PlaylistEpisodeSource,
  PlaylistEpisodeSourcesRequest, PlaylistID, PlaylistItemsOptions, PlaylistItemsResponse,
  VideoContent
} from '@mochiapp/js/dist';

export default class Video implements VideoContent {
  async playlistEpisodeServer(req: PlaylistEpisodeServerRequest): Promise<PlaylistEpisodeServerResponse> {
    throw new Error('Method not implemented: playlistEpisodeServer');
  }

  async playlistEpisodeSources(req: PlaylistEpisodeSourcesRequest): Promise<PlaylistEpisodeSource[]> {
    throw new Error('Method not implemented: playlistEpisodeSources');
  }

  async playlistEpisodes(playlistId: PlaylistID, options?: PlaylistItemsOptions): Promise<PlaylistItemsResponse> {
    return []
  }
}
