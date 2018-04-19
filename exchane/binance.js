'use strict'
const fetch = require('node-fetch');
const asyncForEach = require('../utils/foreach');

class Binance {
    constructor(db) {
        this.url = 'https://api.binance.com';
        this.id = 5;
        this.db = db;
    }

    async updateCurrencyInfo() {
        console.log(`Поулчение информации по валютам Binance`);
        let suffix = '/api/v1/exchangeInfo';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (resultJson.symbols) {
                
                await asyncForEach(resultJson.symbols, async (info) => {
                    let status = true;
                    if (info.status != 'TRADING') status = false;
                    await this.db.updateCurrencyInfo(this.id, info.baseAsset, status);
                })
            }
        }
        catch (err) {
            console.log(`updateCurrencyInfo: ${err.message}`);
        }
        console.log(`Поулчение информации по валютам Binance завершено`);
    }
    async updateOrder(){
        console.log(`Обновление данных с биржи Binance (${this.id})`);
        let suffix  = '/api/v3/ticker/bookTicker';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (!resultJson.code){
                await asyncForEach(resultJson, async (item) => {
                    let leftSymb = String(item.symbol).substring(0,3);
                    let rightSymb = String(item.symbol).substring(3);
                    if (rightSymb == 'BTC'){
                        let currencyId = await this.db.insertCurrency(leftSymb, this.id);
                        if (currencyId != 0) {
                            await this.db.updateOrders(this.id, currencyId, item.askPrice, item.bidPrice, item.askQty, item.bidQty);
                        }
                    }
                });
            }
            console.log(`Обновление данных с биржи Binance (${this.id}) завершено`);
        }
        catch (err) {
            console.log(`updateOrder: ${err.message}`);
        }
    }

    async updateOrderWithVolume(currencyName, currencyId){
        let suffix  = '/api/v1/depth?limit=5&symbol=';
        try{
            let resultRequest = await fetch(`${this.url}${suffix}${currencyName}BTC`);
            let resultJson = await resultRequest.json();
            if (resultJson.lastUpdateId){
                await this.db.updateOrders(this.id, currencyId, resultJson.asks[0][0], resultJson.bids[0][0],resultJson.asks[0][1], resultJson.bids[0][1]);    
                await this.db.updateOrdersList(this.id, currencyId, resultJson.asks);
            }
        }
        catch (err) {
            console.log(`updateOrderWithVolume: ${err.message}`);
        }
    }

    async updateCurrencyList(){
        console.log('Обновление данных с биржи Binance');
        
        try {
                let currencyList = await this.db.currencyList(this.id);
                await this.db.clearOrders(this.id);
                currencyList.forEach(currency => {
                    this.updateOrderWithVolume(currency.name, currency.id);
                })
        }
        catch (err) {
            console.log(`updateCurrencyList: ${err.message}`);
        }
    }

}

module.exports = Binance;