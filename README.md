# Sample Trading data model

### Data model

Here we will talk about a sample trading data model. The whole idea is what representational technique we choose to store our model
and how efficient that technique would be. Needless to mention, this decision becomes more critical when we are implementing the
trading system. Since, it is imperative to guarantee minimal response time, higher throughput and efficient data structures, we will 
use Redis Enterprise for this purpose. 
Specifically, RedisJSON as our modeling engine and RediSearch as full-text and secondary indexing engine.

1. Investor: This would typically be any type of investor, like retail, corporation etc. Let's choose a retail investor for that matter.

  Key format: `trading:investor:<investorId>`

```json
    {
      "id": "INV10001", 
      "name": "Johny M.", 
      "uid": "35178235834", 
      "pan": "AHUIOHO684" 
    }
```
    
       id -> unique identifier of the investor
       name -> Name of the investor
       uid -> Unique government id (SSN, Aadhaar etc)
       pan -> Unique taxpayer id provided by government (in India)
   
2. Account: This is the unique trading account of the investor. An investor can have multiple account against which the investment might have been made. 
  We will stick to only one account per investor in this demo
  
    Key format: `trading:account:<accountNo>`
    ```json
    {
      "id": "ACC10001",
      "investorId": "INV10001",
      "accountNo": "ACC10001",
      "accountOpenDate": "20/11/2018",
      "accountCloseDate": "NA",
      "retailInvestor": true 
    }
    ```

       id -> unique identifier of the investor
       investorId -> Investor id defined above
       accountNo -> Same as account number
       accountOpenDate -> Date on which this account was opened
       accountCloseDate -> Date on which this account was closed. 'NA' means active a/c
       retailInvestor -> 'true' means retail investor

3. Security lot: This provides the buying information of a security/stock at a particular point in time. An account may 
have multiple such lots at a given time the aggregation of which will provide the total portfolio value.

    Key format: `trading:securitylot:<accountNo>:<securityLotId>`
    ```json
    {
      "id": "SC61239693",
      "accountNo": "ACC10001", 
      "ticker": "RDBBANK",  
      "date": 1665082800, 
      "price": 14500.00, 
      "quantity": 10, 
      "type": "EQUITY"         
    }
    ```
   
       id -> unique identifier of the security lot
       accountNo -> Account number against which the lot was bought
       ticker -> Unique stock ticker code listed in stock exchange
       date -> Date on which this lot was bought
       price -> Price at which the lot was bought. This would be integer. 
                We will use lowest possible currency denomination (Cents, Paisa etc). For that we will multiply the value with 100.
       quantity -> Total quantity of the lot
       type -> Type of security. For our case, it would be 'EQUITY'
 

4. Stock: This holds the information of the security or stock listed at the stock exchange. We will hold very basic details like name, code etc

    Key format: `trading:stock:<stockId>`
```json
    {
      "id": "NSE623846333",
      "stockCode": "RDBBANK",
      "isin": "INE211111034",
      "stockName": "RDB Bank",
      "description": "Something about RDB bank",
      "dateOfListing": "08/11/1995",
      "active": true
    }
```

       id -> Unique identifier of the security stock
       stockCode -> Unique code of the stock used for trading
       stockName -> Name of the stock
       description -> Description of the stock
       active -> If the stock is available for trading
       
       
![class_trading drawio](https://user-images.githubusercontent.com/26322220/188601634-be8d8622-9d88-4973-9994-1113854cae05.png)


### Get portfolio details for an account 
In a typical trading use case, there can be and there will be multiple use cases. Where one hand we may have very trivial 
operations like fetching the investor details, getting account details etc then on the other hand we may see quite complicated queries as well like:
getting the value of the securities an investor holds at a time, getting average cost price of the stocks purchased and so on.

We will build queries for following requirement:
1. Get all the security lots by account number/id
2. Get all the security lots by account number/id and ticker
3. Get total quantity of all securities inside investor's security portfolio
4. Get total quantity of all securities inside investor's security portfolio at a particular time
5. Get average cost price of the owned stock at a given date and time. If current price of the stock is known, this can also provide the profit and loss information

#### Test the scenario
* Firstly, you need to spin-up a new Redis Enterprise cluster or Redis Stack server.
* Then, for testing above scenarios we need to create above data models like investors, account, security_lot objects. 
  Here, we will ingest considerable amount of stock-purchase data for multiple accounts pertaining to 2 stocks: RDBMOTORS and RDBFOODS. 
  For this, we will use `generator.py` file present in `data_generators` folder (used to ingest data into Redis) and execute following steps:

      source venv/bin/activate
      pip3 install -r requirements.txt
      python3 data_generators/generator.py

  This will generate thousands of trading dataset like investor and account details and security lot information. You may increase the value of '**ACCOUNT_COUNT**' parameter present in `app-config.properties` to generate more records (say millions of records).
  This will take some time depending upon the number of records you intend to generate.

* Next, since we would be leveraging RediSearch to provide full-text indexing capabilites over JSON documents, we will execute suitable RediSearch index scripts. Execute following scripts:


      FT.CREATE idx_trading_security_lot on JSON PREFIX 1 trading:securitylot: SCHEMA $.accountNo as accountNo TEXT $.ticker as ticker TAG $.price as price NUMERIC SORTABLE $.quantity as quantity NUMERIC SORTABLE $.lotValue as lotValue NUMERIC SORTABLE $.date as date NUMERIC SORTABLE
      FT.CREATE idx_trading_account on JSON PREFIX 1 trading:account: SCHEMA $.accountNo as accountNo TEXT $.retailInvestor as retailInvestor TAG $.accountOpenDate as accountOpenDate TEXT    


* Now, let's test the scenario by executing following RediSearch queries using either redis-cli or RedisInsight tool:
  1. Get all the security lots by account number/id
       * `FT.SEARCH idx_trading_security_lot '@accountNo: (ACC10001)'`
  2. Get all the security lots by account number/id and ticker
       * `FT.SEARCH idx_trading_security_lot '@accountNo: (ACC10001) @ticker:{RDBMOTORS}'` 
  3. Get total quantity of all securities inside investor's security portfolio
       * `FT.AGGREGATE idx_trading_security_lot '@accountNo: (ACC10001)' GROUPBY 1 @ticker REDUCE SUM 1 @quantity as totalQuantity`
  4. Get total quantity of all securities inside investor's security portfolio at a particular time
       * `FT.AGGREGATE idx_trading_security_lot '@accountNo:(ACC10001) @date: [0 1665082800]' GROUPBY 1 @ticker REDUCE SUM 1 @quantity as totalQuantity`
  5. Get average cost price of the owned stock at a given date and time. If current price of the stock is known, this can also provide the profit and loss information.
       * `FT.AGGREGATE idx_trading_security_lot '@accountNo:(ACC10001) @date:[0 1665498506]' groupby 1 @ticker reduce sum 1 @lotValue as totalLotValue reduce sum 1 @quantity as totalQuantity apply '(@totalLotValue/(@totalQuantity*100))' as avgPrice`
  6. Get total portfolio value across all the stocks owned by a given account number.
       * `FT.AGGREGATE idx_trading_security_lot '@accountNo:(ACC1000)' groupby 1 @ticker reduce sum 1 @lotValue as totalLotValue apply '(@totalLotValue/100)' as portfolioFolioValue`

******************************************************

### Dynamic pricing and storage
Stock pricing data is very dynamic and changes a lot during while trade is active. To address this problem we will use 
RedisTimeSeries to store the historical and the current stock prices.

This repo contains the actual intra-day prices for few stocks like RDBBANK, RDBMOTORS (name changed) taken from https://www.nseindia.com/
in [files/RDBBANK_intraday.csv](https://github.com/bestarch/sample_trading_data_model/blob/main/files/RDBBANK_intraday.csv) 
and [files/RDBMOTORS_intraday.csv](https://github.com/bestarch/sample_trading_data_model/blob/main/files/RDBMOTORS_intraday.csv)

**Pricing data ingestion**

* Using [price_producer.py](https://github.com/bestarch/sample_trading_data_model/blob/main/price_producer.py) we will ingest the intra-day price changes for these securities into Redis Enterprise.
* The script will push these changes into Redis Streams in a common stream `price_update_stream`.
    
       XADD STREAMS * price_update_stream {"ticker":"RDBBANK", "datetime": "02/09/2022 9:00:07 AM", "price": 1440.0}


**Processing of pricing data**

These dynamic pricing data will be consumed asynchronously by a Streams consumer. The code for streams consumer is present
in '/demo' folder and written using Java, Spring etc.

The docker image for the consumer is: `abhishekcoder/demo.streams.consumer`

This consumer performs following responsibilities:

      1. Consuming the pricing data, remodeling it and disaggregating it based on the stock ticker
      2. Pushes these pricing info to RedisTimeSeries database in the following key format --> `'price_history_ts:<STOCK_TICKER>'`
      3. Push the latest pricing info into a Pub-Sub channel so that the active clients/investors who have subscribed can get the latest pricing notifications


Following diagram shows how data flows in and out of the system and how different pieces stitch 
together to provide the complete picture. 

![trading drawio](https://user-images.githubusercontent.com/26322220/188598080-7bdf315f-09f5-4b5c-85c6-54a3b80865ee.png)


### Tracking stock prices

Above consumer will create Time series key for tracking price for a security:

    TS.CREATE price_history_ts:RDBBANK ticker rdbbank DUPLICATE_POLICY LAST

The consumer will update the pricing info in the timeseries db whenever it arrives:

    TS.ADD price_history_ts:RDBBANK 1352332800 635.5

Now, since the RedisTimeSeries database contains all the pricing data for a particular security, we can write some RedisTimeSeries
queries to get the pricing trend, current price, aggregation of the price overtime. We can also use downsampling feature to 
get the trend by days, weeks, months, years etc.

#### Get latest price for a ticker

    TS.GET price_history_ts:RDBBANK

#### Get the price info between two dates/times for a ticker
    
    TS.RANGE price_history_ts:RDBBANK 1352332800 1392602800

#### Create rule for daily average price for a particular security

    TS.CREATERULE price_history_ts:RDBBANK price_history_ts:RDBBANK_AGGR AGGREGATION avg 86400000



## Steps in sequence
Execute following steps to run this demo:

1. To test our investors, account, security_lot data models, we need to add some test data. For that purpose,
   let's execute `generator.py` present in `data_generators` folder (used to ingest data into Redis). This will add some test intra-day data for RDBBANK and RDBMOTORS securities.

2. Next we will execute following RediSearch indexes before actually running any queries:

````
    FT.CREATE idx_trading_security_lot on JSON PREFIX 1 trading:securitylot: SCHEMA $.accountNo as accountNo TEXT $.ticker as ticker TAG $.price as price NUMERIC SORTABLE $.quantity as quantity NUMERIC SORTABLE $.lotValue as lotValue NUMERIC SORTABLE $.date as date NUMERIC SORTABLE
    FT.CREATE idx_trading_account on JSON PREFIX 1 trading:account: SCHEMA $.accountNo as accountNo TEXT $.retailInvestor as retailInvestor TAG $.accountOpenDate as accountOpenDate TEXT    
````

3. Now, we can execute the queries to test our data model. The first part of this exercise/demo is complete:
   1. Get all the security lots by account number/id
        * `FT.SEARCH idx_trading_security_lot '@accountNo: (ACC10001)' `
   2. Get all the security lots by account number/id and ticker
        * `FT.SEARCH idx_trading_security_lot '@accountNo: (ACC10001) @ticker:{RDBBANK}'` 
   3. Get total quantity of all securities inside investor's security portfolio
        * `FT.AGGREGATE idx_trading_security_lot '@accountNo: (ACC10001)' GROUPBY 1 @ticker REDUCE SUM 1 @quantity as totalQuantity`
   4. Get total quantity of all securities inside investor's security portfolio at a particular time
        * `FT.AGGREGATE idx_trading_security_lot '@accountNo:(ACC10001) @date: [0 1665082800]' GROUPBY 1 @ticker REDUCE SUM 1 @quantity as totalQuantity`
   5. Get average cost price of the owned stock at a given date and time. If current price of the stock is known, this can also provide the profit and loss information.
        * `FT.AGGREGATE idx_trading_security_lot '@accountNo:(ACC10001) @date:[0 1665498506]' groupby 1 @ticker reduce sum 1 @lotValue as totalLotValue reduce sum 1 @quantity as totalQuantity apply '(@totalLotValue/(@totalQuantity*100))' as avgPrice`

4. For the second part, we will test the dynamic pricing and storage use case of securities. 
   For that start the Redis Streams consumer using following docker command. (You may also execute directly via any IDE like STs,IntelliJ etc).
      If successfully started, this will wait for any pricing signals.


        docker run -p 127.0.0.1:8080:8080 -e SPRING_REDIS_HOST=<HOST> -e SPRING_REDIS_PORT=<PORT> -e SPRING_REDIS_PASSWORD=<PASSOWRD>> abhishekcoder/demo.streams.consumer:latest
5. Next, push the pricing changes into the Redis Streams. For this run the `price_producer.py`.
   use this:


     source venv/bin/activate
     pip3 install -r requirements.txt
     python3 price_producer.py

   If successfully started, it will start pushing the ticker prices into the Redis Streams.
6. You may notice, the stream consumer we started in step 1 will begin to process the messages and will push them 
   to RedisTimeSeries database.
7. Execute following command to get the latest price:


        TS.GET price_history_ts:RDBBANK

8. Now since the historic prices are populated in timeseries database, we can get the price info between two dates/times for a ticker


        TS.RANGE price_history_ts:RDBBANK 1352332800 1392602800
9. To visualise this on browser, run the `server.py` script included in this repo. When successfully executed, open 
[http://localhost:5555](http://localhost:5555) and observe the data in action. 
You will see the current price, day low, day high and the intra-day trend.

![image](https://user-images.githubusercontent.com/26322220/232309062-e81a7354-1733-4609-a94e-8a3ebe7a363c.png)


## Dynamic security pricing using docker
The individual apps like price_producer, consumer and UI server has been dockerised and present in docker hub.
This gives us an easy way to bootstrap all the apps and test the results quickly. 
Deploy Redis Enterprise cluster. Note down its URL, port, password and execute following containers in order:

`docker run -e HOST=<HOST> -e PORT=<PORT> -e PASSWORD=<PASSWORD> abhishekcoder/sample_trading_data_model:price_producer`

`docker run -p 127.0.0.1:5555:5555 -e HOST=<HOST> -e PORT=<PORT> -e PASSWORD=<PASSWORD> abhishekcoder/sample_trading_data_model:server`

`docker run -e SPRING_REDIS_HOST=<HOST> -e SPRING_REDIS_PORT=<PORT> -e SPRING_REDIS_PASSWORD=<PASSWORD> abhishekcoder/demo.streams.consumer:latest`

Open http://localhost:5555 and check the result

## Dynamic security pricing using docker-compose
We can execute the entire application stack using docker-compose. 
The `docker-compose.yaml` file is present in the application directory.
Just change the desired variables in `docker-compose-redis-variables.env` file and execute the following command. 
Wait for a minute and 
open http://localhost:5555 to check the result.

`docker compose up`

To shutdown the applications, execute this command:

`docker compose down`


