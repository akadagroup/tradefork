'use strict'
const fetch = require('node-fetch');
const asyncForEach = require('../utils/foreach');

class Exmo {
    constructor(db) {
        this.url = 'https://api.exmo.com/v1';
        this.id = 4;
        this.db = db;
    }

    async updateOrderWithVolume(pairStr, currencyList) {
        let suffix  = '/order_book/?limit=5&pair=';
        try{
            let resultRequest = await fetch(`${this.url}${suffix}${pairStr}`);
            let resultJson = await resultRequest.json();
            if (resultJson){
                await asyncForEach(currencyList, async (currency)=>{
                    let value = resultJson[`BTC_${currency.name}`];
                    if (value)
                        await this.db.updateOrders(this.id, currency.id, value.ask[0][0], value.bid[0][0],value.ask[0][1], value.bid[0][1]);
                        await this.db.updateOrdersList(this.id, currency.id, value.ask);  
                });  
            }
        }
        catch (err) {
            console.log(`updateOrderWithVolume: ${err.message}`);
        }
    }

    async updateCurrencyList(){
        console.log('Обновление данных с биржи EXMO');
        
        try {
                let currencyList = await this.db.currencyList(this.id);
                await this.db.clearOrders(this.id);
                let pairStr = '';
                await asyncForEach(currencyList, (currency) => {
                    pairStr = pairStr+`BTC_${currency.name},`;
                });
                await this.updateOrderWithVolume(pairStr, currencyList);
        }
        catch (err) {
            console.log(`updateCurrencyList: ${err.message}`);
        }
        console.log('Окончание обновления данных с биржи EXMO');
    }

    async updateOrder(){
        console.log(`Обновление данных с биржи Exmo (${this.id})`);
        let suffix  = '/ticker';
        try {
            let resultRequest = await fetch(`${this.url}${suffix}`);
            let resultJson = await resultRequest.json();
            if (resultJson){
                for (let key in resultJson){
                    let leftSymb = String(key).substring(0,3);
                    let rightSymb = String(key).substring(4);
                    if (leftSymb == 'BTC'){
                        let currencyId = await this.db.insertCurrency(rightSymb, this.id);
                        if (currencyId != 0) {
                            let value = resultJson[key];
                            await this.db.updateOrders(this.id, currencyId, value.sell_price, value.buy_price);
                        }
                    }
                }
            }
            console.log(`Обновление данных с биржи Exmo (${this.id}) завершено`);
        }
        catch (err) {
            console.log(`updateOrder: ${err.message}`);
        }
    }

}

module.exports = Exmo;