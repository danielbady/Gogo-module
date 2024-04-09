import {
  DiscoverListing,
  DiscoverListingOrientationType,
  DiscoverListingsRequest,
  Paging,
  Playlist,
  PlaylistDetails,
  PlaylistEpisodeServerFormatType,
  PlaylistEpisodeServerQualityType,
  PlaylistEpisodeServerRequest,
  PlaylistEpisodeServerResponse,
  PlaylistEpisodeServerSkipTime,
  PlaylistEpisodeServerSkipType,
  PlaylistEpisodeSource,
  PlaylistEpisodeSourcesRequest,
  PlaylistID,
  PlaylistItem,
  PlaylistItemsOptions,
  PlaylistItemsResponse,
  PlaylistStatus,
  PlaylistType,
  SearchFilter,
  SearchQuery,
  SourceModule,
  VideoContent,
} from "@mochiapp/js/dist";
import { load } from "cheerio";
import { PlaylistEpisodeServer } from "@mochiapp/js/src/contents/video/types";
import { getServerSources } from "./utils/getServerUrl";
import levenshtein from "js-levenshtein";
import { jikanSchema } from "./schemas/jikanSchema";
import { aniskipSchema } from "./schemas/aniskipSchema";
import { DiscoverListingType } from "@mochiapp/js/src/interfaces/source/types";

const BASENAME = "https://anitaku.so";
const AJAX_BASENAME = "https://ajax.gogocdn.net/ajax";

const LISTINGS = {
  recent: {
    url: `${BASENAME}/home.html`,
    title: "Recent Release",
    id: "recent-release",
    type: DiscoverListingType.featured,
  },
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
    type: DiscoverListingType.default,
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
    version: "2.0.1",
    description: "",
    icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAEtWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS41LjAiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIKICAgIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIKICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgdGlmZjpJbWFnZUxlbmd0aD0iMTI4IgogICB0aWZmOkltYWdlV2lkdGg9IjEyOCIKICAgdGlmZjpSZXNvbHV0aW9uVW5pdD0iMiIKICAgdGlmZjpYUmVzb2x1dGlvbj0iNzIvMSIKICAgdGlmZjpZUmVzb2x1dGlvbj0iNzIvMSIKICAgZXhpZjpQaXhlbFhEaW1lbnNpb249IjEyOCIKICAgZXhpZjpQaXhlbFlEaW1lbnNpb249IjEyOCIKICAgZXhpZjpDb2xvclNwYWNlPSIxIgogICBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIgogICBwaG90b3Nob3A6SUNDUHJvZmlsZT0ic1JHQiBJRUM2MTk2Ni0yLjEiCiAgIHhtcDpNb2RpZnlEYXRlPSIyMDI0LTAyLTI2VDIzOjI1OjEyKzAxOjAwIgogICB4bXA6TWV0YWRhdGFEYXRlPSIyMDI0LTAyLTI2VDIzOjI1OjEyKzAxOjAwIj4KICAgPHhtcE1NOkhpc3Rvcnk+CiAgICA8cmRmOlNlcT4KICAgICA8cmRmOmxpCiAgICAgIHN0RXZ0OmFjdGlvbj0icHJvZHVjZWQiCiAgICAgIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFmZmluaXR5IFBob3RvIDIgMi4zLjEiCiAgICAgIHN0RXZ0OndoZW49IjIwMjQtMDItMjZUMjM6MjU6MTIrMDE6MDAiLz4KICAgIDwvcmRmOlNlcT4KICAgPC94bXBNTTpIaXN0b3J5PgogIDwvcmRmOkRlc2NyaXB0aW9uPgogPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KPD94cGFja2V0IGVuZD0iciI/Pk5D/wkAAAGAaUNDUHNSR0IgSUVDNjE5NjYtMi4xAAAokXWR3yuDURjHP9uImCjSkoulcYWGWtwoWxq1tGbKcLO9+6X24+19t7TcKrcrStz4dcFfwK1yrRSRkutdEzfo9bymJtlzes7zOd9znqdzngPWcEbJ6g1uyOYKWsjvdS5GlpxNFaz00I0DS1TR1algMEBde7vDYsabIbNW/XP/Wms8oStgaRaeVFStIDwjHFgrqCZvC3cp6Whc+FR4UJMLCt+aeqzKFZNTVf4wWQuHfGDtEHamfnHsFytpLSssL8eVzRSVn/uYL7EncgvzEvvEe9EJ4ceLk1mm8eFhhAmZPQwxyrCsqJPv/s6fIy+5iswqJTRWSZGmwKCoRamekJgUPSEjQ8ns/9++6smx0Wp1uxcanwzjpR+atuCzbBjvh4bxeQS2R7jI1fLzBzD+Knq5prn2oX0Dzi5rWmwHzjfB8aBGtei3ZBO3JpPwfAJtEei8hpblas9+9jm+h/C6fNUV7O7BgJxvX/kCIatnxnNMD6UAAAAJcEhZcwAACxMAAAsTAQCanBgAABQUSURBVHic7Zt7fFvFlcd/I8mW/JCubPkRP2/sxJaTGIkmEEO3CArFtB+wKdsmLVBtHwR29/OJIQ0Jj8bsLh/c18aFQpy2W9EkXZOlJOxuayc8hEPbS3nYSWgk8rKd143jxM9YV7Js2XrM/nElS1ZkO4GEpt35/qV77txzZ+bcmXPmzAhgMBgMBoPBYDAYDAaDwWAwGAwGg8FgMBgMBoPBYDAYDAaDwWAwGAwGg8FgMBgMBoPBYDAYDAaDwWAwLjOND/P9rQv4vNRYoV6nqX9gfuMjpXx+2pwadv5oUf/uxXxhZqyQL8jYuMbYuKacL9Bf5hr/jdGxZbGvraD+ocopibkit/81s68t39dW0P+7QuuXK2d5HIDvvVt9bfm1N8+LaijX9e8q97UV+NoK+ltLzWXpV6r2M6P49F95qei1yfYms6nYDRBQf1ioS9nxdAanltbbVCu/rwJRNX5bMlfkJtTAF3D25xdirBMAp0uJqE2yP5vPpdH1W7j127K49KQ3n8vnCzITavj/i2lRQecrxv7WUvsLxo6tS/h8rSy31S/ytRXUryqTL2s/X+zbU9yx1XShBrPR0L97Uf8uo/2F8o5t1+q1allu37zU11ZYd59RvrTeVexrK7RvXnrl2/TXg16r7rAV9u8ymivmxcr5/DTf26UdWxbHCm0bFvra8q21xmklC7i+3Us6f1Om1ybFyi3X5fn2FNmbps1a9qZK355Cy/UFl7sdf7XYm8z9vys0l+vi5LYNC31thZZlWbFCvkDve3tBx7ZrY4UdWyv7WxdcODXt/MEC3x7esrwkVmhZXuJrK9r5w/LZa6XldMaqpXlLF3OmspRrStWV89WVJWnXLDBcayy+7hrTjcsvqY2qSyr9aVJ3b7mlYmj9Fp2j60zcrdobIJ7XC/sPxgrFXlfrB5k1VSN8gV7sdQGoX1ViKnavfCbkONofW1KvS625Ac4eg9DxYaxc6Djp7KmsuTGg16W53N7YW0npqcX/eM9YoV5Tktc/MdYV9INSEACEAgR0EhgDOQ/aSxT6tdW5au3YiTOcXzHwpz+H9ncPnTk3UzOvUies12nq7wsJRzI2/dcRWcLna+UP2XJdHpcy1vpe4MKnWt6bBPXXWrIB8AW6+m+om99OavlD2H7mihzZhdTcPA+h8ebXBhNoeNeHgNuydFpImqpLz/zJP51Yln8uN/XkmDQe9FOAEkJBKACAIvybggQplfwTXaNDPTmagwXJg1+rmnzmft5y3UwtvUoNsHFNBZfia2h2y5fWL2V3vpTV/rN0Pj/dstQAQDjgvvApcSgNAKceAVD/zUyEJhq2DYUVPnpt+2ZNx8/1fGEWn+UDqONEgvcKBzwANS1Uxwqzv7B8QKukAAEIAMCQrClO0aUp55g/CEAIcavJxIO3z1TmajQAX5BhvdUHdb7QcRpA7eeLbevTnWIqQGtvykBoDKAuz2SCJxUpAOELs/m8VOttEId1Yq8EoPYmQ92dkvCRgkuH5TM60IlI4Qs1aAAgNBErG0kKgRAACkIKDvWX294d/uozp+95ijy0ufgXvy841K8imP/G4cyAAhELyT+yjw/r3nISoF8ZKFv+mYSNvRoNYP1SJgIe+IfNFTkArHcWVa/3Lv/2oea2kKlc5zweAkj9t/MsVaWxT1luqLDeOgFQZ7e3flUJqJ/PoXLws/obpqp/dlWvOeU8M4/P9rsmswBivW3ScsM0f2upKrfeFgSIOJgcK09TJoNSQkjOjg7fHxze25fMf/Q+ACml+aNfqFScHtT/5n1f3/C8dhEABWjkQeWbBzLKSiigIIrJ0bGEjb0anbC5XA/0IeRr/4Wh9YNsYf8AEKq9Obf2c7qW92nL70+13l5Ws3zY/n0CRQlIEgBQP0KjQMgppja/fnbHTToA8A93bi9oaVc2t3Rz6SrrXcV85giI6qXdZ/+husR665D1Vj8UJSDJAAX1I+QFqLM3r7l1f2x9FKeHQCmfqg8s4QdWLg9SaijPAzBelustyxlZmJ0VUJB3jkgffET+rlAeAxSY5wlOnDw7tjALfh9P1ScOdyZsLEko/ctiNmbVfyuLC0fuBKCgIYBAkbx+U4/j6CCA2luKLOYkk9EQni6ISjznEw54Wt9xuSSPuUy7cc1C0MA0DUQhefzrmvrkGMlas8BcGjSVZ4FOAgBJEvsmBIevueVYXH3SdFpu27pzvlEANNxldMmmPx4vTBm/p4oAFFhwetS7ufX8v98/SUNyn+ZseyftmtITywoA5O12ntv+ZsLGXo0GuAqZ98hX+6vCiwYKEBrKe/aNodLMyXtukA2g7+5z/Wuzfme9yz8BgB+c8P96j/TEl72ByeyAcnR107h7NKHmq9EHXIVo3u1KVigoQAgBQEAmg8GyyuhSfDwUBBCiFIDeT0Y3t/gfut0bmFQAWbsOzNT7YAa4SE7tc5aIXkS6mBL4aUitTSckvBRQgGg53UQwkClNhp552VD3lUFdEgGKDw8e2fHGLJovjwH0WlX9dwrNxr/lVGLPc6/okzRTlwQIhIKUUnkST1MmeSS3YfNbk09sDd3xmW6DAkB6r6v/+VdnV3t5oiDbkyU1y8dqP5e3/Dvn+aI8sWfGlXcsek5rWjwfoXHnkXPy0l+v05jKuPBtpUboEC9L9Wargy7VZMwEDUCpE9q7Zinp7RssfMsp3VIuf/IEmAwFgCT5MiOgHAJczu7sJ+8/zWspoPcT9Yt7+j0zTj4yl8cAXFoAgMloAGB/Lg80a93PpNbfn57lkca1lavvdIMOg4akiSLjfT0ut9f2WHZNlT/cPkxWP54l7B+6mArodWn139TzRTkrHvvzjGW0yfUP8JteOSOeG5clfL6u45fzOLUbhIB6oDI6TyqEj0jz68Nx6SOZwZfb0m9c6FErAKLNyx70eQlSZAP4Oo4WLqscu/dzYr4WgNoXmGzY4TrRO2fNL8MUVHtLgbmUAABRAeDzOT7j/M56avuXa2d5iksNgAYBAqLkNB7TkhIAnD4DRAmiBJSgAFFeTAX06Sr7c/mr70bN0gHz4uKEZSzLcjpfnr/6rlF+XjTNYP2ijtN4QZSAAkSB4Kip2L36Tnd7U1LHVpO1ZkGckgmPN73tIAAKjH22bLIiH5E4MvDQHX3r7hzJ1wJIVSZlbRXGLqL38ckN0LjGuOMpBZcyAUDyyCG5AgBoyGoZtDdV6nWJd2udx2JzCeH1o7PLE5URpdhP4x+7ALMxs/MVo4mX15khTpNgyFtrSuwb0zmNF5gWeFuW5UTelYS0RVDngSiBIEBNRcO2R3ydO821txTGqnK3vpcdUAIYXpjjCUSb0OfzBGkIgEah1L64p/edaUu5Wfj4BtDrNPZNS1bfNQoakiWOQ8fidFoqRuzPz9frEmRdHMfGQIORq3CvNL8pCZ05wtFM4Whm0640sWdg9jqYy3X2xgxO7YrqmZ7GAVD7ed72XUVUTqNG1Ues1dqh1tzYprlpn/FbvpUNqqZd6cLhVCQZ+IzBHU/B9m9VU4943R5dy4fy0g4xWQcZnUqduVXof6t99mrH8jF9gGlRwYtrFaYSV4J7ZJpRTUUu+0/nV68RXe5pyRCxn0KhjtqAhgCIZ0clyctpVQCdmqlnwmzMtDdmcCm+6W+ftrQ0V+TYvksQii0T7TRTOYcJLwDBGf6GxJ4BsQctfwgXsCyfby4JWK4Lxeo8/qo9r4Drq5ofyUWHs6QGt39848tnj8fvXszOxxkBZmPmW406U0ko/gZRAXAejI8lTMVu+wtGPTftzIHY0w91XuQq3CmmBUk1y0ctiyTLIvfGNQtnqQNfwNmfnRff+6Ag0TyaXpdmezSFS/Un1KDn0uGXtwSocMCbsIzQcWrTK2dWrN8bJz/3/M683R/p/QCgAikhqfmvHRx77Fejl9j7+BgjwFyuszfqOXWCdLxsAJfbCyTF3TEV9tsez1vxve5YobDvnCXuKIlCM5VucR7umakOel3qzqczObUUf4NSKNOB8/KVbUOZqUTu4lDMpxYxdnkmQhOAAsm5jiMzxk4zcXb7G9j+RvnypZOj3pkSbRfDpY0Aczln/4lBdrkgita9aa37c6KDmsyijdQs99rqp22jSz4u5ioEAMqUqTna5YmfzaewfW++af4kAGlC17BDB2XktBZRSGNh29dasmuWDQFwnOaqN6QgSV4kRicoPpfIzRc+HJ691bPQ1fHhqU/Q+7gkA5grcu3P5nApkwDEEUP1YxMrnuxa8fifxaHI3BKOGsM6xfP6qocVwtGMiAJivUWq+1rRlEJHd+wwogCgTI1O4opp21JT1N1XUXOdBAAqbfXavoZfHhE+irRCxTkOHQfAF2Ta1usAKo0pVz7VK7SfEJzB6FsAAHxuJLOpSMVfjos1gF6r3vE0x2nGADjFtKoHjgv7wyGKeH7qQ1YBUTfoPJnkONyzcoPo7M2f0rPxIcXUyRFxMDnSIzT84StSolVSJjinxhdw9V8PO+eG7dTROQIAyeHjEZIvfH7C9kS+7B42/TYkb4o5u+WAh0zZwFyeIf82L0yaKVb+FLhYA7zZVMkbwp6q5d3x2EMDwv7IolEhe5SwARxdLgAuyVNdd8h5OnygCjTQuGpMzhqJA7ERCwUgvOeQHQmA6MQSg+3JEi41AMDZk9lgC499ye2LvHEEQN39SyyLzgOQxjVNr4anF9f4VCgcNgCnCa85uOThzpf5nT8sr/t6acKI+YpyUQZo/O4Sc0E0vWOt1sR+MtEPmUxtoQCAOBBW7nKPVT9ywnkiLOdSQzueNui1auGDLii1sY8AgCIcxgjvH4qrhmWpwVIxBADK1Ad/HE0VOA6dlH84j43rtcn1X5+QFW76bdDlDg8XZ/do2M1EJiFz+dTRB8KpXTXXj25c5etrKWlce83F9MnlYm4DWJblrr5rdJr7yhqr/070+Jizezx8N9YANBS7jnV5Jh98jkq+9CkNO36wAIA4KH/vMTupikjG8QIfYNtQKhdraB53HI1ZoynCjtc1prFtKONSxiF//jujZVzj8eNpas0sTXArnwlVP+Zt+B++YYeuedcVzwDGMkcYque0tscNoBIAeVdPlq++O9T8epajcwiA40gvkq6B/3zYAIQAFMoUZ+e0gzeOI73Va3X2jVouDQAsi6T6B3ixz8+Hc9gRAyjT4T8PxPtG692LeO4sAHFI0/Rq37RaKlIBP0Dr/j6FSw7HoJv+1x+79BPau6EoQWhCfpHlhgoE3fK34jilbvljHwDhw/fn7rDLzRwjYPWKHD7TBcB5mqv+nko4agjfCI7bnoi6VsfxSQCSxxfVqc5zSZ44bY4u97oX1VMptvp7g5bKyPmqSPQpjcrrOxLnA6y3ySVpw3bEHVuDSi93K5c8LP+QxlRNr16QxkiOOWA6GWPC4BwZ4yvKbAbQ6zR1d4cAApVuxVNnhb09KzeccJwJJ7BMRUN194YPJ58eUCGaCwIAYd/ZhDqbW0807eaiwc8FqRvHYXkGCEGlnRKaK3ItS8YBCAfVza3H4x4ROo6H5/cILXs5l9sXX2xfND1pWZYbnVQvqMOnyWwGWP3VcNTf9NuAfJLAJY3e8XCn87Q8lZP6+0J6bTIAx7FxgEQCGAJAGp/xzw7rnv0oOpKixPsA4f3o0U/rHWmgFIQ0vBTfrQAii6ypNqkbtiSax9V5AMyVZQD0KdFEE6eNX7d/msxmgLqvpAGQxtUNW6IpDpd7rPqRU86TKgBcis+2wYhwbjmy3CcKAI6uC/IEMax8sksc0sQIYpywMiUsiTm5Zv1iBgDhiF7Yl2CvTTw3HvH/ANDarpJj/ziEjtMA4XRpAExlMcNrUdGFhT81ZjSAtbZMTrZs+h2mgjkZl2eiem2v80QIQM31kmVpljigkrdWAMiLHXFwtr0Ul2fiwcbxaMATm9VVpoUlEQOYK7K5pHMgioZfJzaq2NMfMwho81vBhMUiMRgFwM+LiT6uTh9Q+9lkgEgTXNOOBJtzLk9g1XMKaSIDNGh7PFvsHUJybtQAlM65lyLsO9uwPaanIpsK0qi8pIguxGpuygCIcDhd2Dtjei6y0IU4rGt5O95JyDi6JCAUNkBOjM8IJj40CMBszGx8pLRjS4X1rsKZynxCZjSAxZwE0E0tqviQI4LzSG/12j7Jl8ob3BsfLhYHIiOAKKBQOzvn3stt+NUppygPgugiI+KEFbLXAWAuoQBt2DZbykwcCH/Rre0zBtaSL1VuL1+Ug8BI9EZwNO4fHJaq0vpVCzp3Xtu+OWV1bVBwTDTvuuQ880WSuLp8US6XPCIOaRv+wznLw47Ooeq1fntjhvVmCXCHc/FECXWeSzp1Ma9f93Ov/cfJoKEYJ6wGAKISe8JBi2mhWhxJE/YfmEWPcGC05noAaH59Rjs5Dp2CajFoiM9VggajHx8Ntv/CIDg5KJL1qSHTQjUm+wEC4hcOcw3/6Rb2XsGlWeIRwOdpQCcbmufYkwLg6JKqHx2QvASgkShIkdBVJkTY1yccNYDE7L/LM48y6oH53NCm/57NpQNo+ZMHRCX58xxHZnu1OAAgZDYa4s9kBiTLYq+lYsRUPIKg19mT0fSawWgdqa47LOy9Ut++zEwDVuHsMTTvOjjD3Wk4useq1xH7T0tcoz4AYp8fRDPnU1Osf6Gn/UVePBduZ6swZK3mnSejHSSNa1967dTsSsReqakly3FsDsM7T1DxzEjrH8+aSkvMJUFTRb7k8TmO9ECpF/tD4gCED887u8+6pL+kW/6kmCpyzIvy5i4XQ9xuZfxd3SWYc3b4QoOe085djsFgMBgMBoPBYDAYDAaDwWAwGAwGg8FgMBgMBoPBYDAYDAaDwWAwGAwGg8FgMBgMBoPBYDAYVy//B7p9rpqCNPGnAAAAAElFTkSuQmCC",
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
    const listings = await Promise.all(
      getListings(listingsRequest?.listingId, listingsRequest?.page).map(
        async (page) => {
          const html = await request.get(page.url);
          const $ = load(html.text());
          const pages = $("ul.pagination-list > li");
          const currentPageIndex = pages.filter("li.selected").index();
          const items: Playlist[] = $(".items > li")
            .map((i, anime) => {
              const animeRef = $(anime);
              const url =
                animeRef.find("div > a").attr("href")?.split("-episode")[0] ??
                "";
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

    listings.splice(1, 0, {
      title: "Last Watched",
      type: DiscoverListingType.lastWatched,
      id: "last-watched",
      orientation: DiscoverListingOrientationType.landscape,
      paging: {
        id: "p",
        title: "",
        items: [],
        nextPage: undefined,
        previousPage: undefined,
      },
    });

    // @ts-ignore
    return listings;
  }

  async playlistDetails(id: string): Promise<PlaylistDetails> {
    const html = await request
      .get(`${BASENAME}/category/${id}`)
      .then((r) => r.text());
    const $ = load(html);
    const info = $(".anime_info_body_bg > .type");
    const synopsis = $(".anime_info_body_bg > .description").text();
    const yearReleased = info.get(3)?.lastChild;
    return {
      synopsis: synopsis,
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
    const epNumber = req.episodeId.match(/\d+$/)?.[0];
    const sources = await getServerSources(
      `${BASENAME}/${req.episodeId}`,
      req.sourceId,
    );

    const $ = load(
      await request
        .get(`${BASENAME}/category/${req.playlistId}`)
        .then((r) => r.text()),
    );
    const title = $("h1").text().split(" (Dub)")[0];
    const type = $(".anime_info_body_bg > .type:first-child")
      .text()
      .toLowerCase()
      .includes("movie")
      ? "movie"
      : "tv";

    let skipTimes: PlaylistEpisodeServerSkipTime[] = [];

    const jikanJson = await request
      .get(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&type=${type}`,
      )
      .then((r) => jikanSchema.parse(r.json()));
    const closestArray = jikanJson.data.map((item) =>
      levenshtein(title, item.title),
    );
    const i = closestArray.indexOf(0);
    const animeData = jikanJson.data[i];

    if (animeData && epNumber) {
      const response = await request
        .get(
          `https://api.aniskip.com/v2/skip-times/${animeData.mal_id}/${epNumber}?types=op&types=ed&types=recap&episodeLength=0`,
        )
        .catch((e) => e);
      if (response.status === 200) {
        aniskipSchema.parse(response.json()).results.forEach((time) => {
          if (time.skipType === "op") {
            skipTimes.push({
              startTime: time.interval.startTime,
              endTime: time.interval.endTime,
              type: PlaylistEpisodeServerSkipType.opening,
            });
          }
          if (time.skipType === "recap") {
            skipTimes.push({
              startTime: time.interval.startTime,
              endTime: time.interval.endTime,
              type: PlaylistEpisodeServerSkipType.recap,
            });
          }
          if (time.skipType === "ed") {
            skipTimes.push({
              startTime: time.interval.startTime,
              endTime: time.interval.endTime,
              type: PlaylistEpisodeServerSkipType.ending,
            });
          }
        });
      }
    }

    return {
      links: sources
        .map((source) => ({
          url: source.url,
          quality:
            // @ts-ignore
            PlaylistEpisodeServerQualityType[source.quality] ??
            PlaylistEpisodeServerQualityType.auto,
          format: PlaylistEpisodeServerFormatType.hsl,
        }))
        .sort((a, b) => b.quality - a.quality),
      skipTimes,
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
    const html = await request
      .get(`${BASENAME}/category/${playlistId}`)
      .then((r) => r.text());
    const html$ = load(html);
    const isDub = playlistId.endsWith("-dub");
    const title = html$(".anime_info_body_bg > h1").text();
    const titleWithoutDub = title.split(" (Dub)")[0];
    const thumbnail = html$(".anime_info_body_bg > img").attr("src");
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
            const eps = episodes("#episode_related > li");
            const video = eps
              .map((i, episode) => {
                const link =
                  episodes(episode).find("a").attr("href")?.slice(2) ?? alias!;
                const title = $(episode).find(".name").text();
                const number = parseFloat(title.split(" ")[1]);
                return {
                  id: link,
                  title,
                  number: Number.isNaN(number) ? eps.length - i : number,
                  thumbnail,
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
