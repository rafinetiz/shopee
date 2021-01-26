const { Shopee } = require('./src/shopee');
const { sprintf } = require('sprintf-js');
const { cut_string, parse_price, prompt, wait_until_start } = require('./functions');

(async () => {
    try {
        const argv = process.argv.slice(2);
    
        if (argv.length < 1) {
            console.log('usage: index.js <user>');
            process.exit(1)
        }

        const shopee = new Shopee(argv[0]);
        const profile = await shopee.get_profile();
        console.log(
            sprintf('LOGGED AS \033[1m%s\033[0m\n', profile.username)
        )

        const producturl = prompt('PRODUCT URL: ');
        const product = await shopee.get_product(producturl);
        const model   = product.models;

        console.log(
            sprintf(
                '%-7s %s\n%-7s %s%s',
                'NAME', cut_string(product.name),
                'PRICE', parse_price(product.price, true),
                product.price_max !== product.price ? ' - ' + parse_price(product.price_max, true) : '' 
            )
        )

        console.log(sprintf(
            '%-4s %-20s %-5s %s',
            'ID', 'MODEL/VARIANT/SIZE', 'STOCK', 'PRICE'
        ));

        model.forEach((item, index) => {
            const { name, price, stock } = item;

            console.log(
                sprintf(
                    '[%2d] %-20s %-5d %s', 
                    index, cut_string(name, 14), stock, parse_price(price, true)
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
            let start_time = product.preview_info
                ? product.preview_info.preview_end_time
                : product.upcoming_flash_sale
                    ? product.upcoming_flash_sale.start_time
                    : 0; // Although this value will never reached // need better logic XD

            await wait_until_start(start_time);
        }

        const cart = await shopee.add_to_cart(product, selected_model);
        const pre_checkout = await shopee.pre_checkout(cart, profile.default_address)
        console.log('\nCHECKOUT SUMMARY')
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
            console.log('CANCELED BY USER!')
            return;
        }

        const checkout = await shopee.checkout(pre_checkout);
        console.log(
            sprintf(
                '\n\033[30mCHECKOUT SUCCESS\033[0m\nPLEASE OPEN THIS LINK TO CONTINUE FOR PAYMENT\n%s',
                checkout.redirect_url
            )
        )
    } catch (err) {
        switch (err.code) {
            case 'ERRURLINVALID':
                console.log('error:\033[31m', err.message);
                break;
            case 'ERRCHECKOUTFAILED':
                console.log('checkout failed:\033[31m', err.message)
                break;
            case 'ERRCART':
                console.log('add_to_cart error:\033[31m', err.message)
                break;
            default: 
                console.log('error:\033[31m', err.message)
                console.log(err.request)
                break;
        }

        process.stdout.write('\033[0m')
    }
})();