const axios = require('axios').default;
const { CookieJar } = require('tough-cookie');
const { parse_id_from_url, now, prompt } = require('../functions');
const { CheckoutFailed } = require('../exception');

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

    async get_product(url) {
        const {shopid, productid} = parse_id_from_url(url);

        return this.request_get('/api/v2/item/get', {
            shopid: shopid,
            itemid: productid
        }).then(resp => {
            const data = resp.item;
            let add_on_id = null;
            if (data.add_on_deal_info !== null) {
                add_on_id = data.add_on_deal_info.add_on_deal_id;
            }
            return {
                name: data.name,
                add_on_deal_id: add_on_id,
                itemid: data.itemid,
                shopid: data.shopid,
                models: data.models,
                price: data.price,
                price_max: data.price_max,
                preview_info: data.preview_info,
                flash_sale: data.flash_sale,
                upcoming_flash_sale: data.upcoming_flash_sale,
                status: data.status,
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
                throw new Error(resp.data)
            }
            return resp.data.cart_item;
        })
    }

    async get_profile() {
        return this.request_get('/api/v1/account_info', {
            need_cart: 0,
            skip_address: 0
        })
    }

    async pre_checkout(product, model, itemgroupid, address) {
        let promotionid = null;

        if (product.flash_sale !== null || product.upcoming_flash_sale !== null) {
            promotionid = product.flash_sale.promotionid ?? product.upcoming_flash_sale.promotionid;
        } else {
            promotionid = model.promotionid
        }

        return this.request_post('/api/v4/cart/checkout', {
            platform_vouchers: [],
            selected_shop_order_ids: [{
                shopid: product.shopid,
                shop_vouchers: [],
                item_briefs: [{
                    add_on_deal_id: product.add_on_deal_id,
                    applied_promotion_id: promotionid,
                    cart_item_change_time: now(),
                    is_add_on_sub_item: null,
                    item_group_id: itemgroupid == 0 ? null : itemgroupid,
                    itemid: product.itemid,
                    modelid: model.modelid,
                    offerid: null,
                    price: model.price,
                    quantity: 1,
                    status: 1
                }]
            }]
        }, {
            headers: {
                'Referer': 'https://shopee.co.id/cart'
            }
        }).then(resp => {
            if (resp.error !== 0) {
                console.log(resp)
                throw new Error(resp.error_msg);
            }

            return this.request_post('/api/v2/checkout/get', {
                cart_type: 0,
                client_id: 0,
                device_info: {
                    buyer_payment_info: {},
                    device_fingerprint: '',
                    device_id: '',
                    tongdun_blackbox: ''
                },
                dropshipping_info: {
                    enabled: false,
                    phone_number: '',
                    name: ''
                },
                order_update_info: {},
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
                shipping_orders: [{
                    buyer_address_data: {
                        address_type: 0,
                        addressid: address.id,
                        error_status: '',
                        tax_address: ''
                    },
                    buyer_ic_number: '',
                    logistics: {
                        recommended_channelids: null
                    },
                    selected_logistic_channelid: 80014, // J&T
                    selected_preferred_delivery_time_option_id: 0,
                    selected_preferred_delivery_time_slot_id: null,
                    shipping_id: 1,
                    shoporder_indexes: [0],
                    sync: true
                }],
                shoporders: [{
                    buyer_address_data: {
                        address_type: 0,
                        addressid: address.id,
                        error_status: '',
                        tax_address: ''
                    },
                    items: [{
                        add_on_deal_id: 0,
                        is_add_on_sub_item: false,
                        item_group_id: 0,
                        itemid: product.itemid,
                        modelid: model.modelid,
                        quantity: 1
                    }],
                    logistics: {
                        recommended_channelids: null
                    },
                    selected_logistic_channelid: 80014, // J&T
                    selected_preferred_delivery_time_option_id: 0,
                    selected_preferred_delivery_time_slot_id: null,
                    shipping_id: 1,
                    shop: {shopid: product.shopid}
                }],
                tax_info: {
                    tax_id: ''
                },
                timestamp: now()
            }, {
                headers: {
                    'Referer': 'https://shopee.co.id/checkout'
                }
            })
        }).then(resp => {
            if (resp.error !== undefined || resp.can_checkout == false) {
                console.log(resp)
                throw new CheckoutFailed(resp.error_msg ?? resp.disabled_checkout_info.description)
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
            console.log(resp)
        })
    }
}

module.exports.Shopee = Shopee;