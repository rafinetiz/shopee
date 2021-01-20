const { Shopee } = require('./src/shopee');
const { question } = require('readline-sync');
const { sprintf } = require('sprintf-js');
const { cut_string, parse_price, prompt, wait_until_start, parse_id_from_url } = require('./functions');
(async () => {
    const shopee = new Shopee;

    /*
    ['csrftoken=flFWydS4aweQolep1NhvAtHezfYlk6gZ',
     'SPC_CLIENTID=VnhyNDkzSU1HbVg3efpwrsljhahcomib',
     'SPC_EC=IUgFzI3933f0D3sSx+k5z7xh1VBN6hZPqrfW36Nw91oQmMiLCBTe1SazlWB1YxLm1mXv9zZ9vE1Ae/94tYYnC9fdLLm4ZyflYQ0wRaJZSgKz8rkSxgtCz5V+UV7Tr48YC+7A6kqP3zVtS5h/ovgTlCSobE4xKsK+IsLlQLW5/Os=',
     'SPC_U=346619839'
    ].forEach(value => shopee.set_cookie(value))
    */

    ['csrftoken=flFWydS4aweQolep1NhvAtHezfYlk6gZ',
     'SPC_U=271661662',
     'SPC_CLIENTID=VnhyNDkzSU1HbVg3efpwrsljhahcomib',
     'SPC_EC=zCNn7CksI+7xxYQoNo7m08VHFkQnBpOeYOwj3sMZSC7hgGa+/KQCZhqlfea1ZxMskxpbXpWLJXbsnUHI7VFfTWReEEueCkirjqt7Ol5wWIuQoyS6ic5n3qiZeS9Wz1Wjap8fIhdemzb7EYXnur4o3olMKus3yNaoqlP7jguk8Oc='
    ].forEach(value => shopee.set_cookie(value))

    try {
        const producturl = prompt('PRODUCT URL: ');

        const product = await shopee.get_product(producturl);
        const model   = product.models;

        const profile = await shopee.get_profile();
        console.log(
            sprintf('LOGGED AS \033[1m%s\033[0m\n', profile.username)
        )
        console.log(
            sprintf(
                '%-7s %s\n%-7s %s%s',
                'NAME', cut_string(product.name),
                'PRICE', parse_price(product.price, true),
                product.price_max !== product.price ? ' - ' + parse_price(product.price_max, true) : '' 
            )
        )

        console.log('MODEL/VARIANT/SIZE');
        model.forEach((item, index) => {
            const { name, price } = item;

            console.log(
                sprintf(
                    '[%2d] %-14s %s', 
                    index, cut_string(name, 14), parse_price(price, true)
                )
            )
        })

        const modelindex = prompt('SELECT MODEL: ');
        const selected_model = model[modelindex];
        
        console.log(sprintf(
            'SELECTED MODEL \033[1m%s\033[0m (%s)',
            selected_model.name,
            selected_model.modelid
        ))

        if (product.preview_info !== null || product.upcoming_flash_sale !== null) {        
            console.log('WAITING UNTIL PRODUCT AVAILABLE TO PURCHASE');
            let start_time = product.preview_info
                ? product.preview_info.preview_end_time
                : product.upcoming_flash_sale
                    ? product.upcoming_flash_sale.start_time
                    : 0;

            await wait_until_start(start_time * 1000);
        }

        const cart = await shopee.add_to_cart(product, selected_model);

        const pre_checkout = await shopee.pre_checkout(product, selected_model, cart.item_group_id, profile.default_address)
        
        console.log(
            sprintf(
                '%-8s Rp. %s\n%-8s Rp. %s\n%-8s Rp. %s\n%-8s Rp. %s',
                'ITEM', parse_price(pre_checkout.checkout_price_data.merchandise_subtotal),
                'SHIPPING', parse_price(pre_checkout.checkout_price_data.shipping_subtotal),
                'TX', parse_price(pre_checkout.checkout_price_data.buyer_txn_fee),
                'TOTAL', parse_price(pre_checkout.checkout_price_data.total_payable)
            )
        )
        
        const checkout_now = prompt('Checkout now (y/n)? ');
        if (checkout_now.toLowerCase() !== 'y') {
            return;
        }

        await shopee.checkout(pre_checkout);
    } catch (err) {
        console.log(err)
        switch (err.code) {
            case 'ERRURLINVALID':
                console.log('[ERROR]', err.message);
                break;
            default:
                console.log(err.message);
                break;
        }
    }
})();