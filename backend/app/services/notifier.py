import smtplib
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import settings

logger = logging.getLogger("dashboard.notifier")

async def send_email(subject: str, html_body: str):
    """
    Sends an email using standard SMTP.
    Catches all exceptions to ensure background checkers never crash.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        logger.warning("SMTP email notifications are skipped: SMTP credentials not set in environment.")
        return
        
    try:
        # Create message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = settings.MY_OAUTH_MAIL
        
        # Attach HTML
        msg.attach(MIMEText(html_body, "html"))
        
        # Connect to SMTP Server
        logger.info(f"Connecting to SMTP mail server {settings.SMTP_HOST}:{settings.SMTP_PORT}...")
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
        server.ehlo()
        server.starttls() # Secure connection with TLS
        server.ehlo()
        
        logger.info("Authenticating with SMTP server...")
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        
        logger.info(f"Dispatching alert email to {settings.MY_OAUTH_MAIL}...")
        server.sendmail(msg["From"], msg["To"], msg.as_string())
        server.quit()
        logger.info("Alert email successfully dispatched.")
        
    except Exception as e:
        logger.error(f"Failed to deliver SMTP email notification: {str(e)}")

async def send_service_alert_email(name: str, url: str, error: str, severity: str):
    """Dispatches a styled HTML alert when a service URL health check fails."""
    subject = f"🔴 ALERT: Service '{name}' is DOWN!"
    color = "#EF4444" if severity == "critical" else "#F59E0B"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; }}
            .header {{ background-color: {color}; color: white; padding: 24px; text-align: center; }}
            .content {{ padding: 30px; color: #374151; line-height: 1.6; }}
            .btn {{ display: inline-block; padding: 12px 24px; margin-top: 20px; color: white !important; background-color: #4F46E5; text-decoration: none; border-radius: 8px; font-weight: bold; }}
            .footer {{ background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2 style="margin: 0;">Service Incident Alert</h2>
            </div>
            <div class="content">
                <p>Hello Admin,</p>
                <p>A monitored service URL has triggered a <strong>{severity.upper()}</strong> alert.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 0; font-weight: bold; width: 120px;">Service Name</td><td style="padding: 10px 0;">{name}</td></tr>
                    <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 0; font-weight: bold;">Target URL</td><td style="padding: 10px 0;"><a href="{url}" style="color: #4F46E5;">{url}</a></td></tr>
                    <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 0; font-weight: bold;">Failure Details</td><td style="padding: 10px 0; color: #EF4444;">{error}</td></tr>
                    <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 0; font-weight: bold;">Timestamp</td><td style="padding: 10px 0;">{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</td></tr>
                </table>
                <p>Please check the administrator panel to investigate this outage.</p>
                <center>
                    <a href="http://localhost:5173/" class="btn">View Admin Dashboard</a>
                </center>
            </div>
            <div class="footer">
                API Key Monitoring & Service Health Dashboard &bull; Automated Notifications
            </div>
        </div>
    </body>
    </html>
    """
    await send_email(subject, html)

async def send_service_recovery_email(name: str, url: str):
    """Dispatches a styled HTML recovery notice when a service URL heals."""
    subject = f"🟢 RECOVERY: Service '{name}' is BACK UP!"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; }}
            .header {{ background-color: #10B981; color: white; padding: 24px; text-align: center; }}
            .content {{ padding: 30px; color: #374151; line-height: 1.6; }}
            .btn {{ display: inline-block; padding: 12px 24px; margin-top: 20px; color: white !important; background-color: #4F46E5; text-decoration: none; border-radius: 8px; font-weight: bold; }}
            .footer {{ background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2 style="margin: 0;">Service Recovered</h2>
            </div>
            <div class="content">
                <p>Hello Admin,</p>
                <p>Good news! The following monitored service URL has recovered and is successfully passing health checks.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 0; font-weight: bold; width: 120px;">Service Name</td><td style="padding: 10px 0;">{name}</td></tr>
                    <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 0; font-weight: bold;">Target URL</td><td style="padding: 10px 0;"><a href="{url}" style="color: #4F46E5;">{url}</a></td></tr>
                    <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 0; font-weight: bold;">Status</td><td style="padding: 10px 0; color: #10B981; font-weight: bold;">UP / Online</td></tr>
                    <tr style="border-bottom: 1px solid #E5E7EB;"><td style="padding: 10px 0; font-weight: bold;">Timestamp</td><td style="padding: 10px 0;">{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</td></tr>
                </table>
                <center>
                    <a href="http://localhost:5173/" class="btn">View Admin Dashboard</a>
                </center>
            </div>
            <div class="footer">
                API Key Monitoring & Service Health Dashboard &bull; Automated Notifications
            </div>
        </div>
    </body>
    </html>
    """
    await send_email(subject, html)

async def send_session_expired_email(service_name: str, error_message: str):
    """Dispatches an HTML notice when a Playwright scraping session state expires (e.g. needs user login)."""
    subject = f"⚠️ ACTION REQUIRED: {service_name.capitalize()} OAuth Session Expired!"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F3F4F6; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden; }}
            .header {{ background-color: #F59E0B; color: white; padding: 24px; text-align: center; }}
            .content {{ padding: 30px; color: #374151; line-height: 1.6; }}
            .btn {{ display: inline-block; padding: 12px 24px; margin-top: 20px; color: white !important; background-color: #4F46E5; text-decoration: none; border-radius: 8px; font-weight: bold; }}
            .footer {{ background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2 style="margin: 0;">Session Expiration Alert</h2>
            </div>
            <div class="content">
                <p>Hello Admin,</p>
                <p>The automated scraper encountered an authentication error while accessing your <strong>{service_name.capitalize()}</strong> account.</p>
                <div style="background-color: #FEF3C7; color: #92400E; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #FDE68A;">
                    <strong>Details:</strong> {error_message}
                </div>
                <p>To resume automated account monitoring and prevent data gaps, please navigate to the dashboard's Session Manager and re-authenticate.</p>
                <center>
                    <a href="http://localhost:5173/sessions" class="btn">Re-authenticate Session</a>
                </center>
            </div>
            <div class="footer">
                API Key Monitoring & Service Health Dashboard &bull; Automated Notifications
            </div>
        </div>
    </body>
    </html>
    """
    await send_email(subject, html)
