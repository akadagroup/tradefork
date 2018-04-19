'use strict'
const fetch = require('node-fetch');
const asyncForEach = require('../utils/foreach');

class Poloniex {
    constructor(db) {
        this.url = 'https://poloniex.com/public';
        this.id = 2;
        this.db = db;
    }

    async updateCurrencyInfo() {
        console.log(`Поулчение информации по валютам Poloniex`);
        let suffix = '?command=returnCurrencies';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (!resultJson.error){
                for (let key in resultJson){
                    let status = true;
                    if (resultJson[key].disabled == 1)
                        status = false;
                        await this.db.updateCurrencyInfo(this.id, key, status);
                }   
            }
        }
        catch (err) {
            console.log(`updateCurrencyInfo: ${err.message}`);
        }
        console.log(`Поулчение информации по валютам Poloniex завершено`);
    }

    async updateOrder(){
        console.log(`Обновление данных с биржи Poloniex (${this.id})`);
        let suffix  = '?command=returnOrderBook&currencyPair=all&depth=5';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (!resultJson.error){
                await this.db.clearOrders(this.id);
                for (let key in resultJson){
                    let leftSymb = String(key).substring(0,3);
                    let rightSymb = String(key).substring(4);
                    if (leftSymb == 'BTC'){
                        let currencyId = await this.db.insertCurrency(rightSymb, this.id);
                        if (currencyId != 0) {
                            let value = resultJson[key];
                            await this.db.updateOrders(this.id, currencyId, value.asks[0][0], value.bids[0][0], value.asks[0][1], value.bids[0][1]);
                            await this.db.updateOrdersList(this.id, currencyId, value.asks);
                        }
                    }
                }
            }
            console.log(`Обновление данных с биржи Poloniex (${this.id}) завершено`);
        }
        catch (err) {
            console.log(`updateOrder: ${err.message}`);
        }
    }



}

module.exports = Poloniex;