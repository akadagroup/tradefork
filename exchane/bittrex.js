'use strict'
const fetch = require('node-fetch');
const asyncForEach = require('../utils/foreach');

class Bittrex {
    constructor(db) {
        this.url = 'https://bittrex.com/api/v1.1/public';
        this.id = 1;
        this.db = db;
    }

    async updateCurrencyInfo() {
        console.log(`Поулчение информации по валютам Bittrex`);
        let suffix = '/getmarkets  ';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (resultJson.success) {

                await asyncForEach(resultJson.result, async (info) => {
                    let status = true;
                    if (info.IsActive) status = false;
                    await this.db.updateCurrencyInfo(this.id, info.symbol, status);
                })
            }
        }
        catch (err) {
            console.log(`updateCurrencyInfo: ${err.message}`);
        }
        console.log(`Поулчение информации по валютам Bittrex завершено`);
    }

    async updateOrder() {
        
        let suffix = '/getmarketsummaries';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (resultJson.success) {
                await asyncForEach(resultJson.result, async (item) => {
                    let leftSymb = String(item.MarketName).substring(0, 3);
                    let rightSymb = String(item.MarketName).substring(4);
                    if (leftSymb == 'BTC') {
                        let currencyId = await this.db.insertCurrency(rightSymb, this.id);
                        if (currencyId != 0) {
                            await this.db.updateOrders(this.id, currencyId, item.Ask, item.Bid);
                        }
                    }
                });
            }
            
        }
        catch (err) {
            console.log(`updateOrder: ${err.message}`);
        }
    }

    async updateOrderWithVolume(currencyName, currencyId, last) {
        let suffix = '/getorderbook?type=both&market=BTC-';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}${currencyName}`);
            let resultJson = await resultRequest.json();
            if (resultJson.success) {
                let value = resultJson.result;
                if (value.sell != null && value.buy != null) {
                    await this.db.updateOrders(this.id, currencyId, value.sell[0].Rate, value.buy[0].Rate, value.sell[0].Quantity, value.buy[0].Quantity);
                    let asks = [];
                    for (let index = 0; index < value.sell.length && index < 5; index++) {
                        asks.push([value.buy[0].Rate, value.buy[index].Quantity]);
                    };
                    await this.db.updateOrdersList(this.id, currencyId, asks);
                }
            }
            if (last) console.log(`Обновление данных с биржи Bittrex (${this.id}) завершено`);
        }
        catch (err) {
            console.log(`updateOrderWithVolume: ${err.message} (${currencyName})`);
        }
    }

    async updateCurrencyList() {
        console.log('Обновление данных с биржи Bittrex');

        try {
            await this.updateCurrencyInfo();
            let currencyList = await this.db.currencyList(this.id);
            await this.db.clearOrders(this.id);
            asyncForEach(currencyList, (currency, index) => {
                this.updateOrderWithVolume(currency.name, currency.id, index == currencyList.length-1);
            });
            
        }
        catch (err) {
            console.log(`updateCurrencyList: ${err.message}`);
        }
    }

}

module.exports = Bittrex;