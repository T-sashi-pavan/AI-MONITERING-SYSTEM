import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000"

def run_golden_tests():
    print("=========================================================")
    print("   API KEYS GOLDEN DATASET VERIFICATION SUITE           ")
    print("=========================================================")

    # 0. Live Check
    try:
        ping = requests.get(f"{BASE_URL}/")
        if ping.status_code == 200:
            print("🟢 Server connection established. API is online!")
        else:
            print(f"🔴 Server returned status {ping.status_code}. Is it running?")
            sys.exit(1)
    except Exception as e:
        print(f"🔴 Could not connect to backend server at {BASE_URL}. Ensure uvicorn is running.")
        sys.exit(1)

    session = requests.Session()
    
    # 1. Authenticate to get JWT token
    login_payload = {
        "username": "admin",
        "password": "secretary"
    }
    auth_resp = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    if auth_resp.status_code == 200:
        token = auth_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("🟢 Authenticated as Admin successfully.")
    else:
        print(f"🔴 Auth failed: {auth_resp.status_code} - {auth_resp.text}")
        sys.exit(1)

    # Clean up any leftover keys from previous tests
    list_keys_resp = session.get(f"{BASE_URL}/api/keys", headers=headers)
    if list_keys_resp.status_code == 200:
        for key_item in list_keys_resp.json():
            if key_item["provider_name"].startswith("Golden-Test-"):
                session.delete(f"{BASE_URL}/api/keys/{key_item['id']}", headers=headers)
                print(f"🧹 Cleaned up existing key for {key_item['service_name']} ({key_item['provider_name']})")

    # Define test cases for all five platforms
    test_cases = [
        {
            "service": "Groq",
            "provider": "Golden-Test-Groq",
            "api_key": "gsk_mock_groq_key_12345",
            "total_quota": 500.0,
            "used_quota": 25.0,
            "expected_used": 5.0,
            "expected_rate_limits": {
                "requests_limit": "100",
                "tokens_limit": "30000",
                "requests_remaining": "99",
                "tokens_remaining": "29950"
            }
        },
        {
            "service": "OpenAI",
            "provider": "Golden-Test-OpenAI",
            "api_key": "sk-proj-dummyOpenAiKeyThatIsLongEnoughToMask",
            "total_quota": 250.0,
            "used_quota": 10.0,
            "expected_used": 1.25,
            "expected_rate_limits": {
                "requests_limit": "10000",
                "tokens_limit": "1000000",
                "requests_remaining": "9950",
                "tokens_remaining": "992450"
            }
        },
        {
            "service": "Anthropic",
            "provider": "Golden-Test-Claude",
            "api_key": "sk-ant-dummyAnthropicKeyMockValues123",
            "total_quota": 300.0,
            "used_quota": 45.0,
            "expected_used": 1.2,
            "expected_rate_limits": {
                "requests_limit": "5000",
                "tokens_limit": "400000",
                "requests_remaining": "4980",
                "tokens_remaining": "394500"
            }
        },
        {
            "service": "Gemini",
            "provider": "Golden-Test-Gemini",
            "api_key": "AIzaSyDummyGeminiKeyValuesForTest",
            "total_quota": 100.0,
            "used_quota": 0.0,
            "expected_used": 0.28,
            "expected_rate_limits": {
                "requests_limit": "360",
                "tokens_limit": "1000000",
                "requests_remaining": "359",
                "tokens_remaining": "999000"
            }
        },
        {
            "service": "ElevenLabs",
            "provider": "Golden-Test-ElevenLabs",
            "api_key": "dummyElevenLabsSpeechKeyForMockCheck",
            "total_quota": 100000.0,
            "used_quota": 0.0,
            "expected_used": 14200.0,
            "expected_rate_limits": {
                "requests_limit": "N/A",
                "tokens_limit": "100000",
                "requests_remaining": "N/A",
                "tokens_remaining": "85800"  # 100000 - 14200 (from official_api.py mock data)
            },
            "is_characters": True
        }
    ]

    print("\n--- Running Golden Dataset Sync Assertions ---")
    
    passed_runs = 0

    for tc in test_cases:
        service_name = tc["service"]
        provider_name = tc["provider"]
        api_key = tc["api_key"]
        
        print(f"\n👉 Testing sync for service: {service_name.upper()} ({provider_name})")
        
        # 1. Register Key
        register_payload = {
            "service_name": service_name,
            "provider_name": provider_name,
            "api_key": api_key,
            "total_quota": tc["total_quota"],
            "used_quota": tc["used_quota"],
            "is_enabled": True
        }
        
        reg_resp = session.post(f"{BASE_URL}/api/keys", json=register_payload, headers=headers)
        if reg_resp.status_code != 201:
            print(f"🔴 Registration failed for {service_name}: {reg_resp.text}")
            continue
            
        key_id = reg_resp.json()["id"]
        print(f"   - Key registered successfully. ID: {key_id}")
        
        # 2. Sync and Check Golden Output
        sync_resp = session.post(f"{BASE_URL}/api/keys/{key_id}/sync", headers=headers)
        if sync_resp.status_code != 200:
            print(f"🔴 Sync failed for {service_name}: {sync_resp.status_code}")
            session.delete(f"{BASE_URL}/api/keys/{key_id}", headers=headers)
            continue
            
        sync_data = sync_resp.json()
        
        # Verify status
        status = sync_data.get("status")
        if status != "active":
            print(f"🔴 Expected status 'active', got '{status}' for {service_name}")
            session.delete(f"{BASE_URL}/api/keys/{key_id}", headers=headers)
            continue
        print(f"   - Verification status: ACTIVE (as expected)")

        # Verify quota remaining / balances
        usage_info = sync_data.get("usage_info", {})
        expected_used = tc["expected_used"]
        expected_total = tc["total_quota"]
        unit = "characters" if tc.get("is_characters") else "USD"
            
        actual_used = usage_info.get("used")
        actual_total = usage_info.get("total")
        actual_rem = usage_info.get("remaining")
        expected_rem = max(0.0, expected_total - expected_used)

        if actual_used != expected_used or actual_total != expected_total:
            print(f"🔴 Quota mismatch for {service_name}: Expected used={expected_used}, total={expected_total}. Got used={actual_used}, total={actual_total}")
            session.delete(f"{BASE_URL}/api/keys/{key_id}", headers=headers)
            continue
        print(f"   - Verified Quotas: {actual_used} used / {actual_total} total {unit} (Remaining: {actual_rem})")

        # Verify rate limits
        rate_limits = sync_data.get("rate_limits", {})
        expected_rl = tc["expected_rate_limits"]
        
        rl_mismatch = False
        for k, v in expected_rl.items():
            actual_val = rate_limits.get(k)
            if actual_val != v:
                print(f"🔴 Rate Limit mismatch on '{k}' for {service_name}: Expected '{v}', got '{actual_val}'")
                rl_mismatch = True
                break
                
        if rl_mismatch:
            session.delete(f"{BASE_URL}/api/keys/{key_id}", headers=headers)
            continue
            
        print(f"   - Verified Rate Limits: {json.dumps(rate_limits)}")
        
        # 3. Cleanup key
        del_resp = session.delete(f"{BASE_URL}/api/keys/{key_id}", headers=headers)
        if del_resp.status_code == 200:
            print("   - Key successfully cleaned up.")
            passed_runs += 1
        else:
            print(f"⚠️ Failed to delete key: {del_resp.text}")

    print("\n=========================================================")
    if passed_runs == len(test_cases):
        print("🟢 ALL GOLDEN DATASET SYNC TESTS PASSED SUCCESSFULLY! (5/5)")
    else:
        print(f"🔴 TEST RUN COMPLETED WITH FAILURES. Passed {passed_runs}/{len(test_cases)} tests.")
        sys.exit(1)
    print("=========================================================")

if __name__ == "__main__":
    run_golden_tests()
