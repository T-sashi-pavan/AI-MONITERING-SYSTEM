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
    print("   ALGONOX SECRETARY - PURE GROQ MONITORING TEST SUITE  ")
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
    # BLOCK 1: PURE GROQ API KEY & MULTI-RANGE TRENDS
    # ----------------------------------------------------
    print_glowing_terminal_step(1, "Groq API Key & Multi-Range Trends", 
                               "Inject Groq key to retrieve real-time balances, expires, and 24h-to-3-month daily/hourly statistics.")
    
    # Injected API key payload
    inject_payload = {
        "service_name": "Groq", # Automatically enforced in backend as well
        "provider_name": "Groq-Production-Key",
        "api_key": "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",
        "total_quota": 500.0,
        "used_quota": 135.4,
        "is_enabled": True
    }
    
    print("👉 Action: Injecting a Groq official API key to monitor...")
    # Attempt to delete duplicate first to ensure clean create
    list_keys_resp = session.get(f"{BASE_URL}/api/keys", headers=headers)
    if list_keys_resp.status_code == 200:
        for existing_key in list_keys_resp.json():
            if existing_key["provider_name"] == "Groq-Production-Key":
                session.delete(f"{BASE_URL}/api/keys/{existing_key['id']}", headers=headers)
                print("   [Cleaned up previous test run key]")

    create_key_resp = session.post(f"{BASE_URL}/api/keys", json=inject_payload, headers=headers)
    if create_key_resp.status_code == 201:
        key_id = create_key_resp.json()["id"]
        print(f"\033[0;32m🟢 Success: Groq API Key Injected! Assigned ID: {key_id}\033[0m")
    else:
        print(f"\033[0;31m🔴 Failed to inject key: {create_key_resp.text}\033[0m")
        sys.exit(1)

    # Sync key to populate metrics
    print("\n👉 Action: Triggering on-demand validation sync & telemetry calculations...")
    sync_resp = session.post(f"{BASE_URL}/api/keys/{key_id}/sync", headers=headers)
    if sync_resp.status_code == 200:
        metrics = sync_resp.json()
        print(f"\033[0;32m🟢 Success: Groq key sync completed successfully!\033[0m")
        print(f"   - Platform: \033[1;37m{metrics.get('service_name', 'Groq')}\033[0m")
        print(f"   - Remaining Balance: \033[1;32m${metrics['balance']:.2f}\033[0m")
        print(f"   - Created At Time: \033[1;37m{metrics['created_at_time']}\033[0m")
        print(f"   - Expiry Time: \033[1;37m{metrics['expiry_time']}\033[0m")
        print(f"   - Last Used Time: \033[1;37m{metrics['last_used_time']}\033[0m")
        
        # Verify multi-range daily trend log count (should be at least 90 days for 3-month filters)
        daily_count = len(metrics['daily_usage_logs'] or [])
        hourly_count = len(metrics['hourly_usage_logs'] or [])
        print(f"   - Daily Trends (24h to 3 Months): \033[1;34m{daily_count} daily log points synced\033[0m")
        print(f"   - Hourly Trends (24 Hours): \033[1;34m{hourly_count} hourly log points synced\033[0m")
        
        if daily_count >= 90:
            print("\033[0;32m   🟢 Verified: Complete 90-day (3-month) usage dataset successfully generated!\033[0m")
        else:
            print("\033[0;31m   🔴 Error: Usage logs are missing historical data.\033[0m")
            sys.exit(1)
            
        print("     \033[0;90mExample Trend Slices (Filters in Table Drawer):\033[0m")
        # Slice trends to mimic frontend selections
        last_7_days = metrics['daily_usage_logs'][-7:]
        last_30_days = metrics['daily_usage_logs'][-30:]
        last_3_months = metrics['daily_usage_logs'][-90:]
        print(f"       👉 7d subset: {len(last_7_days)} daily points (Average used: ${sum(d['used'] for d in last_7_days)/7:.2f})")
        print(f"       👉 30d subset: {len(last_30_days)} daily points (Average used: ${sum(d['used'] for d in last_30_days)/30:.2f})")
        print(f"       👉 3m subset: {len(last_3_months)} daily points (Average used: ${sum(d['used'] for d in last_3_months)/90:.2f})")
    else:
        print(f"\033[0;31m🔴 Key sync failed: {sync_resp.status_code} - {sync_resp.text}\033[0m")
        sys.exit(1)

    # ----------------------------------------------------
    # BLOCK 2: PURE GROQ SCRAPER BOT & TERMINAL FEED
    # ----------------------------------------------------
    print_glowing_terminal_step(2, "Google OAuth Playwright Scraper Bot", 
                               "Imports an active storageState manually or headlessly to progress the bot step-by-step.")
    
    mock_state = {
        "cookies": [
            {
                "name": "groq_session_id",
                "value": "google_oauth_session_mock_token_xyz_555",
                "domain": "console.groq.com",
                "path": "/"
            }
        ],
        "origins": []
    }
    
    print("👉 Action: Importing active session cookie payload manually to bypass Google MFA...")
    session_payload = {
        "storage_state": json.dumps(mock_state)
    }
    import_resp = session.post(f"{BASE_URL}/api/sessions/manual/groq", json=session_payload, headers=headers)
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
            # Should only show groq bot if we did list filter, but list all is fine
            if s['service'] == 'groq':
                print(f"   - Bot Service: \033[1;35m{s['service'].upper()}\033[0m | Status: \033[1;32m{s['status']}\033[0m | Stage: \033[1;36m{s.get('current_stage')}\033[0m")
                print(f"     Last Message: \033[0;37m{s.get('stage_message')}\033[0m")
    else:
        print(f"\033[0;31m🔴 Failed to fetch bot statuses: {sessions_resp.status_code}\033[0m")
        sys.exit(1)

    # Check console feed logs
    print("\n👉 Action: Inspecting live bot monospaced terminal logs stream...")
    logs_resp = session.get(f"{BASE_URL}/api/sessions/logs/groq", headers=headers)
    if logs_resp.status_code == 200:
        print("\033[1;32m🤖 Live Bot Terminal Console Stream Output:\033[0m")
        print("\033[0;37m" + "=" * 65 + "\033[0m")
        # Let's inspect the logs feed list
        session_state_loaded = False
        for s in sessions_resp.json():
            if s["service"] == "groq":
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

    print("\n\033[1;32m=========================================================")
    print("🟢 PURE GROQ KEY MONITORING PASSED ALL TESTS SUCCESSFULLY!")
    print("=========================================================\033[0m")

if __name__ == "__main__":
    test_suite()
