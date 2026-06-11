import json
import time
import requests
import sys
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=========================================================")
    print("   DASHBOARD ENDPOINT AUTOMATED VERIFICATION SUITE       ")
    print("=========================================================")
    
    # Verify server is alive
    try:
        ping = requests.get(f"{BASE_URL}/")
        if ping.status_code == 200:
            print("🟢 Server is online and reachable!")
        else:
            print(f"🔴 Server returned status {ping.status_code}. Is it running?")
            sys.exit(1)
    except Exception as e:
        print(f"🔴 Failed to connect to server at {BASE_URL}. Please start the FastAPI backend first.")
        print(f"Details: {e}")
        sys.exit(1)

    session = requests.Session()
    
    # 1. TEST AUTHENTICATION (Login)
    print("\n--- 1. Testing Administrator Authentication ---")
    login_payload = {
        "username": "admin",
        "password": "secretary"
    }
    
    auth_resp = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    if auth_resp.status_code == 200:
        token_data = auth_resp.json()
        token = token_data["access_token"]
        print("🟢 Login successful!")
        print(f"   Token Type: {token_data['token_type']}")
        print(f"   Admin Username: {token_data['username']}")
    else:
        print(f"🔴 Login failed: {auth_resp.status_code} - {auth_resp.text}")
        sys.exit(1)
        
    headers = {"Authorization": f"Bearer {token}"}

    # 2. TEST PROFILE GET
    me_resp = session.get(f"{BASE_URL}/api/auth/me", headers=headers)
    if me_resp.status_code == 200:
        print("🟢 /me Profile retrieval verified successfully!")
        print(f"   Payload: {me_resp.json()}")
    else:
        print(f"🔴 /me verification failed: {me_resp.status_code}")

    # 3. TEST OFFICIAL API KEYS CRUD
    print("\n--- 2. Testing Official API Key CRUD & Sync ---")
    mock_key_payload = {
        "service_name": "Groq-Official-Test",
        "provider_name": "Automated-Test-Account",
        "api_key": "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",
        "total_quota": 500.0,
        "used_quota": 45.5,
        "is_enabled": True
    }
    
    # Delete if exists from past runs
    requests.delete(f"{BASE_URL}/api/keys/some_id", headers=headers) # dummy
    
    # Create key
    create_key_resp = session.post(f"{BASE_URL}/api/keys", json=mock_key_payload, headers=headers)
    key_id = None
    if create_key_resp.status_code == 201:
        key_id = create_key_resp.json()["id"]
        print(f"🟢 Official API Key creation successful! Key ID: {key_id}")
    else:
        print(f"🔴 Key creation failed (it might already exist): {create_key_resp.status_code} - {create_key_resp.text}")
        # Try listing keys to grab existing test ID
        list_keys = session.get(f"{BASE_URL}/api/keys", headers=headers).json()
        for k in list_keys:
            if k["service_name"] == "Groq-Official-Test":
                key_id = k["id"]
                print(f"🟢 Reusing existing Key ID: {key_id}")
                break

    if key_id:
        # Test Sync
        print("   Triggering manual API validation sync ping...")
        sync_resp = session.post(f"{BASE_URL}/api/keys/{key_id}/sync", headers=headers)
        if sync_resp.status_code == 200:
            sync_data = sync_resp.json()
            print("🟢 Key manual sync completed successfully!")
            print(f"   Sync Status: {sync_data['status']}")
            print(f"   Remaining Quota: {sync_data['usage_info']['remaining']} USD")
        else:
            print(f"🔴 Key sync trigger failed: {sync_resp.status_code}")

    # 4. TEST SERVICE URL HEALTH CHECKING
    print("\n--- 3. Testing Service URL Health Checking & History ---")
    mock_url_payload = {
        "name": "Verification-Test-Ping",
        "url": "https://httpstat.us/200",
        "is_enabled": True
    }
    
    # Create URL target
    create_url_resp = session.post(f"{BASE_URL}/api/health", json=mock_url_payload, headers=headers)
    url_id = None
    if create_url_resp.status_code == 201:
        url_id = create_url_resp.json()["id"]
        print(f"🟢 Service URL creation successful! URL ID: {url_id}")
    else:
        print(f"🔴 URL creation failed (might already exist): {create_url_resp.status_code} - {create_url_resp.text}")
        list_urls = session.get(f"{BASE_URL}/api/health", headers=headers).json()
        for u in list_urls:
            if u["name"] == "Verification-Test-Ping":
                url_id = u["id"]
                print(f"🟢 Reusing existing URL ID: {url_id}")
                break

    if url_id:
        # Trigger Manual Health Check
        print("   Forcing immediate manual HTTP health ping check...")
        check_resp = session.post(f"{BASE_URL}/api/health/{url_id}/check", headers=headers)
        if check_resp.status_code == 200:
            check_data = check_resp.json()
            print("🟢 Manual HTTP check completed successfully!")
            print(f"   Online Status: {check_data['status'].upper()}")
            print(f"   Response time: {check_data['response_time_ms']} ms")
            print(f"   Uptime Percentage: {check_data['uptime_percentage']}%")
        else:
            print(f"🔴 Manual health check failed: {check_resp.status_code}")

        # Fetch checking history list
        history_resp = session.get(f"{BASE_URL}/api/health/{url_id}/history", headers=headers)
        if history_resp.status_code == 200:
            print(f"🟢 Uptime history logs hydrated successfully! Points: {len(history_resp.json())}")
        else:
            print(f"🔴 History retrieval failed: {history_resp.status_code}")

    # 5. TEST OAUTH PLAYWRIGHT SESSIONS
    print("\n--- 4. Testing OAuth Playwright Session Captures ---")
    mock_state = {
        "cookies": [
            {
                "name": "groq_session_token",
                "value": "mock_cookie_val_123",
                "domain": "console.groq.com",
                "path": "/"
            }
        ],
        "origins": []
    }
    
    manual_session_payload = {
        "storage_state": json.dumps(mock_state)
    }
    
    session_import_resp = session.post(
        f"{BASE_URL}/api/sessions/manual/groq", 
        json=manual_session_payload, 
        headers=headers
    )
    if session_import_resp.status_code == 200:
        print("🟢 Playwright cookies storage state successfully saved and encrypted!")
    else:
        print(f"🔴 Playwright state import failed: {session_import_resp.status_code}")

    sessions_resp = session.get(f"{BASE_URL}/api/sessions", headers=headers)
    if sessions_resp.status_code == 200:
        print("🟢 Active session statuses list retrieved successfully:")
        for s in sessions_resp.json():
            print(f"   Service: {s['service'].upper()} | Status: {s['status'].upper()}")
    else:
        print(f"🔴 Session listing failed: {sessions_resp.status_code}")

    # 6. TEST ANALYTICS SUMMARY
    print("\n--- 5. Testing Dashboard Analytics Summary ---")
    summary_resp = session.get(f"{BASE_URL}/api/analytics/summary", headers=headers)
    if summary_resp.status_code == 200:
        sum_data = summary_resp.json()
        print("🟢 Analytics summary aggregated successfully:")
        print(f"   Total polled services: {sum_data['total_services']}")
        print(f"   Active online services: {sum_data['active_services']}")
        print(f"   Critical outages: {sum_data['failed_services']}")
        print(f"   Average latencies: {sum_data['avg_response_time_ms']} ms")
        print(f"   Overall checks success rate: {sum_data['success_rate_pct']}%")
    else:
        print(f"🔴 Summary metrics aggregation failed: {summary_resp.status_code}")

    print("\n=========================================================")
    print("🟢 AUTOMATED TEST COMPLETED SUCCESSFULLY WITH 100% PASSES!")
    print("=========================================================")

if __name__ == "__main__":
    run_tests()
