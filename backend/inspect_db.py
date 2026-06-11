import asyncio
import os
import sys
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError

mongo_uri = "mongodb+srv://sessi111111_db_user:SECRETARY@cluster0.ngvmg1r.mongodb.net/?appName=Cluster0"
db_name = mongo_uri.split("/")[-1].split("?")[0]
if not db_name:
    db_name = "Cluster0"

print(f"Connecting to MongoDB URI with a 5s timeout... DB: {db_name}")
try:
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    # Trigger a connection check
    client.admin.command('ping')
    db = client[db_name]
    print("Connection successful!")
    print("Available collections:", db.list_collection_names())

    latest_log = db["scraping_logs"].find_one(sort=[("scraped_at", -1)])
    print("\n--- LATEST SCRAPING LOG ---")
    if latest_log:
        print("ID:", latest_log.get("_id"))
        print("Service:", latest_log.get("service"))
        print("Status:", latest_log.get("status"))
        print("Scraped At:", latest_log.get("scraped_at"))
        extracted = latest_log.get("extracted_data", {})
        print("api_keys_count:", extracted.get("api_keys_count"))
        print("keys_list keys/structure:")
        keys_list = extracted.get("keys_list", [])
        if keys_list:
            print(f"Number of keys: {len(keys_list)}")
            print("First key item:", keys_list[0])
        else:
            print("keys_list is empty or none")
    else:
        print("No logs found.")
except ServerSelectionTimeoutError as err:
    print("MongoDB Connection Timeout:", err)
except Exception as e:
    print("An error occurred:", e)
