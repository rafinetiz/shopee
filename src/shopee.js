const axios = require('axios').default;
const { CookieJar } = require('tough-cookie');
const { parse_id_from_url, now, prompt } = require('../functions');
const { CheckoutFailed, CartError } = require('../exception');

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

    async set_cookie(cookie) {
        this.cookiejar.setCookieSync(cookie, 'https://shopee.co.id');
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

    async request_post(endpoint, data, options = {}) {
        return this.http.post(endpoint, data, options).then(resp => {
            return resp.data;
        });
    }

    async get_profile() {
        return this.request_get('/api/v1/account_info', {
            need_cart: 0,
            skip_address: 0
        })
    }

    async get_product(url) {
        const {shopid, productid} = parse_id_from_url(url);

        return this.request_get('/api/v2/item/get', {
            shopid: shopid,
            itemid: productid
        }).then(resp => {
            const data = resp.item;

            return {
                name: data.name,
                itemid: data.itemid,
                shopid: data.shopid,
                models: data.models,
                price: data.price,
                price_max: data.price_max,
                preview_info: data.preview_info,
                flash_sale: data.flash_sale,
                upcoming_flash_sale: data.upcoming_flash_sale,
                refurl: url
            };
        })
    }

    async add_to_cart(product, model, quantity = 1) {
        const { modelid } = model;
        const { shopid, itemid, refurl } = product;

        return this.request_post('/api/v2/cart/add_to_cart', {
            checkout: true,
            client_source: 1,
            donot_add_quantity: false,
            itemid: itemid,
            modelid: modelid,
            shopid: shopid,
            quantity: quantity,
            source: '{"refer_urls":[]}',
            update_checkout_only: false
        }, {
            headers: {
                'Referer': refurl
            }
        }).then(resp => {
            if (resp.error !== 0) {
                switch (resp.error) {
                    case 6: // Barang habis
                        throw new CartError('BARANG HABIS');
                    default:
                        throw new CartError('FAILED TO ADD PRODUCT TO CART')
                }
            }

            return this.request_post('/api/v4/cart/get', {
                pre_selected_item_list: []
            })
        }).then(resp => {
            const cartdata = {};
            for (const cart_item of resp.data.shop_orders) {
                if (cart_item.shop.shopid == shopid) {
                    const itemdata = cart_item.items[0];
                    cartdata.add_on_deal_id = itemdata.add_on_deal_id
                    cartdata.applied_promotion_id = itemdata.applied_promotion_id
                    cartdata.is_add_on_sub_item = itemdata.is_add_on_sub_item
                    cartdata.item_group_id = itemdata.item_group_id
                    cartdata.cart_item_change_time = itemdata.cart_item_change_time
                    cartdata.quantity = itemdata.quantity
                    cartdata.price = itemdata.price
                    cartdata.offerid = itemdata.offerid
                    cartdata.itemid = itemdata.itemid
                    cartdata.modelid = itemdata.modelid
                    cartdata.status = itemdata.status
                    console.log('PROMOID',  itemdata.applied_promotion_id)
                    break;
                }
            }

            return {
                shopid: shopid,
                item: cartdata
            }
        })
    }

    async pre_checkout(cartdata, address) {
        return this.request_post('/api/v4/cart/checkout', {
            platform_vouchers: [],
            selected_shop_order_ids: [{
                shopid: cartdata.shopid,
                shop_vouchers: [],
                item_briefs: [cartdata.item]
            }]
        }).then(resp => {
            if (resp.error !== 0) {
                console.log(resp)
                throw new CheckoutFailed('checkout failed')
            }
            
            return this.request_post('/api/v2/checkout/get', {
                device_info: {
                    buyer_payment_info: {},
                    device_fingerprint: '',
                    device_id: '',
                    tongdun_blackbox: ''
                },
                promotion_data: {
                    auto_apply_shop_voucher: false,
                    check_shop_voucher_entrances: true,
                    free_shipping_voucher_info: {
                        disabled_reason: null,
                        free_shipping_voucher_code: '',
                        free_shipping_voucher_id: 0
                    },
                    platform_vouchers: [],
                    shop_vouchers: [],
                    use_coins: false
                },
                selected_payment_channel_data: {
                    channel_id: 8003001, // Indomaret,
                    channel_item_option_info: {},
                    version: 2
                },
                shoporders: [{
                    buyer_address_data: {
                        address_type: 0,
                        addressid: address.id,
                        error_status: '',
                        tax_address: ''
                    },
                    items: [cartdata.item],
                    logistics: {
                        recommended_channelids: null
                    },
                    // selected_logistic_channelid: 80014, // J&T
                    selected_preferred_delivery_time_option_id: 0,
                    selected_preferred_delivery_time_slot_id: null,
                    shipping_id: 1,
                    shop: {
                        shopid: cartdata.shopid
                    }
                }],
            })
        }).then(resp => {
            if (resp.can_checkout == false) {
                console.log(resp)
                throw new CheckoutFailed(resp.disabled_checkout_info.description)
            }

            return resp;
        })
    }

    async checkout(data) {
        return this.request_post('/api/v2/checkout/place_order', {
            ...data,
            headers: {},
            status: 200
        }).then(resp => {
            if (resp.error !== undefined) {
                throw new CheckoutFailed(resp.error_msg)
            }

            return resp;
        })
    }
}

module.exports.Shopee = Shopee;