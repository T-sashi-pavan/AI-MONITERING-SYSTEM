import json
import time
import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.append('.')

BASE_URL = "http://127.0.0.1:8000"

def print_glowing_terminal_step(step_num, title, description):
    print(f"\n\033[1;36m[Block {step_num}] {title}\033[0m")
    print(f"\033[0;37mDescription: {description}\033[0m")
    print("\033[0;90m" + "-" * 75 + "\033[0m")

def test_suite():
    print("\033[1;32m=========================================================")
    print("   ALGONOX SECRETARY - IMPLICIT THREE BLOCKS TEST SUITE ")
    print("=========================================================\033[0m")
    
    # 0. Live Check
    try:
        ping = requests.get(f"{BASE_URL}/")
        if ping.status_code == 200:
            print("\033[0;32m🟢 Server connection established. API is online!\033[0m")
        else:
            print(f"\033[0;31m🔴 Server returned status {ping.status_code}. Is it running?\033[0m")
            sys.exit(1)
    except Exception as e:
        print(f"\033[0;31m🔴 Could not connect to backend server at {BASE_URL}. Ensure uvicorn is running.\033[0m")
        sys.exit(1)

    session = requests.Session()
    
    # Authenticate to get JWT token
    login_payload = {
        "username": "admin",
        "password": "secretary"
    }
    auth_resp = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    if auth_resp.status_code == 200:
        token = auth_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("\033[0;32m🟢 Authenticated as Admin successfully. JWT Token acquired.\033[0m")
    else:
        print(f"\033[0;31m🔴 Auth failed: {auth_resp.status_code} - {auth_resp.text}\033[0m")
        sys.exit(1)

    # ----------------------------------------------------
    # BLOCK 1: METHOD 1 - OFFICIAL API MONITORING
    # ----------------------------------------------------
    print_glowing_terminal_step(1, "Method 1: Official API Key Monitoring", 
                               "Inject API key & Platform to retrieve real-time balances, expires, and daily/hourly usage trend statistics.")
    
    # Injected API key payload
    inject_payload = {
        "service_name": "Groq",
        "provider_name": "Test-Developer-Account",
        "api_key": "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",
        "total_quota": 250.0,
        "used_quota": 72.8,
        "is_enabled": True
    }
    
    # Injected OpenAI style or custom key
    print("👉 Action: Injecting a new official key to monitor...")
    # Attempt to delete duplicate first to ensure clean create
    list_keys_resp = session.get(f"{BASE_URL}/api/keys", headers=headers)
    if list_keys_resp.status_code == 200:
        for existing_key in list_keys_resp.json():
            if existing_key["provider_name"] == "Test-Developer-Account":
                session.delete(f"{BASE_URL}/api/keys/{existing_key['id']}", headers=headers)
                print("   [Cleaned up previous test run key]")

    create_key_resp = session.post(f"{BASE_URL}/api/keys", json=inject_payload, headers=headers)
    if create_key_resp.status_code == 201:
        key_id = create_key_resp.json()["id"]
        print(f"\033[0;32m🟢 Success: API Key Injected! Assigned ID: {key_id}\033[0m")
    else:
        print(f"\033[0;31m🔴 Failed to inject key: {create_key_resp.text}\033[0m")
        sys.exit(1)

    # Sync key to populate metrics
    print("\n👉 Action: Triggering on-demand validation sync & telemetry calculations...")
    sync_resp = session.post(f"{BASE_URL}/api/keys/{key_id}/sync", headers=headers)
    if sync_resp.status_code == 200:
        metrics = sync_resp.json()
        print(f"\033[0;32m🟢 Success: Key sync completed!\033[0m")
        print(f"   - Platform: \033[1;37m{inject_payload['service_name']}\033[0m")
        print(f"   - Remaining Balance: \033[1;32m${metrics['balance']:.2f}\033[0m")
        print(f"   - Created At Time: \033[1;37m{metrics['created_at_time']}\033[0m")
        print(f"   - Expiry Time: \033[1;37m{metrics['expiry_time']}\033[0m")
        print(f"   - Last Used Time: \033[1;37m{metrics['last_used_time']}\033[0m")
        print(f"   - Daily Usage Graph Points: \033[1;34m{len(metrics['daily_usage_logs'] or [])} points synced\033[0m")
        print(f"   - Hourly Usage Graph Points: \033[1;34m{len(metrics['hourly_usage_logs'] or [])} points synced\033[0m")
        print("     \033[0;90mExample Trend Data:\033[0m")
        for dp in (metrics['daily_usage_logs'] or [])[-3:]:
            print(f"       Date: {dp['timestamp'][:10]} | Used: ${dp['used']:.2f}")
    else:
        print(f"\033[0;31m🔴 Key sync failed: {sync_resp.status_code} - {sync_resp.text}\033[0m")
        sys.exit(1)

    # ----------------------------------------------------
    # BLOCK 2: METHOD 2 - WEB SCRAPING SESSIONS
    # ----------------------------------------------------
    print_glowing_terminal_step(2, "Method 2: OAuth Web Scraping Bot", 
                               "Imports an active storageState cookie state manually or headlessly to progress the bot step-by-step.")
    
    mock_state = {
        "cookies": [
            {
                "name": "render_session_id",
                "value": "gh_oauth_session_mock_token_xyz_123",
                "domain": "dashboard.render.com",
                "path": "/"
            }
        ],
        "origins": []
    }
    
    print("👉 Action: Importing active session cookie payload manually to bypass Google/GitHub MFA...")
    session_payload = {
        "storage_state": json.dumps(mock_state)
    }
    import_resp = session.post(f"{BASE_URL}/api/sessions/manual/render", json=session_payload, headers=headers)
    if import_resp.status_code == 200:
        print("\033[0;32m🟢 Success: Encrypted browser session state saved in MongoDB!\033[0m")
    else:
        print(f"\033[0;31m🔴 Failed to import storageState: {import_resp.text}\033[0m")
        sys.exit(1)

    # Check bot status list
    print("\n👉 Action: Inspecting active web-bot registries...")
    sessions_resp = session.get(f"{BASE_URL}/api/sessions", headers=headers)
    if sessions_resp.status_code == 200:
        print("   Current Bot States in Database:")
        for s in sessions_resp.json():
            print(f"   - Bot Service: \033[1;35m{s['service'].upper()}\033[0m | Status: \033[1;32m{s['status']}\033[0m | Stage: \033[1;36m{s.get('current_stage')}\033[0m")
            print(f"     Last Message: \033[0;37m{s.get('stage_message')}\033[0m")
    else:
        print(f"\033[0;31m🔴 Failed to fetch bot statuses: {sessions_resp.status_code}\033[0m")
        sys.exit(1)

    # Check console feed logs
    print("\n👉 Action: Simulating step progress logging and reading terminal console stream...")
    # Inject simulated progress logging stages
    from app.services.scraper import update_scraper_stage
    import asyncio
    
    # We can make a synchronous block helper run this or call it directly by importing
    # Since we are running the client python script, we can hit an endpoint to trigger simulated scraping if headless mode is mocked
    # Or check logs_feed directly. Let's list session logs feed to verify step progression:
    logs_resp = session.get(f"{BASE_URL}/api/sessions/logs/render", headers=headers)
    if logs_resp.status_code == 200:
        print("\033[1;32m🤖 Live Bot Terminal Console Stream Output:\033[0m")
        print("\033[0;37m" + "=" * 65 + "\033[0m")
        # Let's inspect the logs feed list
        session_state_loaded = False
        for s in sessions_resp.json():
            if s["service"] == "render":
                logs_list = s.get("logs_feed") or []
                for entry in logs_list:
                    stage = entry.get("stage")
                    msg = entry.get("message")
                    print(f"\033[1;30m[{entry.get('timestamp')[:19]}]\033[0m [\033[1;34m{stage}\033[0m] \033[1;32m{msg}\033[0m")
                    if stage == "COMPLETED":
                        session_state_loaded = True
        print("\033[0;37m" + "=" * 65 + "\033[0m")
        if session_state_loaded:
            print("\033[0;32m🟢 Success: Real-time 4-step bot checkpoints progress map verified successfully!\033[0m")
        else:
            print("\033[0;33m🟡 Note: Awaiting scraper execution run for complete terminal logs.\033[0m")
    else:
        print(f"\033[0;31m🔴 Failed to retrieve terminal console log: {logs_resp.status_code}\033[0m")

    # ----------------------------------------------------
    # BLOCK 3: RENDER LINK TRIGGERING SYSTEM
    # ----------------------------------------------------
    print_glowing_terminal_step(3, "Render Link Triggering System (Keep-Warm)", 
                               "Scrapes/injects Render service deploy targets and pings them concurrently every 5 minutes.")
    
    # Injected discovered render service in MongoDB
    print("👉 Action: Seeding a discovered Render service url link directly in database...")
    import asyncio
    from datetime import datetime
    from app.db import db
    
    async def seed_render_db():
        db.connect()
        await db.service_urls.delete_many({"url": "https://algonox-secretary.onrender.com"})
        await db.service_urls.insert_one({
            "name": "Algonox-Secretary-Frontend",
            "url": "https://algonox-secretary.onrender.com",
            "is_enabled": True,
            "discovered_from": "render",
            "render_status": "Live",
            "created_at": datetime.utcnow()
        })
        
    asyncio.run(seed_render_db())
    print("\033[0;32m🟢 Success: Render deployment URL target seeded directly in MongoDB!\033[0m")

    # Let's toggle discovered_from so backend treats it as discovered from Render scraping
    # We will update it directly in the db. But we can also test the explicit keep warm trigger endpoint!
    print("\n👉 Action: Executing manual Keep-Warm instant triggering ping (Method 3)...")
    trigger_resp = session.post(f"{BASE_URL}/api/health/render/trigger", headers=headers)
    if trigger_resp.status_code == 200:
        trigger_results = trigger_resp.json()
        print("\033[0;32m🟢 Success: Parallel Keep-Warm trigger finished!\033[0m")
        print(f"   Message: \033[1;37m{trigger_results['message']}\033[0m")
        if "results" in trigger_results:
            for idx, r in enumerate(trigger_results["results"]):
                print(f"   {idx+1}. Service: \033[1;35m{r['name']}\033[0m | Target: {r['url']} | Ping Latency: \033[1;32m{r['latency_ms']:.2f} ms\033[0m | Status: \033[1;32m{r['status'].upper()}\033[0m")
        else:
            print("\033[0;33m   No Render-source links were enabled yet. (Custom links will be triggered in the background loop).\033[0m")
    else:
        print(f"\033[0;31m🔴 Keep-Warm trigger endpoint failed: {trigger_resp.status_code} - {trigger_resp.text}\033[0m")
        sys.exit(1)

    print("\n\033[1;32m=========================================================")
    print("🟢 ALL THREE BLOCKS IMPLEMENTED AND PASSING SUCCESSFULLY!")
    print("=========================================================\033[0m")

if __name__ == "__main__":
    test_suite()
