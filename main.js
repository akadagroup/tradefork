const Binance = require('./exchane/binance');
const Poloniex = require('./exchane/poloniex');
const Bittrex = require('./exchane/bittrex');
const Livecoin = require('./exchane/livecoin');
const Exmo = require('./exchane/exmo');
const asyncForEach = require('./utils/foreach');
//const fetch = require('node-fetch');

const Db = require('./utils/db');
const sqlite = require('sqlite-async');

const TeleBot = require('telebot');
const bot = new TeleBot('501379503:AAF2FWUEVFcKO_wrJP2FkV2OSlrxR16ZipA');



//const CryptoJS = require("crypto-js");

let db;

async function updateTraders() {

    console.log(`Запрос данных с бирж ${new Date}`)
    let db = new Db(await sqlite.open('./db/forks.db'));
    let bi = new Binance(db);
    let pl = new Poloniex(db);
    let bt = new Bittrex(db);
    let lc = new Livecoin(db);
    let ex = new Exmo(db);

    lc.updateCurrencyInfo();
    pl.updateCurrencyInfo();
    bi.updateCurrencyInfo();
    bt.updateCurrencyInfo();


    bt.updateCurrencyList();
    bi.updateCurrencyList();
    pl.updateOrder();
    lc.updateOrder();
    ex.updateCurrencyList();

}



async function getFork() {
    try {
        console.log('Отправка сообщения пользователям');
        let db = new Db(await sqlite.open('./db/forks.db'));

        let valueStr = await db.getSetting('percent');
        let rub = await db.getCourceRub();
        let percent = valueStr ? (Number(valueStr) + 100) / 100 : 1.05;


        var date = new Date();
        var sqllite_date = date.toISOString();

        console.log(sqllite_date);

        let userList = await db.select('select * from users where not disabled')

        let currencyWakeUp = await db.getCurrencyWakeUp();
        await asyncForEach(userList, async (user) => {
            let forkList = await db.getFork(user.percent);
            let resultStr = `<strong>Минимальная разница: ${user.percent}%</strong>\n`;
            let send = false;
            await asyncForEach(forkList, async (item) => {
                let orders = await db.getOrders(item.tradeAskId, item.id, percent, item.bid);

                let realPercent = 100 - (item.ask / item.bid * 100);
                let volumeQty = orders[0].qty | item.askQty;
                let countOrders = orders[0].cntOrders | 1;
                let amount = volumeQty * item.ask;
                let minAsk = orders[0].minAsk | item.ask;
                let maxAsk = orders[0].maxAsk | item.ask;
                if (amount >= user.scope) {
                    send = true;
                    resultStr = resultStr + `<b>Валюта ${item.currency}</b>\n`
                    resultStr = resultStr + `Объем продажи: <b>${volumeQty.toFixed(8)}</b> <b>(${amount.toFixed(8)} BTC)</b>\n`
                    resultStr = resultStr + `Количество ордеров: <b>${countOrders}</b>\n`
                    resultStr = resultStr + `покупаем на <b>${item.tradeAsk}</b> по ${item.ask.toFixed(8)}\n`
                    resultStr = resultStr + `продаем  на <b>${item.tradeBid}</b> по ${item.bid.toFixed(8)}\n`
                    resultStr = resultStr + `разница   на <b>${realPercent.toFixed(2)}%</b>\n\n`
                }
            });

            if (send) {
                let parseMode = 'html';
                bot.sendMessage(user.id, resultStr, {
                    parseMode
                });
            }

            if (currencyWakeUp.length != 0) {
                resultStr = `<strong>ВНИМАНИЕ! Биржа включила кошельки!</strong>\n`;
                await asyncForEach(currencyWakeUp, item => {
                    resultStr = resultStr + `<b>Валюта: ${item.currency}</b>\n`
                    resultStr = resultStr + `<b>Биржа: ${item.trade}</b>\n`
                    resultStr = resultStr + `<b>Время: ${item.date}</b>\n\n`
                });
                let parseMode = 'html';
                bot.sendMessage(user.id, resultStr, {
                    parseMode
                });
            }

        });
    } catch (err) {
        console.log(err);
    }
}

async function getInterval(db, param) {
    let interval = await db.getSetting(param);
    if (interval == 'error')
        interval = 6
    else
        interval = Number.parseInt(interval);
    return interval;
}

bot.on(/^\/enable (.+)$/, async (msg, props) => {
    const currency = props.match[1];

    let result = await db.updateCurrencyState(currency, false);
    let resStr = result.length == 0 ? 'Нет выключенных валют' : 'Выключенные валюты:\n';
    result.forEach(item => {
        resStr = resStr + `${item.Name}\n`;
    });

    return bot.sendMessage(msg.from.id, resStr);
});

bot.on(/^\/disable (.+)$/, async (msg, props) => {
    const currency = props.match[1];

    let result = await db.updateCurrencyState(currency, true);
    let resStr = result.length == 0 ? 'Нет выключенных валют' : 'Выключенные валюты:\n';
    result.forEach(item => {
        resStr = resStr + `${item.Name}\n`;
    });

    return bot.sendMessage(msg.from.id, resStr);
});

bot.on(/^\/percent (.+)$/, async (msg, props) => {
    const percent = props.match[1];
    let resStr = 'Непредвиденная ошибка.';
    let result = await db.updatePercent(msg.from.id, percent);
    if (result == 'OK') {
        resStr = `Новое значение: ${percent}%`;
    }
    console.log(resStr);
    return bot.sendMessage(msg.from.id, resStr);
});

bot.on(/^\/scope (.+)$/, async (msg, props) => {
    const scope = props.match[1];
    let resStr = 'Непредвиденная ошибка.';
    let result = await db.updateScope(msg.from.id, scope);
    if (result == 'OK') {
        resStr = `Новое значение: ${scope} BTC`;
    }
    console.log(resStr);
    return bot.sendMessage(msg.from.id, resStr);
});

bot.on(['/disabledlist'], async (msg) => {
    let resStr = 'Непредвиденная ошибка.';
    let resSQL = await db.disabledCurrencyList();
    resStr = resSQL.length == 0 ? 'Нет выключенных валют' : 'Выключенные валюты:\n';
    resSQL.forEach(item => {
        resStr = resStr + `${item.Name}\n`;
    });
    return bot.sendMessage(msg.from.id, resStr);
});

bot.on(['/help'], (msg) => {
    msg.reply.text('Я считываю ордера с бирж Bittrex и Poloniex. Ищу вилки и сообщу тебе, если такие вилки образовались.\n/help - помощь \n/enable <ИМЯ ВАЛЮТЫ> включить в список проверки\n/disable <ИМЯ ВАЛЮТЫ> - исключить из списка проверки\n/disabledlist - список исключеннх из проверки валют\n/percent <ПРОЦЕНТ> - изменить процент разницы цены\n/scope <ОБЪЕМ> объем торгов в BTC на бирже.\n/fork - обновить список вилок');
});

bot.on(['/fork'], (msg) => {
    getFork();
});

bot.on(['/start', '/hello'], (msg) => msg.reply.text('Welcome!'));

(async function start() {

    bot.start();
    db = new Db(await sqlite.open('./db/forks.db'));
    let intervalUpdate = await getInterval(db, 'interval');
    let intervalFork = await getInterval(db, 'fork');
    console.log(`Обновление биржи с интервалом ${intervalUpdate} мин`);
    updateTraders();

    setInterval(updateTraders, intervalUpdate * 60000);
    setInterval(getFork, intervalFork * 60000);


    /*
     let apiKey = '986fa49e195441868a66fa59502b2616';
     let secret = '76666a68263342f0a4c5182edb761c86';
     let nonce = new Date().getTime();
     let url = `https://bittrex.com/api/v1.1/account/getbalances?apikey=${apiKey}&nonce=${nonce}`;

     let hash = CryptoJS.HmacSHA512(url, '76666a68263342f0a4c5182edb761c86')
     fetch(url, {headers: {apisign: hash}})
         .then(result => {
             return result.json();
         })
         .then(json => {
             if (json.result){
                 json.result.forEach(x => {
                     if (x.Balance != 0)
                         console.log(`${x.Currency}: ${x.Balance}`);
                 });
             }
         });
     console.log(`url: ${url}`);
     */
})();