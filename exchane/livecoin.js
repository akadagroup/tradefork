'use strict'
const fetch = require('node-fetch');
const asyncForEach = require('../utils/foreach');

class Livecoin {
    constructor(db) {
        this.url = 'https://api.livecoin.net';
        this.id = 3;
        this.db = db;
    }
    async updateCurrencyInfo() {
        console.log(`Поулчение информации по валютам Livecoin`);
        let suffix = '/info/coinInfo';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (resultJson.success) {
                
                await asyncForEach(resultJson.info, async (info) => {
                    let status = true;
                    if (info.walletStatus != 'normal') status = false;
                    await this.db.updateCurrencyInfo(this.id, info.symbol, status);
                })
            }
        }
        catch (err) {
            console.log(`updateCurrencyInfo: ${err.message}`);
        }
        console.log(`Поулчение информации по валютам Livecoin завершено`);
    }

    async updateOrder() {
        console.log(`Обновление данных с биржи Livecoin (${this.id})`);
        let suffix = '/exchange/all/order_book?depth=5';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (resultJson) {
                await this.db.clearOrders(this.id);
                for (let key in resultJson) {
                    let index = String(key).indexOf('/');
                    if (index != -1) {
                        let leftSymb = String(key).substring(0, index);
                        let rightSymb = String(key).substring(index + 1);
                        if (rightSymb == 'BTC') {
                            let currencyId = await this.db.insertCurrency(leftSymb, this.id);
                            if (currencyId != 0) {
                                let value = resultJson[key];
                                if (value.asks.length != 0 && value.bids.length != 0) {
                                    await this.db.updateOrders(this.id, currencyId, value.asks[0][0], value.bids[0][0],value.asks[0][1], value.bids[0][1]);
                                    await this.db.updateOrdersList(this.id, currencyId, value.asks);
                                    
                                }
                            }
                        }
                    }

                }
            }
            
        }
        catch (err) {
            console.log(`updateOrder: ${err.message}`);
        }
        console.log(`Обновление данных с биржи Livecoin (${this.id}) завершено`);
    }

}

module.exports = Livecoin;