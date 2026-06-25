import asyncio
import logging
from datetime import datetime
from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from app.config import settings
from app.db import db
from app.auth_automation.google_auth import log_auth

logger = logging.getLogger("dashboard.auth.github")

async def is_service_logged_in(service: str, page: Page, github_page: Page) -> bool:
    """Helper to check if the user is already logged in to Render/GitHub."""
    cur_url = page.url.lower()
    g_url = github_page.url.lower()
    
    if service == "render":
        if ("dashboard.render.com" in cur_url and "login" not in cur_url and "register" not in cur_url and "select-workspace" not in cur_url) or \
           ("dashboard.render.com" in g_url and "login" not in g_url and "register" not in g_url and "select-workspace" not in g_url):
            return True

        # Check cookies
        try:
            cookies = await page.context.cookies()
            if any(c.get("name") in ["stytch_session", "stytch_session_jwt"] for c in cookies):
                return True
        except Exception:
            pass

        # Check dashboard selectors
        dashboard_selectors = [
            "button:has-text('Log out')",
            "button:has-text('Logout')",
            "a[href*='logout']",
            "a[href='/logout']",
            "[aria-label='Account Menu']",
            "img[alt*='avatar']"
        ]
        for sel in dashboard_selectors:
            try:
                if await page.locator(sel).first.is_visible() or await github_page.locator(sel).first.is_visible():
                    return True
            except Exception:
                continue

    return False

async def authenticate_github(service: str, page: Page) -> bool:
    """
    Automates GitHub OAuth login for the specified service (typically render).
    """
    service = service.lower()
    email = settings.GITHUB_EMAIL
    password = settings.GITHUB_PASSWORD

    if not email or not password:
        await log_auth(service, f"[AUTH] Login failed. Reason: Missing GITHUB_EMAIL or GITHUB_PASSWORD in config.", "FAILED")
        return False

    try:
        # 1. Opening login page
        await log_auth(service, "[AUTH] Opening login page...")
        if service == "render":
            await page.goto("https://dashboard.render.com/login", wait_until="domcontentloaded", timeout=30000)
        else:
            await page.goto("https://dashboard.render.com/login", wait_until="domcontentloaded", timeout=30000)

        await log_auth(service, "[AUTH] Login page loaded.")
        await log_auth(service, "")
        await asyncio.sleep(2.0)

        # 2. Clicking Continue with GitHub
        await log_auth(service, "[AUTH] Clicking Continue with GitHub...")
        await log_auth(service, "")
        github_btn = None
        
        btn_selectors = [
            "a[href*='github']",
            "button:has-text('GitHub')",
            "a:has-text('GitHub')",
            "[role='button']:has-text('GitHub')",
            "text=GitHub"
        ]
        
        for selector in btn_selectors:
            try:
                locator = page.locator(selector).first
                if await locator.is_visible() and await locator.is_enabled():
                    github_btn = locator
                    break
            except Exception:
                continue

        if not github_btn:
            github_btn = page.locator("a[href*='github']").first

        # Detect and handle popup if GitHub opens a popup window
        github_page = page
        try:
            async with page.context.expect_event("popup", timeout=4000) as popup_info:
                await github_btn.click()
            github_page = await popup_info.value
            await github_page.wait_for_load_state("domcontentloaded", timeout=10000)
        except Exception:
            # No popup, clicked on main page
            pass

        # Check if already logged in (redirected immediately)
        if await is_service_logged_in(service, page, github_page):
            await log_auth(service, "[AUTH] Existing session detected. Login skipped.")
            await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
            return True

        # 3. GitHub login page detected
        await log_auth(service, "[AUTH] GitHub login page detected.")
        await log_auth(service, "")

        # 4. Enter email or check for authorize button
        email_selector = "#login_field, input[name='login']"
        authorize_selector = "button[name='authorize'], button:has-text('Authorize')"

        try:
            await github_page.wait_for_selector(f"{email_selector}, {authorize_selector}", timeout=20000)
        except Exception as wait_err:
            if await is_service_logged_in(service, page, github_page):
                await log_auth(service, "[AUTH] Existing session detected. Login skipped.")
                await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
                return True
            raise wait_err

        # Check if Authorize button is visible
        authorize_btn = github_page.locator(authorize_selector).first
        if await authorize_btn.is_visible():
            await log_auth(service, "[AUTH] Authorize Render button detected. Clicking...")
            await authorize_btn.click()
            await asyncio.sleep(3.0)
            
            # Post-authorization check
            if await is_service_logged_in(service, page, github_page):
                await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
                return True
        else:
            await github_page.fill(email_selector, email)
            await log_auth(service, "[AUTH] Email entered.")
            await log_auth(service, "")

            # 5. Enter password
            await github_page.wait_for_selector("#password, input[name='password']", timeout=20000)
            await github_page.fill("#password, input[name='password']", password)
            await log_auth(service, "[AUTH] Password entered.")
            await log_auth(service, "")

            # 6. Clicking Sign In
            await log_auth(service, "[AUTH] Sign In clicked.")
            await log_auth(service, "")
            submit_btn = github_page.locator("input[type='submit'][value='Sign in'], input[type='submit'][name='commit'], button:has-text('Sign in')").first
            await submit_btn.click()
            await asyncio.sleep(4.0)

            # Check if Authorize page is shown after entering credentials
            try:
                auth_btn = github_page.locator(authorize_selector).first
                if await auth_btn.is_visible():
                    await log_auth(service, "[AUTH] Authorize Render button detected. Clicking...")
                    await auth_btn.click()
                    await asyncio.sleep(3.0)
            except Exception:
                pass

        # 7. MFA / Device Verification Handling
        mfa_detected = False
        mfa_selectors = [
            "text=Two-factor authentication",
            "text=Device verification",
            "text=two-factor",
            "text=MFA",
            "text=verification code",
            "text=verify device",
            "#otp"
        ]

        current_url = github_page.url
        if "two-factor" in current_url or "sessions/two-factor" in current_url or "verified-device" in current_url:
            mfa_detected = True
        else:
            for selector in mfa_selectors:
                try:
                    if await github_page.locator(selector).first.is_visible():
                        mfa_detected = True
                        break
                except Exception:
                    continue

        if mfa_detected:
            await log_auth(service, "[AUTH] Verification required.")
            await log_auth(service, "")
            await log_auth(service, "[AUTH] Waiting for user verification...")
            await log_auth(service, "")
            
            success = False
            for i in range(20, 0, -1):
                # Count down and log
                await log_auth(service, str(i))
                await asyncio.sleep(1.0)
                
                # Check if redirect back to Render is successful
                cur_url = page.url
                github_url = github_page.url
                logged_in = False
                if service == "render" and (("dashboard.render.com" in cur_url and "login" not in cur_url) or ("dashboard.render.com" in github_url and "login" not in github_url)):
                    logged_in = True
                
                # Verify session cookie present
                try:
                    cookies = await page.context.cookies()
                    if service == "render" and any(c.get("name") in ["stytch_session", "stytch_session_jwt"] for c in cookies):
                        logged_in = True
                except Exception:
                    pass

                if logged_in:
                    success = True
                    break
                    
                # Secondary validation check: dashboard loaded / logout button exists
                try:
                    dashboard_selectors = [
                        "button:has-text('Log out')",
                        "button:has-text('Logout')",
                        "a[href*='logout']",
                        "a[href='/logout']",
                        "[aria-label='Account Menu']",
                        "img[alt*='avatar']"
                    ]
                    for sel in dashboard_selectors:
                        if await page.locator(sel).first.is_visible() or await github_page.locator(sel).first.is_visible():
                            success = True
                            break
                except Exception:
                    pass

                if success:
                    break

            if success:
                await log_auth(service, "")
                await log_auth(service, "[AUTH] Verification wait completed.")
                await log_auth(service, "[AUTH] Verification successful.")
                await log_auth(service, "")
            else:
                await log_auth(service, "")
                await log_auth(service, "[AUTH] Verification wait completed.")
                await log_auth(service, "[AUTH] Verification timeout.", "FAILED")
                await log_auth(service, f"[AUTH] Login failed.\n\nReason:\nGitHub MFA Verification Timeout", "FAILED")
                return False

        # 8. Wait for redirect
        await log_auth(service, "[AUTH] Waiting for redirect...")
        await log_auth(service, "")
        
        # Verify success
        success = False
        for _ in range(15):
            cur_url = page.url
            github_url = github_page.url
            if service == "render" and (("dashboard.render.com" in cur_url and "login" not in cur_url) or ("dashboard.render.com" in github_url and "login" not in github_url)):
                success = True
                break
            
            # Check session cookie presence
            try:
                cookies = await page.context.cookies()
                if service == "render" and any(c.get("name") in ["stytch_session", "stytch_session_jwt"] for c in cookies):
                    success = True
                    break
            except Exception:
                pass
                
            await asyncio.sleep(1.0)

        # Fallback validation check
        if not success:
            try:
                dashboard_selectors = [
                    "button:has-text('Log out')",
                    "button:has-text('Logout')",
                    "a[href*='logout']",
                    "a[href='/logout']",
                    "[aria-label='Account Menu']",
                    "img[alt*='avatar']"
                ]
                for sel in dashboard_selectors:
                    if await page.locator(sel).first.is_visible() or await github_page.locator(sel).first.is_visible():
                        success = True
                        break
            except Exception:
                pass

        if success:
            await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
            return True
        else:
            # Check for error banners
            error_text = "Unknown authentication failure"
            try:
                error_el = github_page.locator(".flash-error, [role='alert'], #js-flash-container").first
                if await error_el.is_visible():
                    error_text = await error_el.inner_text()
            except Exception:
                pass
            await log_auth(service, f"[AUTH] Login failed.\n\nReason:\n{error_text}", "FAILED")
            return False

    except PlaywrightTimeout as e:
        await log_auth(service, f"[AUTH] Login failed.\n\nReason:\nPage load or element interaction timed out ({str(e)})", "FAILED")
        return False
    except Exception as e:
        await log_auth(service, f"[AUTH] Login failed.\n\nReason:\n{str(e)}", "FAILED")
        return False
