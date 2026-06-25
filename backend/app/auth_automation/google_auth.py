import asyncio
import logging
from datetime import datetime
from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from app.config import settings
from app.db import db

logger = logging.getLogger("dashboard.auth.google")

async def log_auth(service: str, message: str, stage: str = "AUTHENTICATING"):
    """Logs to terminal and updates MongoDB logs feed for real-time UI telemetry."""
    print(message, flush=True)
    if not message or not message.strip():
        return
    try:
        timestamp = datetime.utcnow()
        await db.oauth_sessions.update_one(
            {"service": service.lower()},
            {
                "$set": {
                    "current_stage": stage,
                    "stage_message": message,
                    "stage_updated_at": timestamp
                },
                "$push": {
                    "logs_feed": {
                        "timestamp": timestamp,
                        "stage": stage,
                        "message": message
                    }
                }
            },
            upsert=True
        )
    except Exception as e:
        logger.warning(f"Failed updating logs feed in DB: {e}")

async def dismiss_cookie_banner(page: Page, service: str) -> bool:
    """Attempts to find and dismiss cookie consent banners to prevent overlays."""
    cookie_selectors = [
        "button:has-text('Accept all cookies')",
        "button:has-text('Accept cookies')",
        "button:has-text('Accept all')",
        "button:has-text('Accept')",
        "button:has-text('Allow all')",
        "button:has-text('Agree')",
        "button:has-text('I agree')",
        "button[id*='onetrust-accept']",
        "#onetrust-accept-btn-handler",
        "button[id*='cookie']",
        "button[class*='cookie']",
        "[aria-label*='cookie'] button",
        "text=Accept all cookies",
        "text=Accept cookies"
    ]
    for selector in cookie_selectors:
        try:
            locator = page.locator(selector).first
            if await locator.is_visible() and await locator.is_enabled():
                logger.info(f"[{service.upper()}][COOKIES] Clicking cookie acceptance button: {selector}")
                await locator.click(timeout=3000)
                await asyncio.sleep(1.0)
                return True
        except Exception:
            continue
    return False

async def click_next_button(google_page: Page, is_password: bool = False) -> bool:
    """
    Attempts to robustly find and click the Next/Sign In button on the Google login page.
    """
    prefix = "passwordNext" if is_password else "identifierNext"
    
    # We prioritize elements that are explicitly buttons/clickable inside the next container
    # or general visible buttons containing the text "Next" or "Sign in"
    selectors = [
        f"#{prefix} button",
        f"#{prefix} [role='button']",
        "button:has-text('Next')",
        "button:has-text('Sign in')",
        f"#{prefix}",
    ]
    
    for selector in selectors:
        try:
            locator = google_page.locator(selector).first
            if await locator.is_visible() and await locator.is_enabled():
                logger.info(f"[GOOGLE_AUTH] Clicking button using selector: {selector}")
                await locator.click(timeout=5000)
                return True
        except Exception as e:
            logger.debug(f"[GOOGLE_AUTH] Click attempt failed for selector {selector}: {e}")
            continue
            
    # Fallback to standard behavior if no selector worked/was visible
    fallback_selector = f"#{prefix} button, #{prefix}, button:has-text('Next')"
    logger.info(f"[GOOGLE_AUTH] Fallback to selector: {fallback_selector}")
    await google_page.locator(fallback_selector).first.click(timeout=10000)
    return True

async def fill_input_field(page: Page, selector: str, value: str):
    """Fills an input field robustly by clicking, typing, and forcing input/change events."""
    locator = page.locator(selector).first
    await locator.click()
    await locator.fill("")
    
    # Try typing first for realistic input events
    try:
        if hasattr(locator, "press_sequentially"):
            await locator.press_sequentially(value, delay=30)
        else:
            await locator.type(value, delay=30)
    except Exception:
        # Fallback to direct fill if typing fails
        await locator.fill(value)
        
    # Trigger change events manually just to be absolutely sure the page registers the input
    try:
        await page.evaluate(f"""(sel) => {{
            const el = document.querySelector(sel);
            if (el) {{
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
        }}""", selector)
    except Exception:
        pass

async def is_service_logged_in(service: str, page: Page, google_page: Page) -> bool:
    """Helper to check if the user is already logged in to the target service."""
    # Handle stytch/oauth redirect transient page: wait up to 5 seconds for it to redirect
    for _ in range(5):
        cur_url = page.url.lower()
        g_url = google_page.url.lower()
        if "authenticate" in cur_url or "authenticate" in g_url:
            await asyncio.sleep(1.0)
        else:
            break

    cur_url = page.url.lower()
    g_url = google_page.url.lower()

    if service == "groq":
        # Check if we are on console.groq.com and NOT on login/authenticate
        if ("console.groq.com" in cur_url and "login" not in cur_url and "authenticate" not in cur_url) or \
           ("console.groq.com" in g_url and "login" not in g_url and "authenticate" not in g_url):
            return True

        # Or check cookies
        try:
            cookies = await page.context.cookies()
            if any(c.get("name") in ["stytch_session", "stytch_session_jwt"] for c in cookies):
                return True
        except Exception:
            pass

    elif service == "elevenlabs":
        if ("elevenlabs.io/app" in cur_url and "sign-in" not in cur_url) or \
           ("elevenlabs.io/app" in g_url and "sign-in" not in g_url):
            return True

        # Or check cookies
        try:
            cookies = await page.context.cookies()
            if any(c.get("name") == "fern_token" for c in cookies):
                return True
        except Exception:
            pass

    return False

async def authenticate_google(service: str, page: Page) -> bool:
    """
    Automates Google OAuth login for the specified service.
    """
    service = service.lower()
    email = settings.GOOGLE_EMAIL
    password = settings.GOOGLE_PASSWORD

    if not email or not password:
        await log_auth(service, f"[AUTH] Login failed. Reason: Missing GOOGLE_EMAIL or GOOGLE_PASSWORD in config.", "FAILED")
        return False

    try:
        # 1. Opening login page
        await log_auth(service, "[AUTH] Opening login page...")
        if service == "groq":
            await page.goto("https://console.groq.com/login", wait_until="domcontentloaded", timeout=30000)
        elif service == "elevenlabs":
            await page.goto("https://elevenlabs.io/app/sign-in", wait_until="domcontentloaded", timeout=30000)
        else:
            await page.goto("https://console.groq.com/login", wait_until="domcontentloaded", timeout=30000)

        await log_auth(service, "[AUTH] Login page loaded.")
        await log_auth(service, "")
        # Dismiss any cookie banners to prevent overlays blocking interaction
        await dismiss_cookie_banner(page, service)
        await asyncio.sleep(2.0)

        # 2. Clicking Continue with Google
        await log_auth(service, "[AUTH] Clicking Continue with Google...")
        await log_auth(service, "")
        google_btn = None
        
        # Groq specific / Elevenlabs / General Google selectors
        btn_selectors = [
            "button:has-text('Continue with Google')",
            "button:has-text('Google')",
            "a:has-text('Google')",
            "[role='button']:has-text('Google')",
            "button:has-text('Sign in with Google')",
            "div:has-text('Continue with Google')",
            "text=Continue with Google"
        ]
        
        for selector in btn_selectors:
            try:
                locator = page.locator(selector).first
                if await locator.is_visible() and await locator.is_enabled():
                    google_btn = locator
                    logger.debug(f"Found Google button with selector: {selector}")
                    break
            except Exception:
                continue

        if not google_btn:
            # Fallback to general search
            google_btn = page.locator("text=Continue with Google").first
            logger.debug("Falling back to general Continue with Google text search")

        # Detect and handle popup if Google opens a popup window
        google_page = None
        try:
            logger.debug("Attempting to click Google button and wait for popup...")
            async with page.context.expect_event("popup", timeout=15000) as popup_info:
                await google_btn.click()
            google_page = await popup_info.value
            logger.debug(f"Google login page opened in POPUP. URL: {google_page.url}")
        except Exception as e:
            logger.debug(f"Popup wait failed or timed out: {e}")

        # Fail-safe: Check if any other page in context has google.com
        if not google_page:
            for p in page.context.pages:
                if "google.com" in p.url.lower():
                    google_page = p
                    logger.debug(f"Found Google login page in context pages: {p.url}")
                    break

        # Fallback to main page
        if not google_page:
            google_page = page
            logger.debug("No separate Google popup page found, using main page.")

        # Ensure we are actually on a Google URL, otherwise do not continue.
        # This prevents typing credentials on parent page (ElevenLabs/Groq).
        if "google.com" not in google_page.url.lower():
            # Wait up to 3 seconds for load/redirect
            for _ in range(6):
                await asyncio.sleep(0.5)
                # Check other pages again
                for p in page.context.pages:
                    if "google.com" in p.url.lower():
                        google_page = p
                        break
                if "google.com" in google_page.url.lower():
                    break

        if "google.com" not in google_page.url.lower():
            await log_auth(service, "[AUTH] Login failed. Reason: Google OAuth page did not load/open.", "FAILED")
            return False

        logger.debug(f"Current URL after click: {page.url} | Google Page URL: {google_page.url}")

        # Check if we are already logged in (e.g. redirected immediately)
        if await is_service_logged_in(service, page, google_page):
            await log_auth(service, "[AUTH] Existing session detected. Login skipped.")
            await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
            return True

        # 3. Google login page detection
        await log_auth(service, "[AUTH] Google login page detected.")
        await log_auth(service, "")

        # 4. Enter email or select from account chooser
        email_selector = "input[name='identifier'], input[type='email'], #identifierId"
        account_chooser_selector = f"[data-email='{email}'], [data-identifier='{email}'], [role='link']:has-text('{email}'), div:has-text('{email}')"

        try:
            await google_page.wait_for_selector(f"{email_selector}, {account_chooser_selector}", timeout=20000)
        except Exception as wait_err:
            # Preemptive check: did we get logged in?
            if await is_service_logged_in(service, page, google_page):
                await log_auth(service, "[AUTH] Existing session detected. Login skipped.")
                await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
                return True
                
            try:
                title = await google_page.title()
                logger.debug(f"wait_for_selector email failed. Title: {title}")
                import os
                screenshot_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "google_auth_failed.png")
                await google_page.screenshot(path=screenshot_path)
                logger.debug(f"Screenshot saved to: {screenshot_path}")
            except Exception as capture_err:
                logger.debug(f"Failed capturing debug info: {capture_err}")
            raise wait_err

        # Check if account chooser is visible
        account_chooser = google_page.locator(account_chooser_selector).first
        if await account_chooser.is_visible():
            await log_auth(service, f"[AUTH] Selecting existing Google account: {email}")
            await account_chooser.click()
            await asyncio.sleep(3.0)
        else:
            await fill_input_field(google_page, email_selector, email)
            await log_auth(service, f"[AUTH] Email entered:\n{email}")
            await log_auth(service, "")

            # 5. Clicking Next
            await log_auth(service, "[AUTH] Clicking Next...")
            await log_auth(service, "")
            await click_next_button(google_page, is_password=False)
            await asyncio.sleep(3.0)

        # Check if email is invalid/wrong password page doesn't show
        try:
            # If there's an error message visible on screen
            error_el = google_page.locator("[role='presentation'] div:has-text('Could not find your Google Account')").first
            if await error_el.is_visible():
                reason = await error_el.inner_text()
                await log_auth(service, f"[AUTH] Login failed.\n\nReason:\n{reason}", "FAILED")
                return False
        except Exception:
            pass

        # Check if already logged in (redirected immediately after selecting account)
        if await is_service_logged_in(service, page, google_page):
            await log_auth(service, "[AUTH] Existing session detected. Login skipped.")
            await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
            return True

        # 6. Enter password
        try:
            await google_page.wait_for_selector("input[type='password']:visible", timeout=20000)
        except Exception as wait_err:
            if await is_service_logged_in(service, page, google_page):
                await log_auth(service, "[AUTH] Existing session detected. Login skipped.")
                await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
                return True
            raise wait_err

        await fill_input_field(google_page, "input[type='password']:visible", password)
        await log_auth(service, "[AUTH] Password entered.")
        await log_auth(service, "")

        # 7. Clicking Sign In (Next button after password)
        await log_auth(service, "[AUTH] Clicking Sign In...")
        await log_auth(service, "")
        await click_next_button(google_page, is_password=True)
        await asyncio.sleep(4.0)

        # 8. MFA / Verification Handling
        mfa_detected = False
        mfa_selectors = [
            "text=Verify it's you",
            "text=2-Step Verification",
            "text=Check your phone",
            "text=Enter verification code",
            "text=Google Authenticator",
            "text=authenticator",
            "text=verification code",
            "text=device approval"
        ]

        current_url = google_page.url
        if "challenge" in current_url or "twofactor" in current_url or "signin/v2/challenge" in current_url:
            mfa_detected = True
        else:
            for selector in mfa_selectors:
                try:
                    if await google_page.locator(selector).first.is_visible():
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
                
                # Check for successful redirect/dashboard indicators
                cur_url = page.url
                google_url = google_page.url
                
                # Success indicator
                logged_in = False
                if service == "groq" and (("console.groq.com" in cur_url and "login" not in cur_url and "authenticate" not in cur_url) or ("console.groq.com" in google_url and "login" not in google_url and "authenticate" not in google_url)):
                    logged_in = True
                elif service == "elevenlabs" and (("elevenlabs.io/app" in cur_url and "sign-in" not in cur_url) or ("elevenlabs.io/app" in google_url and "sign-in" not in google_url)):
                    logged_in = True
                
                # Verify session cookie present
                try:
                    cookies = await page.context.cookies()
                    if service == "groq" and any(c.get("name") in ["stytch_session", "stytch_session_jwt"] for c in cookies):
                        if "authenticate" not in cur_url and "authenticate" not in google_url:
                            logged_in = True
                    elif service == "elevenlabs" and any(c.get("name") == "fern_token" for c in cookies):
                        logged_in = True
                except Exception:
                    pass

                if logged_in:
                    success = True
                    break
                    
                # Secondary validation check: existence of typical dashboard elements
                try:
                    dashboard_selectors = [
                        "button:has-text('Log out')",
                        "button:has-text('Logout')",
                        "a[href*='logout']",
                        "[aria-label='Account menu']",
                        "img[src*='avatar']"
                    ]
                    for sel in dashboard_selectors:
                        if await page.locator(sel).first.is_visible() or await google_page.locator(sel).first.is_visible():
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
                await log_auth(service, f"[AUTH] Login failed.\n\nReason:\nMFA Verification Timeout", "FAILED")
                return False

        # 9. Wait for redirect
        await log_auth(service, "[AUTH] Waiting for redirect...")
        await log_auth(service, "")
        
        # Verify success
        success = False
        for _ in range(15):
            cur_url = page.url
            google_url = google_page.url
            if service == "groq" and (("console.groq.com" in cur_url and "login" not in cur_url and "authenticate" not in cur_url) or ("console.groq.com" in google_url and "login" not in google_url and "authenticate" not in google_url)):
                success = True
                break
            elif service == "elevenlabs" and (("elevenlabs.io/app" in cur_url and "sign-in" not in cur_url) or ("elevenlabs.io/app" in google_url and "sign-in" not in google_url)):
                success = True
                break
            
            # Check session cookie presence
            try:
                cookies = await page.context.cookies()
                if service == "groq" and any(c.get("name") in ["stytch_session", "stytch_session_jwt"] for c in cookies):
                    if "authenticate" not in cur_url and "authenticate" not in google_url:
                        success = True
                        break
                elif service == "elevenlabs" and any(c.get("name") == "fern_token" for c in cookies):
                    success = True
                    break
            except Exception:
                pass
                
            await asyncio.sleep(1.0)

        # Fallback to checking session cookie/dashboard selectors
        if not success:
            try:
                dashboard_selectors = [
                    "button:has-text('Log out')",
                    "button:has-text('Logout')",
                    "a[href*='logout']",
                    "[aria-label='Account menu']",
                    "img[src*='avatar']"
                ]
                for sel in dashboard_selectors:
                    if await page.locator(sel).first.is_visible() or await google_page.locator(sel).first.is_visible():
                        success = True
                        break
            except Exception:
                pass

        if success:
            await log_auth(service, "[AUTH] Login successful.", "COMPLETED")
            return True
        else:
            # Detect error text on page
            error_text = "Unknown authentication failure"
            try:
                error_el = google_page.locator("[role='alert'], #error, .error").first
                if await error_el.is_visible():
                    error_text = await error_el.inner_text()
            except Exception:
                pass
            await log_auth(service, f"[AUTH] Login failed.\n\nReason:\n{error_text}", "FAILED")
            return False

    except PlaywrightTimeout as e:
        try:
            import os
            screenshot_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "google_auth_failed.png")
            target_page = google_page if 'google_page' in locals() else page
            await target_page.screenshot(path=screenshot_path)
            logger.warning(f"Saved auth failure screenshot to {screenshot_path}")
        except Exception as sc_err:
            logger.debug(f"Failed to capture auth failure screenshot: {sc_err}")
            
        await log_auth(service, f"[AUTH] Login failed.\n\nReason:\nPage load or element interaction timed out ({str(e)})", "FAILED")
        return False
    except Exception as e:
        try:
            import os
            screenshot_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "google_auth_failed.png")
            target_page = google_page if 'google_page' in locals() else page
            await target_page.screenshot(path=screenshot_path)
            logger.warning(f"Saved auth failure screenshot to {screenshot_path}")
        except Exception as sc_err:
            logger.debug(f"Failed to capture auth failure screenshot: {sc_err}")

        await log_auth(service, f"[AUTH] Login failed.\n\nReason:\n{str(e)}", "FAILED")
        return False
