import { load } from 'cheerio';
import GogoCDN from '../extractors/gogoCDN';

export async function getServerSources(url: string, sourceId: string) {
  const $ = load( await request.get(url).then(t => t.text()));
  switch (sourceId) {
    case 'anime':
      return new GogoCDN().extract($('#load_anime > div > div > iframe').attr('src')!)
    default:
      return new GogoCDN().extract($('div.anime_video_body > div.anime_muti_link > ul > li.vidcdn > a').attr('data-video')!)
  }
}
