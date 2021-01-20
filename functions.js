const { InvalidUrlException } = require('./exception')
const { question } = require('readline-sync');

module.exports.generate_shopee_url = (product) => {
    const prodname = product.name.replace(/,?\s/g, '-');
    return new URL(`${prodname}-i.${product.shopid}.${product.itemid}`, 'https://shopee.co.id').toString();
}

/**
 * 
 * @param {number} price 
 * @return {string} formatted price
 */
module.exports.parse_price = (price, add_prefix = false) => {
    if (isNaN(price)) {
        return price;
    }

    const toStr = price.toString();
    const sub   = toStr.substr(0, toStr.length - 5);
    const formattedPrice = Intl.NumberFormat('id-ID', {style: 'decimal'}).format(sub);

    return add_prefix ? 'Rp. ' + formattedPrice : formattedPrice;
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

module.exports.cut_string = (str, max_length = 50) => {
    return str.length > max_length
        ? `${str.substr(0, max_length)}...`
        : str
}

module.exports.prompt = (message) => {
    process.stdout.write('\033[s');
    const answer = question(message);
    process.stdout.write('\033[u\033[0J');

    return answer;
}

module.exports.now = () => {
    return Math.round(Date.now() / 1000);
}