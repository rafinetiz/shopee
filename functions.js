const { InvalidUrlException } = require('./exception')

module.exports.generate_shopee_url = (product) => {
    const prodname = product.name.replace(/,?\s/g, '-');
    return new URL(`${prodname}-i.${product.shopid}.${product.itemid}`, 'https://shopee.co.id').toString();
}

module.exports.parse_price = (price) => {
    if (isNaN(price)) {
        return price;
    }

    const toStr = price.toString();
    const sub   = toStr.substr(0, toStr.length - 5);
    return Intl.NumberFormat('id-ID', {style: 'decimal'}).format(sub);
}

/**
* function untuk mengambil produk_id dan shop_id dari shopee url,
* jika berhasil function ini akan mengembalikan sebuah object berisi produk_id dan shop_id,
* akan melemparkan `InvalidUrlException` error jika url tidak valid
* 
* @param {string} url product url
* @return {object} 
*/
module.exports.parse_id_from_url = (url) => {
   const valid_url = new RegExp(/^https?:\/\/shopee\.co\.id\/.+-i\.(?<shopid>\d+)\.(?<productid>\d+)$/);

   if (valid_url.test(url) === false) {
       throw new InvalidUrlException;
   }

   return valid_url.exec(url).groups;
}