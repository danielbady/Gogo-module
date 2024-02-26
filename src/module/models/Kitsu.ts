export class Kitsu {
  private basename = "https://kitsu.io/api/edge";
  private malCache = {};

  async getKitsuPlaylist(playlistName: string) {
    `${this.basename}/anime?filter%5Btext%5D=${encodeURIComponent(
      playlistName,
    )}&page%5Blimit%`;
  }
}
