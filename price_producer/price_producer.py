import time
import pandas as pd
from jproperties import Properties
import threading
import sys
import os
import numpy as np

sys.path.append(os.path.abspath('redis_connection'))
from connection import RedisConnection

configs = Properties()
with open('config/app-config.properties', 'rb') as config_file:
    configs.load(config_file)

def ingestionTask(path, stock_file_name, price_stream_name):
    try:
        stock = stock_file_name[:-13]
        print(f"\nGenerating pricing data for {stock}")
        data = pd.read_csv(path + stock_file_name)
        chunk = 500
        for i, row in data.iterrows():
            dateInUnix = int(time.mktime(time.strptime(row['DateTime'], configs.get("DATE_FORMAT").data)))
            conn.xadd(price_stream_name,
                      {"ticker": stock,
                       "datetime": row['DateTime'],
                       "dateInUnix": dateInUnix,
                       "price": row.iloc[2]})
            chunk -= 1
            if chunk == 0:
                print(str(i+1)+" pricing record generated for "+stock)
                chunk = 500
            time.sleep(1)
        if chunk > 0:
            print(str(i + 1) + " pricing record generated for " + stock)
        print(f"*** Completed *** [Trading recordset generated for {stock}]")
    except Exception as inst:
        print(type(inst))
        print("Exception occurred while generating pricing data")
        raise Exception('Exception occurred while generating pricing data. Delete the corrupted data and try again')


if __name__ == '__main__':
    conn = RedisConnection().get_connection()
    price_stream_name = configs.get("PRICE_STREAM").data
    file_names = []

    path = "files/for_pricing_data/"
    files = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]
    for file in files:
        if file.lower().endswith('.csv'):
            file_names.append(file)

    for stock_file_name in file_names:
        stock = stock_file_name.strip()
        t = threading.Thread(target=ingestionTask, args=(path, stock_file_name, price_stream_name))
        t.start()
