const asyncForEach = require('../utils/foreach');

class Db {
    constructor(db) {
        this.db = db;
    }

    async select(strSql) {
        let result = []
        try {
            result = await this.db.all(strSql);
        }
        catch (err) {
            console.log(`select: ${err.message}`);
        }
        return result;
    }

    async getCourceRub() {
        let result = { bid: 0, trade: '' };
        try {
            let tmp = await this.select(`
                                        select max(t1.bid) as bid, t3.name as trade from journ as t1
                                            inner join (select id as currencyId from currency where name='RUB') as t2 
                                                on t1.currencyId = t2.currencyId
                                            left join trade as t3 
                                                on t1.tradeId = t3.id 
                                        `);
            if (tmp.length != 0)
                result = { bid: tmp[0].bid, trade: tmp[0].trade }
        }
        catch (err) {
            console.log(`getCourceRub: ${err.message}`);
        }
        return result
    }

    async getLastId(tableName) {
        let id = 0;
        try {
            let tmp = await this.select(`SELECT id as id from ${tableName} where rowid = (select last_insert_rowid() as rowid)`);
            if (tmp.length != 0)
                id = tmp[0].id;
        }
        catch (err) {
            console.log(`getLastId: ${err.message}`);
        }
        return id;
    }

    async getCurrencyId(currencyName, create = true) {
        let id = 0;
        try {
            let tmp = await this.select(`select id as id from currency where name = "${currencyName}"`);
            if (tmp.length != 0)
                id = tmp[0].id;
            else {
                if (create) {
                    await this.insert(`insert into currency (name) values ("${currencyName}")`);
                    id = this.getCurrencyId(currencyName);
                }
            }
        }
        catch (err) {
            console.log(`getCurencyId: ${err.message}`)
        }
        return id;
    }

    async currencyList(tradeId) {
        let tmp = []
        try {
            tmp = await this.select(`
                    select t2.name as name, t1.currencyId as id from currencyTrade as t1
                        inner join currency as t2 on t1.currencyId = t2.[ID] 
                    where t1.tradeId = ${tradeId}
            `);

        }
        catch (err) {
            console.log(`currencyList: ${err.message}`)
        }
        return tmp;
    }

    async insert(strSql) {
        try {
            await this.db.run(strSql);
        }
        catch (err) {
            console.log(`insert: ${err.message}`);
        }
    }

    async existCurrencyTrade(currencyId, tradeId) {
        let result = false;
        try {
            let tmp = await this.select(`select * from currencyTrade where currencyId = ${currencyId} and tradeId = ${tradeId}`);
            result = tmp.length != 0;
        }
        catch (err) {
            console.log(`existCurrencyTrade: ${err.message}`);
        }
        return result;
    }

    async insertCurrency(currencyName, exchangeId) {
        let id = 0;
        try {
            id = await this.getCurrencyId(currencyName);
            if (id != 0) {
                let exists = await this.existCurrencyTrade(id, exchangeId);
                if (!exists)
                    await this.insert(`insert into currencyTrade (currencyId, tradeId) values (${id}, ${exchangeId})`);
            }
        }
        catch (err) {
            console.log(`insertCurrency: ${err.message}`);
        }
        return id;

    }

    async getSetting(settingName) {
        let result = 'error';
        try {
            let tmp = await this.select(`select value as value from settings where name ="${settingName}"`);
            if (tmp.length != 0)
                result = tmp[0].value;
        }
        catch (err) {
            console.log(`getSetting: ${err.message}`);
        }
        return result;
    }

    async setSetting(settingName, value) {
        let result = "OK";
        try {
            await this.insert(`insert or replace into settings (name, value) values ("${settingName}","${value}")`)
        }
        catch (err) {
            result = err.message;
            console.log(`setSetting: ${err.message}`);
        }
        return result
    }

    async updatePercent(userId, percent) {
        await this.insert(`update users set percent = ${percent} where id = ${userId}`);
        return 'OK';
    }

    async updateScope(userId, scope) {
        await this.insert(`update users set scope = ${scope} where id = ${userId}`);
        return 'OK';
    }

    async updateCurrencyState(currencyName, value) {
        let result = [];
        try {
            let currencyId = await this.getCurrencyId(currencyName, false);
            if (currencyId != 0) {
                await this.insert(`update currency set disabled = '${value}' where id = ${currencyId}`);
                result = await this.select(`select * from currency where disabled = 'true'`);
            }
        }
        catch (err) {
            console.log(`updateCurrencyState: ${err.message}`);
        }
        return result;
    }

    async disabledCurrencyList() {
        let result = [];
        try {
            result = await this.select(`select * from currency where disabled = 'true'`);
        }
        catch (err) {
            console.log(`disabledCurrencyList: ${err.message}`);
        }
        return result;
    }

    async updateCurrencyInfo(tradeId, currencyName, status) {
        try {
            let currencyId = await this.getCurrencyId(currencyName);
            await this.insert(`insert or replace into currencyTrade (tradeId, currencyId, disabled) values (${tradeId},${currencyId},'${!status}')`);
        }
        catch (err) {
            console.log(`updateCurrencyInfo: ${err.message}`);
        }
    }

    async updateOrders(tradeId, currencyId, ask, bid, askQty = 0, bidQty = 0) {
        let strSql = `insert or replace into journ (tradeId, currencyId, ask, bid, askQty, bidQty) values (${tradeId},${currencyId},${ask}, ${bid}, ${askQty}, ${bidQty})`;
        try {
            await this.insert(strSql);
        }
        catch (err) {
            console.log(`updateOrders: ${err.message}`);
        }
    }

    async updateOrdersList(tradeId, currencyId, asks) {
        try {
            await this.db.run(`delete from orders where currencyId = ${currencyId} and tradeId = ${tradeId}`);
            await asyncForEach(asks, async (element, index) => {
                let strSql = `insert into orders (currencyId, tradeId, [order], ask, qty) values (${currencyId},${tradeId},${index},${element[0]},${element[1]})`;
                await this.db.run(strSql);
            });
        }
        catch (err) {
            console.log(`updateOrdersList: ${err.message}`);
        }
    }

    async getOrders(tradeId, currencyId, percent, price) {
        let result = [];
        let realPercent = (percent + 100) / 100;
        try {
            let strSql = `
            select count([order]) as cntOrders, sum(qty) as qty,  min(ask) as minAsk, max(ask) as maxAsk
                from orders 
                where tradeId = ${tradeId} and currencyId = ${currencyId} and ask*${realPercent} < ${price}
         `
            result = await this.select(strSql);
    
        }
        catch (err) {
            console.log(`getOrders: ${err.message}`);
        }
        return result;
    }

    async getFork(percent){
        let result = [];
        let realPercent = (percent + 100) / 100;
        try {
            let sqlStr = `
            select id, currency,tradeAskId, tradeAsk,tradeBidId, tradeBid, ask, bid, askQty, max(r), ctAsk.[disabled] as ctAskDis, ctBid.[disabled] as ctBidDis from (
                select c.id as id, c.name as currency, t1.id as tradeAskId, t1.name as tradeAsk, t2.id as tradeBidId, t2.name as tradeBid, t.ask as ask, t.askQty, t.bid as bid, t.bid-t.ask as r from currency as c 
                inner join (select t1.currencyId, t1.tradeId as trade1, t2.tradeId as trade2 , t1.ask, t2.bid, t1.askQty
                from journ t1
                inner join journ t2
                on t1.ask*${realPercent} < t2.bid and t1.currencyId = t2.[currencyId]  
                ) as t
                on c.id = t.currencyId and c.[disabled] <> 'true'
                left join Trade as t1 on t.[trade1] = t1.id
                left join Trade as t2 on t.[trade2] = t2.id
                order by currency
                ) as main
                left join currencyTrade as ctAsk on id = ctAsk.currencyId and ctAsk.tradeId = tradeAskId
                left join currencyTrade as ctBid on id = ctBid.currencyId and ctBid.tradeId = tradeBidId
                where ctAskDis = 'false' and ctBidDis = 'false'
                group by currency
                order by -askQty
            `;
            result = await this.select(sqlStr);
    
        }
        catch (err) {
            console.log(`getFork: ${err.message}`);
        }
        return result;    
    }

    async clearOrders(tradeId){
        try {
            let sqlStr = `delete from [orders] where tradeId = ${tradeId}`;
            await this.select(sqlStr);
        }
        catch (err) {
            console.log(`clearOrders: ${err.message}`);
        }
    }

    async getCurrencyWakeUp(){
        let result = [];
        try {
            let sqlStr = `select currency.name as currency, trade.name as trade, currencyWakeUp.lastupdate as date from currencyWakeUp
            left join currency on currency.id = currencyWakeUp.currencyId
            left join trade on trade.id = currencyWakeUp.tradeId`;
            result = await this.select(sqlStr);

            sqlStr = `delete from currencyWakeUp`;
            await this.select(sqlStr);
        }
        catch (err) {
            console.log(`clearOrders: ${err.message}`);
        }
        return result;
    }


}

module.exports = Db;