const axios = require('axios').default;
const { CookieJar } = require('tough-cookie');
const { parse_id_from_url } = require('../functions');

class Shopee {
    constructor() {
        this.cookiejar = new CookieJar;
        this.http = axios.create({
            baseURL: 'https://shopee.co.id',
            headers: {
                'Accept': 'application/json',
                'if-none-match-': '55b03-bfd0eed2065ae6115f79d399137aa6be',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36',
                'x-requested-with': 'XMLHttpRequest',
                'x-api-source': 'pc',
                'x-shopee-language': 'id',
                'Origin': 'https://shopee.co.id',
                'x-csrftoken': 'flFWydS4aweQolep1NhvAtHezfYlk6gZ'
            }
        })

        this.http.interceptors.request.use(reqconfig => {
            const base_url = reqconfig.baseURL;

            if (this.cookiejar.getCookiesSync(base_url).length > 0) {
                reqconfig.headers['Cookie'] = this.cookiejar.getCookieStringSync(base_url);
            }

            return reqconfig;
        })

        this.http.interceptors.response.use(resconfig => {
            if (resconfig.headers['set-cookie'] !== undefined) {
                resconfig.headers['set-cookie'].forEach(cookie => {
                    this.cookiejar.setCookieSync(cookie, resconfig.config.baseURL);
                })
            }

            return resconfig;
        })
    }

    async request_get(endpoint, query = {}) {
        const url = new URL(endpoint, 'https://shopee.co.id');
        for (const key in query) {
            url.searchParams.append(key, query[key]);
        }

        return this.http.get(url.toString()).then(resp => {
            return resp.data;
        });
    }

    async request_post(endpoint, options = {}) {
        return this.http.post(endpoint).then(resp => {
            return resp.data;
        });
    }

    async get_product(url) {
        const {shopid, productid} = parse_id_from_url(url);

        return this.request_get('/api/v2/item/get', {
            shopid: shopid,
            itemid: productid
        }).then(resp => {
            return resp.item;
        })
    }
}

module.exports.Shopee = Shopee;