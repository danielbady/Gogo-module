import { CheerioAPI, load } from 'cheerio';
import CryptoJS from 'crypto-js';

import { VideoExtractor, IVideo } from '../models';
import { gup } from '../utils/utils';

class GogoCDN extends VideoExtractor {
  protected override serverName = 'goload';
  protected override sources: IVideo[] = [];

  private readonly keys = {
    key: CryptoJS.enc.Utf8.parse('37911490979715163134003223491201'),
    secondKey: CryptoJS.enc.Utf8.parse('54674138327930866480207815084989'),
    iv: CryptoJS.enc.Utf8.parse('3134003223491201'),
  };

  private referer: string = '';

  override extract = async (videoUrl: string): Promise<IVideo[]> => {
    this.referer = videoUrl;

    const res = await request.get(videoUrl).then(t => t.text());
    const $ = load(res);

    const encyptedParams = await this.generateEncryptedAjaxParams($, gup('id', videoUrl) ?? '');

    const encryptedData: any = await request.get(
      `${videoUrl.match(/https?:\/\/.+\.\w{3}/g)![0]}/encrypt-ajax.php?${encyptedParams}`,
      {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    ).then(r => r.json());

    const decryptedData = await this.decryptAjaxData(encryptedData.data);
    if (!decryptedData.source) throw new Error('No source found. Try a different server.');

    if (decryptedData.source[0].file.includes('.m3u8')) {
      const resResult: any = await request.get(decryptedData.source[0].file.toString()).then(r => r.text());
      const resolutions = resResult.match(/(RESOLUTION=)(.*)(\s*?)(\s*.*)/g);
      resolutions?.forEach((res: string) => {
        const index = decryptedData.source[0].file.lastIndexOf('/');
        const quality = res.split('\n')[0].split('x')[1].split(',')[0];
        const url = decryptedData.source[0].file.slice(0, index);
        this.sources.push({
          url: url + '/' + res.split('\n')[1],
          isM3U8: (url + res.split('\n')[1]).includes('.m3u8'),
          quality: 'q' + quality + 'p',
        });
      });

      decryptedData.source.forEach((source: any) => {
        this.sources.push({
          url: source.file,
          isM3U8: source.file.includes('.m3u8'),
          quality: 'default',
        });
      });
    } else
      decryptedData.source.forEach((source: any) => {
        this.sources.push({
          url: source.file,
          isM3U8: source.file.includes('.m3u8'),
          quality: source.label.split(' ')[0] + 'p',
        });
      });

    decryptedData.source_bk.forEach((source: any) => {
      this.sources.push({
        url: source.file,
        isM3U8: source.file.includes('.m3u8'),
        quality: 'backup',
      });
    });

    return this.sources;
  };

  private generateEncryptedAjaxParams = async ($: CheerioAPI, id: string): Promise<string> => {
    const encryptedKey = CryptoJS.AES.encrypt(id, this.keys.key, {
      iv: this.keys.iv,
    });

    const scriptValue = $("script[data-name='episode']").attr('data-value') as string;

    const decryptedToken = CryptoJS.AES.decrypt(scriptValue, this.keys.key, {
      iv: this.keys.iv,
    }).toString(CryptoJS.enc.Utf8);

    return `id=${encryptedKey}&alias=${id}&${decryptedToken}`;
  };

  private decryptAjaxData = async (encryptedData: string): Promise<any> => {
    const decryptedData = CryptoJS.enc.Utf8.stringify(
      CryptoJS.AES.decrypt(encryptedData, this.keys.secondKey, {
        iv: this.keys.iv,
      })
    );

    return JSON.parse(decryptedData);
  };
}

export default GogoCDN;
